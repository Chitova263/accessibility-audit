import type { CDPSession } from 'playwright';
import { execSync } from 'node:child_process';
import { Logger } from './logger';

const log = Logger.context('WindowFocus');

export async function focusChromeWindow(cdp: CDPSession): Promise<void> {
    const pid = await getBrowserPid(cdp);

    if (pid) {
        log.debug(`Focusing Chrome window by PID ${pid}`);
        focusWindowByPid(pid);
    } else {
        log.debug('Focusing any Chrome window (fallback)');
        focusAnyChrome();
    }
}

async function getBrowserPid(cdp: CDPSession): Promise<number | undefined> {
    try {
        const result = await cdp.send('SystemInfo.getProcessInfo');
        const browserProcess = result.processInfo.find((p: { type: string; id: number }) => p.type === 'browser');
        return browserProcess?.id;
    } catch {
        return undefined;
    }
}

function focusWindowByPid(pid: number): void {
    execSync(
        `powershell -Command "` +
            `Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; using System.Text; ` +
            `public class W32 { ` +
            `[DllImport(\\\"user32.dll\\\")] public static extern bool SetForegroundWindow(IntPtr h); ` +
            `[DllImport(\\\"user32.dll\\\")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo); ` +
            `[DllImport(\\\"user32.dll\\\")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId); ` +
            `[DllImport(\\\"user32.dll\\\")] public static extern bool IsWindowVisible(IntPtr hWnd); ` +
            `[DllImport(\\\"user32.dll\\\")] public static extern int GetWindowTextLength(IntPtr hWnd); ` +
            `}';` +
            `$targetPid = ${pid}; ` +
            `$chromePids = @($targetPid); ` +
            `Get-CimInstance Win32_Process -Filter \\\"Name='chrome.exe'\\\" | ForEach-Object { ` +
            `if ($_.ParentProcessId -eq $targetPid) { $chromePids += $_.ProcessId } ` +
            `}; ` +
            `$hwnd = $null; ` +
            `foreach ($proc in Get-Process chrome -ErrorAction SilentlyContinue) { ` +
            `if ($chromePids -contains $proc.Id -and $proc.MainWindowHandle -ne 0) { ` +
            `$hwnd = $proc.MainWindowHandle; break ` +
            `} ` +
            `}; ` +
            `if ($hwnd) { ` +
            `[W32]::keybd_event(0x12, 0, 0, 0); ` +
            `[W32]::keybd_event(0x12, 0, 2, 0); ` +
            `[W32]::SetForegroundWindow($hwnd) ` +
            `}"`,
        { stdio: 'ignore' }
    );
}

function focusAnyChrome(): void {
    execSync(
        `powershell -Command "` +
            `$hwnd = (Get-Process chrome | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1).MainWindowHandle;` +
            `Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class W32 { ` +
            `[DllImport(\\\"user32.dll\\\")] public static extern bool SetForegroundWindow(IntPtr h); ` +
            `[DllImport(\\\"user32.dll\\\")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo); ` +
            `}';` +
            `[W32]::keybd_event(0x12, 0, 0, 0);` +
            `[W32]::keybd_event(0x12, 0, 2, 0);` +
            `[W32]::SetForegroundWindow($hwnd)"`,
        { stdio: 'ignore' }
    );
}
