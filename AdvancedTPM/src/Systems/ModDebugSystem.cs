using Colossal.UI.Binding;
using Game.UI;
using System;
using System.Collections.Generic;
using System.Reflection;
using Unity.Entities;
using Unity.Collections;
using System.Linq;

namespace AdvancedTPM
{
    public partial class ModDebugSystem : UISystemBase
    {
        private ValueBinding<string> _debugStatus;
        private ValueBinding<string> _inspectionResult;
        private ValueBinding<string> _typeSearchResults;

        protected override void OnCreate()
        {
            base.OnCreate();
            Mod.log.Info("ModDebugSystem.OnCreate");

            AddBinding(_debugStatus = new ValueBinding<string>("taxProduction", "debugStatus", "Debug System Active"));
            AddBinding(_inspectionResult = new ValueBinding<string>("taxProduction", "inspectionResult", "{}"));
            AddBinding(_typeSearchResults = new ValueBinding<string>("taxProduction", "typeSearchResults", "[]"));

            AddBinding(new TriggerBinding<string>("taxProduction", "inspectEntity", HandleInspectEntity));
            AddBinding(new TriggerBinding<string>("taxProduction", "searchTypes", HandleSearchTypes));

            DiscoverFields();
        }

        private void DiscoverFields()
        {
            try {
                var schoolType = typeof(Game.Buildings.School);
                Mod.log.Info("Discovering fields for " + schoolType.FullName);
                foreach (var f in schoolType.GetFields(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance)) {
                    Mod.log.Info("  School Field: " + f.Name + " (" + f.FieldType.Name + ")");
                }
            } catch (Exception ex) { Mod.log.Error("DiscoverFields failed: " + ex.Message); }
        }

        private void HandleInspectEntity(string payload)
        {
            try {
                var parts = payload.Split(',');
                if (parts.Length < 2) return;
                int idx = int.Parse(parts[0]);
                int ver = int.Parse(parts[1]);
                Entity entity = new Entity { Index = idx, Version = ver };

                if (!EntityManager.Exists(entity)) {
                    _inspectionResult.Update("{\"error\":\"Entity does not exist\"}");
                    return;
                }

                var components = EntityManager.GetComponentTypes(entity, Allocator.Temp);
                var compList = new List<string>();
                foreach (var c in components) {
                    compList.Add($"\"{c.GetManagedType().FullName}\"");
                }
                components.Dispose();

                _inspectionResult.Update($"{{\"entity\":\"{payload}\",\"components\":[{string.Join(",", compList)}]}}");
            } catch (Exception ex) {
                _inspectionResult.Update($"{{\"error\":\"{ex.Message}\"}}");
            }
        }

        private void HandleSearchTypes(string keyword)
        {
            try {
                if (string.IsNullOrEmpty(keyword)) {
                    _typeSearchResults.Update("[]");
                    return;
                }
                var results = new List<string>();
                var assemblies = AppDomain.CurrentDomain.GetAssemblies();

                foreach (var asm in assemblies) {
                    string asmName = asm.FullName.ToLower();
                    if (!asmName.Contains("game") && !asmName.Contains("unity") && !asmName.Contains("advancedtpm") && !asmName.Contains("colossal")) continue;
                    
                    Type[] types;
                    try { types = asm.GetTypes(); } catch { continue; }

                    foreach (var t in types) {
                        if (t.Name.IndexOf(keyword, StringComparison.OrdinalIgnoreCase) >= 0 || (t.Namespace != null && t.Namespace.IndexOf(keyword, StringComparison.OrdinalIgnoreCase) >= 0)) {
                            string members = "";
                            try {
                                if (t.IsEnum) {
                                    members = string.Join(", ", Enum.GetNames(t).Take(20));
                                } else {
                                    var fields = t.GetFields(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.Static);
                                    members = string.Join(", ", fields.Take(15).Select(f => $"{f.Name}:{f.FieldType.Name}"));
                                }
                            } catch { members = "Error reading members"; }
                            results.Add($"{{\"name\":\"{t.FullName}\",\"isEnum\":{t.IsEnum.ToString().ToLower()},\"members\":\"{EscapeJson(members)}\"}}");
                            if (results.Count > 100) break; 
                        }
                    }
                    if (results.Count > 100) break;
                }
                _typeSearchResults.Update("[" + string.Join(",", results) + "]");
                _debugStatus.Update($"Search finished: {results.Count} results found.");
            } catch (Exception ex) {
                Mod.log.Error("SearchTypes failed: " + ex.Message);
                _debugStatus.Update("Search failed: " + ex.Message);
            }
        }

        private string EscapeJson(string s) => string.IsNullOrEmpty(s) ? "" : s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "");

        protected override void OnUpdate() { }
    }
}
