using Game.Prefabs;
using Colossal.IO.AssetDatabase;
public class Test {
    public void Run(PrefabBase prefabBase) {
        if (prefabBase.asset != null && !prefabBase.asset.isBuiltin) {
            var meta = prefabBase.asset.GetMeta();
            string a = meta.displayName;
            string b = meta.packageName;
            string c = meta.remoteStorageSourceName;
        }
    }
}
