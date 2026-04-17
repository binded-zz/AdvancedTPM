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

        private string Prefix(string msg) => $