using System;
using System.Collections.Concurrent;
using System.IO;
using System.Text;
using System.Threading;

namespace AdvancedTPM.Utilities
{
    // Non-blocking debug file writer: queue lines and flush from background thread.
    // This avoids file I/O on the main thread which can cause UI stutters when heavy logging is enabled.
    public static class DebugFile
    {
        private const long MaxBytes = 2 * 1024 * 1024; // 2 MB
        private static readonly ConcurrentQueue<string> s_queue = new ConcurrentQueue<string>();
        private static readonly AutoResetEvent s_signal = new AutoResetEvent(false);
        private static readonly CancellationTokenSource s_cts = new CancellationTokenSource();
        private static readonly TimeSpan s_flushInterval = TimeSpan.FromSeconds(1);
        private static Thread s_worker;

        static DebugFile()
        {
            try
            {
                s_worker = new Thread(WorkerLoop) { IsBackground = true, Name = "AdvancedTPM-DebugWriter" };
                s_worker.Start();
            }
            catch { }
        }

        private static string GetPath()
        {
            try
            {
                var data = FilePaths.GetModsDataFolder();
                if (string.IsNullOrEmpty(data)) return null;
                try { if (!Directory.Exists(data)) Directory.CreateDirectory(data); } catch { }
                return Path.Combine(data, "advancedtpm-debug.log");
            }
            catch { return null; }
        }

        public static void AppendLine(string line)
        {
            try
            {
                if (string.IsNullOrEmpty(line)) return;
                s_queue.Enqueue(line);
                // signal worker to flush sooner
                s_signal.Set();
            }
            catch { }
        }

        private static void WorkerLoop()
        {
            var token = s_cts.Token;
            while (!token.IsCancellationRequested)
            {
                try
                {
                    // Wait for signal or interval
                    s_signal.WaitOne(s_flushInterval);
                    FlushQueue();
                }
                catch { }
            }
            // Final flush on shutdown
            try { FlushQueue(); } catch { }
        }

        private static void FlushQueue()
        {
            try
            {
                if (s_queue.IsEmpty) return;
                var sb = new StringBuilder();
                while (s_queue.TryDequeue(out var line))
                {
                    sb.AppendLine(line);
                }
                var chunk = sb.ToString();
                if (chunk.Length == 0) return;

                var path = GetPath();
                if (string.IsNullOrEmpty(path)) return;

                // Rotate if file would exceed MaxBytes after this write
                try
                {
                    var dir = Path.GetDirectoryName(path) ?? string.Empty;
                    if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
                    long existing = 0;
                    try { if (File.Exists(path)) existing = new FileInfo(path).Length; } catch { existing = 0; }
                    var bytesToAdd = Encoding.UTF8.GetByteCount(chunk);
                    if (existing + bytesToAdd > MaxBytes)
                    {
                        try
                        {
                            var stamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");
                            var archive = Path.Combine(dir, $"advancedtpm-debug-{stamp}.log");
                            try { File.Move(path, archive); } catch { }
                        }
                        catch { }
                    }
                }
                catch { }

                try
                {
                    // Append in one write
                    File.AppendAllText(path, chunk, Encoding.UTF8);
                }
                catch { }
            }
            catch { }
        }

        public static string ReadAll()
        {
            try
            {
                var path = GetPath();
                if (string.IsNullOrEmpty(path) || !File.Exists(path)) return null;
                // Attempt a simple read; if writer is active there may be partial writes but this is acceptable for debug display
                return File.ReadAllText(path, Encoding.UTF8);
            }
            catch { return null; }
        }

        public static void Shutdown()
        {
            try
            {
                s_cts.Cancel();
                s_signal.Set();
                s_worker?.Join(1500);
            }
            catch { }
        }
    }
}
