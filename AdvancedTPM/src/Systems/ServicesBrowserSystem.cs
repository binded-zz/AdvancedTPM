using Colossal.UI.Binding;
using Colossal.UI.Binding;
using Game.City;
using Game.Simulation;
using Game.UI;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Reflection;
using Unity.Entities;

namespace AdvancedTPM
{
    public partial class ServicesBrowserSystem : UISystemBase
    {
        private ValueBinding<string> _servicesBrowserData;
        private CitySystem _citySystem;
        private int _updateCounter;

        protected override void OnCreate()
        {
            base.OnCreate();
            Mod.log.Info("ServicesBrowserSystem OnCreate started");
            try { _citySystem = World.GetOrCreateSystemManaged<CitySystem>(); } catch { }
            AddBinding(_servicesBrowserData = new ValueBinding<string>("taxProduction", "servicesBrowserData", ""));
            Mod.log.Info("ServicesBrowserSystem OnCreate finished");
        }

        protected override void OnUpdate()
        {
            base.OnUpdate();
            _updateCounter++;
            if (_updateCounter < 480) return; // ~8 seconds
            _updateCounter = 0;

            Mod.log.Info("ServicesBrowserSystem OnUpdate triggered");
            try { UpdateServicesData(); } catch (Exception ex) { Mod.log.Warn($"ServicesBrowserSystem UpdateServicesData Error: {ex.Message}"); }
        }

        private void UpdateServicesData()
        {
            if (_servicesBrowserData == null || _citySystem == null) return;
            var em = EntityManager;
            var city = _citySystem.City;
            if (!em.Exists(city)) return;

            var serviceEnumType = FindType("Game.City.CityService") ?? FindType("Game.City.Service") ?? FindType("CityService");
            var map = new Dictionary<int, ServiceInfo>();

            // Try to read budget/fee buffers from the city entity using reflection.
            ReadServiceBuffer(em, city, "ServiceBudget", serviceEnumType, map, new[] { "m_Service", "m_ServiceType", "m_Type" }, new[] { "m_Budget", "m_BudgetPercentage", "m_Percentage" }, (info, val) => info.Budget = val);
            ReadServiceBuffer(em, city, "ServiceFee", serviceEnumType, map, new[] { "m_Service", "m_ServiceType", "m_Type" }, new[] { "m_Fee", "m_FeePercentage", "m_Percentage" }, (info, val) => info.Fee = val);
            ReadServiceBuffer(em, city, "ServiceUpkeep", serviceEnumType, map, new[] { "m_Service", "m_ServiceType", "m_Type" }, new[] { "m_Upkeep", "m_Cost", "m_Value" }, (info, val) => info.Upkeep = val);
            ReadServiceBuffer(em, city, "ServiceEfficiency", serviceEnumType, map, new[] { "m_Service", "m_ServiceType", "m_Type" }, new[] { "m_Efficiency", "m_Value" }, (info, val) => info.Efficiency = val);
            ReadServiceBuffer(em, city, "ServiceCoverage", serviceEnumType, map, new[] { "m_Service", "m_ServiceType", "m_Type" }, new[] { "m_Coverage", "m_Value" }, (info, val) => info.Coverage = val);
            ReadServiceBuffer(em, city, "ServiceCapacity", serviceEnumType, map, new[] { "m_Service", "m_ServiceType", "m_Type" }, new[] { "m_Capacity", "m_Value" }, (info, val) => info.Capacity = val);
            ReadServiceBuffer(em, city, "ServiceUsage", serviceEnumType, map, new[] { "m_Service", "m_ServiceType", "m_Type" }, new[] { "m_Usage", "m_Value" }, (info, val) => info.Usage = val);

            // If no buffers were found, still publish a list of services from the enum
            // so the UI can render the known service names with zeroed values.
            if (map.Count == 0 && serviceEnumType != null && serviceEnumType.IsEnum)
            {
                try
                {
                    foreach (var val in Enum.GetValues(serviceEnumType))
                    {
                        int id = Convert.ToInt32(val);
                        if (!map.ContainsKey(id))
                        {
                            map[id] = new ServiceInfo(id) { TypeName = val.ToString() };
                        }
                    }
                }
                catch { }
            }

            var list = map.Values.OrderBy(v => v.ServiceId).ToList();
            var payload = "[" + string.Join(",", list.Select(i => i.ToJson(serviceEnumType))) + "]";
            _servicesBrowserData.Update(payload);
            try { Mod.log.Info($"ServicesBrowserSystem: payload len={payload?.Length ?? 0} services={list.Count}"); } catch { }
            // Dump services payload to ModsData for easier capture when debugging
            try
            {
                var md = AdvancedTPM.Utilities.FilePaths.GetModsDataFolder();
                if (!string.IsNullOrEmpty(md))
                {
                    if (!System.IO.Directory.Exists(md)) System.IO.Directory.CreateDirectory(md);
                    var outp = System.IO.Path.Combine(md, "services_payload.json");
                    System.IO.File.WriteAllText(outp, payload ?? "", System.Text.Encoding.UTF8);
                    try { Mod.log.Info($"Wrote services payload to {outp}"); } catch { }
                }
            }
            catch (Exception ex) { try { Mod.log.Warn($"Failed to write services payload: {ex.Message}"); } catch { } }
        }

        private void ReadServiceBuffer(EntityManager em, Entity city, string bufferTypeName, Type serviceEnumType, Dictionary<int, ServiceInfo> map,
            string[] serviceFields, string[] valueFields, Action<ServiceInfo, float> applyValue)
        {
            try
            {
                var bufferType = FindType(bufferTypeName);
                if (bufferType == null) return;

                var getBuffer = em.GetType().GetMethod("GetBuffer", new[] { typeof(Entity) });
                if (getBuffer == null) return;
                var gb = getBuffer.MakeGenericMethod(bufferType);
                var buffer = gb.Invoke(em, new object[] { city });
                if (buffer == null) return;

                var lengthProp = buffer.GetType().GetProperty("Length");
                var itemGetter = buffer.GetType().GetMethod("get_Item");
                if (lengthProp == null || itemGetter == null) return;
                var len = (int)lengthProp.GetValue(buffer);

                for (int i = 0; i < len; i++)
                {
                    var element = itemGetter.Invoke(buffer, new object[] { i });
                    if (element == null) continue;

                    int serviceId = ReadEnumValue(element, serviceEnumType, serviceFields);
                    if (serviceId < 0) continue;

                    if (!map.TryGetValue(serviceId, out var info))
                    {
                        info = new ServiceInfo(serviceId);
                        map[serviceId] = info;
                        // Try to extract a human-friendly type/name from the buffer element
                        try
                        {
                            var name = ReadStringValue(element, new[] { "m_Name", "m_DisplayName", "m_TypeName", "m_Label", "m_ServiceName" });
                            if (!string.IsNullOrEmpty(name)) info.TypeName = name;
                        }
                        catch { }
                        map[serviceId] = info;
                    }

                    var value = ReadNumeric(element, valueFields);
                    if (value.HasValue) applyValue(info, (float)value.Value);
                }
            }
            catch { }
        }

        private static int ReadEnumValue(object element, Type serviceEnumType, string[] fields)
        {
            if (element == null) return -1;
            var t = element.GetType();
            foreach (var fName in fields)
            {
                try
                {
                    var f = t.GetField(fName, BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance);
                    if (f != null)
                    {
                        var raw = f.GetValue(element);
                        if (raw != null) return Convert.ToInt32(raw);
                    }
                    var p = t.GetProperty(fName, BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance);
                    if (p != null)
                    {
                        var raw = p.GetValue(element);
                        if (raw != null) return Convert.ToInt32(raw);
                    }
                }
                catch { }
            }
            return -1;
        }

        private static double? ReadNumeric(object element, string[] fields)
        {
            if (element == null) return null;
            var t = element.GetType();
            foreach (var fName in fields)
            {
                try
                {
                    var f = t.GetField(fName, BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance);
                    if (f != null)
                    {
                        var raw = f.GetValue(element);
                        if (raw is float fv) return fv;
                        if (raw is double dv) return dv;
                        if (raw is int iv) return iv;
                        if (raw is long lv) return lv;
                    }
                    var p = t.GetProperty(fName, BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance);
                    if (p != null)
                    {
                        var raw = p.GetValue(element);
                        if (raw is float fv2) return fv2;
                        if (raw is double dv2) return dv2;
                        if (raw is int iv2) return iv2;
                        if (raw is long lv2) return lv2;
                    }
                }
                catch { }
            }
            return null;
        }

        private static string ReadStringValue(object element, string[] fields)
        {
            if (element == null) return null;
            var t = element.GetType();
            foreach (var fName in fields)
            {
                try
                {
                    var f = t.GetField(fName, BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance);
                    if (f != null)
                    {
                        var raw = f.GetValue(element);
                        if (raw != null) return raw.ToString();
                    }
                    var p = t.GetProperty(fName, BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance);
                    if (p != null)
                    {
                        var raw = p.GetValue(element);
                        if (raw != null) return raw.ToString();
                    }
                }
                catch { }
            }
            return null;
        }

        private static Type FindType(string typeName)
        {
            if (string.IsNullOrEmpty(typeName)) return null;
            try
            {
                foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
                {
                    try
                    {
                        var t = asm.GetTypes().FirstOrDefault(x => x.FullName == typeName || x.Name == typeName || x.FullName?.EndsWith("." + typeName) == true);
                        if (t != null) return t;
                    }
                    catch { }
                }
            }
            catch { }
            return null;
        }

        private sealed class ServiceInfo
        {
            public int ServiceId { get; }
            public string TypeName { get; set; }
            public float Budget { get; set; }
            public float Fee { get; set; }
            public float Upkeep { get; set; }
            public float Efficiency { get; set; }
            public float Coverage { get; set; }
            public float Capacity { get; set; }
            public float Usage { get; set; }

            public ServiceInfo(int id) { ServiceId = id; }

            public string ToJson(Type serviceEnumType)
            {
                string name = serviceEnumType != null && Enum.IsDefined(serviceEnumType, ServiceId)
                    ? Enum.GetName(serviceEnumType, ServiceId)
                    : "Service " + ServiceId.ToString(CultureInfo.InvariantCulture);
                name = name ?? ("Service " + ServiceId.ToString(CultureInfo.InvariantCulture));
                string typeName = TypeName ?? name;
                string category = GetCategory(typeName);
                name = name.Replace("\"", "\\\"");
                typeName = typeName.Replace("\"", "\\\"");
                category = category.Replace("\"", "\\\"");
                return string.Format(CultureInfo.InvariantCulture,
                    "{{\"id\":{0},\"name\":\"{1}\",\"type\":\"{2}\",\"category\":\"{3}\",\"budget\":{4:0.##},\"fee\":{5:0.##},\"upkeep\":{6:0.##},\"efficiency\":{7:0.##},\"coverage\":{8:0.##},\"capacity\":{9:0.##},\"usage\":{10:0.##}}}",
                    ServiceId, name, typeName, category, Budget, Fee, Upkeep, Efficiency, Coverage, Capacity, Usage);
            }

            private static string GetCategory(string name)
            {
                var lower = (name ?? string.Empty).ToLowerInvariant();
                if (lower.Contains("electric") || lower.Contains("water") || lower.Contains("sewage") || lower.Contains("garbage")) return "Utilities";
                if (lower.Contains("health") || lower.Contains("death") || lower.Contains("fire") || lower.Contains("police") || lower.Contains("disaster")) return "Emergency";
                if (lower.Contains("road")) return "Networks";
                if (lower.Contains("transport") || lower.Contains("bus") || lower.Contains("tram") || lower.Contains("train") || lower.Contains("metro") || lower.Contains("taxi") || lower.Contains("harbor") || lower.Contains("airport")) return "Transportation";
                if (lower.Contains("park") || lower.Contains("recreation") || lower.Contains("plaza") || lower.Contains("tourism")) return "Parks";
                if (lower.Contains("post") || lower.Contains("telecom")) return "Communications";
                if (lower.Contains("education") || lower.Contains("research") || lower.Contains("admin")) return "Other";
                return "Other";
            }
        }
    }
}
