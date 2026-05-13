using System;
using System.IO;
using System.Reflection;
using System.Linq;
using System.Collections.Generic;

public class InspectGameDll
{
    public static void Main(string[] args)
    {
        string dllPath = @"C:\Program Files (x86)\Steam\steamapps\common\Cities Skylines II\Cities2_Data\Managed\Game.dll";

        if (!File.Exists(dllPath)) {
            Console.WriteLine("Could not find Game.dll at " + dllPath);
            return;
        }

        try {
            Assembly gameDll = Assembly.LoadFrom(dllPath);
            var types = gameDll.GetTypes();

            string[] keywords = { "PolicyFlags", "PolicyData", "DistrictHappinessData", "School", "Camera", "SelectedInfo", "CitizenHappiness" };

            foreach (var keyword in keywords) {
                Console.WriteLine("--- Matches for '" + keyword + "' ---");
                foreach (var t in types) {
                    if (t.Name.Contains(keyword) || (t.Namespace != null && t.Namespace.Contains(keyword))) {
                        Console.WriteLine(t.FullName + " (IsEnum: " + t.IsEnum + ", IsValueType: " + t.IsValueType + ")");
                        if (t.IsEnum) {
                            Console.WriteLine("  Values: " + string.Join(", ", Enum.GetNames(t)));
                        } else {
                            var fields = t.GetFields(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.Static);
                            int count = 0;
                            foreach (var f in fields) {
                                Console.WriteLine("  Field: " + f.Name + " (" + f.FieldType.Name + ")");
                                if (++count > 10) break;
                            }
                        }
                    }
                }
            }
        } catch (Exception ex) {
            Console.WriteLine("Error: " + ex.ToString());
        }
    }
}
