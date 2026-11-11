// Mirrors the Windows "app mode" theme into Spotify's xpui folder so theme.js can follow it.
// Spotify's embedded Chromium is launched with --force-dark-mode, so prefers-color-scheme
// can't be used. The process sleeps until the registry value changes (no polling).
//
// Build and install with install.bat (no SDK needed, it uses the .NET Framework compiler that ships with Windows).
//
// Usage: SystemThemeWatcher.exe [outFile] [registryKeyPath]   (both optional)
using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using Microsoft.Win32;

static class SystemThemeWatcher
{
    const string DefaultKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize";
    const int RegNotifyChangeLastSet = 0x4;
    const int RegNotifyThreadAgnostic = 0x10000000;
    const int RecheckMs = 30000;
    const int RetryMs = 2000;

    [DllImport("advapi32.dll")]
    static extern int RegNotifyChangeKeyValue(IntPtr hKey, bool watchSubtree, int filter, IntPtr hEvent, bool async);

    static void Main(string[] args)
    {
        bool owned;
        using (new Mutex(true, @"Local\AutoLightSwitchThemeWatcher", out owned))
        {
            if (!owned) return;

            string outFile = args.Length > 0 ? args[0] : Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), @"Spotify\Apps\xpui\system-theme.txt");
            string keyPath = args.Length > 1 ? args[1] : DefaultKeyPath;

            using (RegistryKey key = Registry.CurrentUser.OpenSubKey(keyPath))
            using (AutoResetEvent changed = new AutoResetEvent(false))
            {
                if (key == null) return;
                IntPtr hKey = key.Handle.DangerousGetHandle();
                IntPtr hEvent = changed.SafeWaitHandle.DangerousGetHandle();
                int filter = RegNotifyChangeLastSet | RegNotifyThreadAgnostic;

                RegNotifyChangeKeyValue(hKey, false, filter, hEvent, true);
                int wait = RecheckMs;
                while (true)
                {
                    wait = Sync(outFile, ReadTheme(key)) ? RecheckMs : RetryMs;
                    if (changed.WaitOne(wait))
                    {
                        RegNotifyChangeKeyValue(hKey, false, filter, hEvent, true);
                    }
                }
            }
        }
    }

    static string ReadTheme(RegistryKey key)
    {
        object value = key.GetValue("AppsUseLightTheme");
        return (value is int && (int)value == 0) ? "dark" : "light";
    }

    // The xpui folder is recreated by "spicetify apply", so the file is rewritten whenever it is missing or stale.
    static bool Sync(string outFile, string theme)
    {
        try
        {
            if (!Directory.Exists(Path.GetDirectoryName(outFile))) return true;
            if (!File.Exists(outFile) || File.ReadAllText(outFile).Trim() != theme)
            {
                File.WriteAllText(outFile, theme);
            }
            return true;
        }
        catch (IOException)
        {
            return false;
        }
        catch (UnauthorizedAccessException)
        {
            return false;
        }
    }
}
