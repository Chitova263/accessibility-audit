import type { Page } from 'playwright';
import { nvda } from '@guidepup/guidepup';
import { execSync } from 'node:child_process';
import { delay } from '@guidepup/guidepup/lib/delay';
import type { ScreenReader, PressResult } from './types';

export type { ScreenReader, PressResult, ScreenReaderName } from './types';
export { getScreenReaderDisplayName } from './types';

export interface NvdaOptions {
    /** Playwright page - used to get the correct Chrome window via CDP */
    page?: Page | undefined;
}

export class Nvda implements ScreenReader {
    readonly name = 'nvda' as const;
    private readonly pollIntervalMs = 100;
    private readonly stableThreshold = 3;
    private readonly timeoutMs = 3000;
    private readonly page: Page | undefined;

    constructor(options?: NvdaOptions) {
        this.page = options?.page;
    }

    async start(): Promise<void> {
        await this.bringChromeToForeground();
        return nvda.start();
    }

    stop(): Promise<void> {
        return nvda.stop();
    }

    async press(key: string): Promise<PressResult> {
        // Clear log to isolate speech from this action only
        await nvda.clearSpokenPhraseLog();
        await nvda.press(key);
        const spokenPhrases = await this.waitForSpeechStable();
        const itemText = await nvda.itemText();

        return { spokenPhrases, itemText };
    }

    /** Wait for speech to stabilize by polling until the phrase log stops changing. */
    private async waitForSpeechStable(): Promise<string[]> {
        const startTime = Date.now();
        let lastLogLength = -1;
        let stableCount = 0;

        while (Date.now() - startTime < this.timeoutMs) {
            const log = await nvda.spokenPhraseLog();

            if (log.length === lastLogLength) {
                stableCount++;
                if (stableCount >= this.stableThreshold) {
                    return log;
                }
            } else {
                stableCount = 0;
                lastLogLength = log.length;
            }

            await delay(this.pollIntervalMs);
        }

        return nvda.spokenPhraseLog();
    }

    /**
     * Brings the Chrome window to foreground.
     * If a page is provided, uses CDP to find the specific browser process.
     * Otherwise falls back to finding any Chrome window.
     */
    private async bringChromeToForeground(): Promise<void> {
        let pid: number | undefined;

        if (this.page) {
            pid = await this.getBrowserPidViaCdp();
        }

        if (pid) {
            this.focusWindowByPid(pid);
        } else {
            this.focusAnyChrome();
        }
    }

    /**
     * Uses CDP SystemInfo.getProcessInfo to find the browser's main process PID.
     */
    private async getBrowserPidViaCdp(): Promise<number | undefined> {
        if (!this.page) return undefined;

        try {
            const cdp = await this.page.context().newCDPSession(this.page);
            const result = await cdp.send('SystemInfo.getProcessInfo');

            // Find the "browser" type process - this is the main Chrome process
            const browserProcess = result.processInfo.find((p: { type: string; id: number }) => p.type === 'browser');

            await cdp.detach();

            return browserProcess?.id;
        } catch {
            // If CDP call fails, fall back to finding any Chrome
            return undefined;
        }
    }

    /**
     * Focuses the Chrome window belonging to the specified process ID.
     */
    private focusWindowByPid(pid: number): void {
        // Use PowerShell to find and focus the window by PID
        // EnumWindows approach: find windows belonging to chrome.exe processes that match our PID
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
                // Get all chrome processes and find the one with our target PID or its children
                `$targetPid = ${pid}; ` +
                // Get all chrome.exe processes that are children of our browser process
                `$chromePids = @($targetPid); ` +
                `Get-CimInstance Win32_Process -Filter \\\"Name='chrome.exe'\\\" | ForEach-Object { ` +
                `if ($_.ParentProcessId -eq $targetPid) { $chromePids += $_.ProcessId } ` +
                `}; ` +
                // Find chrome processes with visible windows
                `$hwnd = $null; ` +
                `foreach ($proc in Get-Process chrome -ErrorAction SilentlyContinue) { ` +
                `if ($chromePids -contains $proc.Id -and $proc.MainWindowHandle -ne 0) { ` +
                `$hwnd = $proc.MainWindowHandle; break ` +
                `} ` +
                `}; ` +
                // If we found a window, focus it
                `if ($hwnd) { ` +
                `[W32]::keybd_event(0x12, 0, 0, 0); ` +
                `[W32]::keybd_event(0x12, 0, 2, 0); ` +
                `[W32]::SetForegroundWindow($hwnd) ` +
                `}"`,
            { stdio: 'ignore' }
        );
    }

    /**
     * Fallback: focuses any Chrome window (original behavior).
     */
    private focusAnyChrome(): void {
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
}
