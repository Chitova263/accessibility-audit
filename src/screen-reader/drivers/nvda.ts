import { nvda } from '@guidepup/guidepup';
import { execSync } from 'node:child_process';
import { delay } from '@guidepup/guidepup/lib/delay';

export interface ScreenReader {
    start(): Promise<void>;
    stop(): Promise<void>;
    press(key: string): Promise<void>;
    lastSpokenPhrase(): Promise<string>;
    itemText(): Promise<string>;
    spokenPhraseLog(): Promise<string[]>;
    clearSpokenPhraseLog(): Promise<void>;
    itemTextLog(): Promise<string[]>;
    clearItemTextLog(): Promise<void>;
}

export class Nvda implements ScreenReader {
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

    /**
     * Press a key and wait for NVDA speech to stabilize before returning.
     * This ensures lastSpokenPhrase() returns the complete announcement.
     */
    async press(key: string): Promise<void> {
        await nvda.clearSpokenPhraseLog();
        await nvda.press(key);
        await this.waitForSpeechStable();
    }

    lastSpokenPhrase(): Promise<string> {
        return nvda.lastSpokenPhrase();
    }

    itemText(): Promise<string> {
        return nvda.itemText();
    }

    spokenPhraseLog(): Promise<string[]> {
        return nvda.spokenPhraseLog();
    }

    clearSpokenPhraseLog(): Promise<void> {
        return nvda.clearSpokenPhraseLog();
    }

    itemTextLog(): Promise<string[]> {
        return nvda.itemTextLog();
    }

    clearItemTextLog(): Promise<void> {
        return nvda.clearItemTextLog();
    }

    /**
     * Wait for speech to stabilize by polling the phrase log until it stops changing.
     */
    private async waitForSpeechStable(): Promise<void> {
        const startTime = Date.now();
        let lastLogLength = -1;
        let stableCount = 0;

        while (Date.now() - startTime < this.timeoutMs) {
            const log = await nvda.spokenPhraseLog();

            if (log.length === lastLogLength) {
                stableCount++;
                if (stableCount >= this.stableThreshold) {
                    return; // Speech has stabilized
                }
            } else {
                stableCount = 0;
                lastLogLength = log.length;
            }

            await delay(this.pollIntervalMs);
        }
        // Timeout reached, continue anyway
    }
}
