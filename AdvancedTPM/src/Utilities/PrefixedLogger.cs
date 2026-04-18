using System;
using UnityEngine;

namespace AdvancedTPM.Utilities
{
    // Lightweight prefixed logger wrapper. Falls back to UnityEngine.Debug if Mod.log is unavailable.
    public class PrefixedLogger
    {
        private readonly string m_prefix;
        public PrefixedLogger(string prefix)
        {
            m_prefix = prefix ?? "";
        }

        private string Prefix(string msg) => "[" + m_prefix + "] " + msg;

        public void Info(string msg)
        {
            try { UnityEngine.Debug.Log(Prefix(msg)); } catch { }
        }

        public void Debug(string msg)
        {
            try { UnityEngine.Debug.Log(Prefix(msg)); } catch { }
        }

        public void Warn(string msg)
        {
            try { UnityEngine.Debug.LogWarning(Prefix(msg)); } catch { }
        }

        public void Error(string msg)
        {
            try { UnityEngine.Debug.LogError(Prefix(msg)); } catch { }
        }
    }
}