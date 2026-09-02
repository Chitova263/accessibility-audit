import { nvda } from '@guidepup/guidepup';
import { execSync } from 'node:child_process';
import { delay } from '@guidepup/guidepup/lib/delay';
import type { ScreenReader, PressResult } from './types';

export type { ScreenReader, PressResult } from './types';

export class Nvda implements ScreenReader {
    readonly name = 'nvda' as const;
    private readonly pollIntervalMs = 100;
    private readonly stableThreshold = 3;
    private readonly timeoutMs = 3000;

    async start(): Promise<void> {
        // Bring Chrome to foreground - NVDA needs window focus
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
}
