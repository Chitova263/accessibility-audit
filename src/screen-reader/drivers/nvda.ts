import { nvda } from '@guidepup/guidepup';
import { execSync } from 'node:child_process';
import { delay } from '@guidepup/guidepup/lib/delay';

/**
 * Result of a press() action - contains only the speech produced by that specific action.
 */
export interface PressResult {
    /** Phrases spoken in response to this action (empty if NVDA didn't speak) */
    spokenPhrases: string[];
    /** The focused element's text */
    itemText: string;
}

export interface ScreenReader {
    start(): Promise<void>;
    stop(): Promise<void>;
    /**
     * Press a key and wait for NVDA to finish speaking.
     * Returns only the speech produced by this specific action.
     */
    press(key: string): Promise<PressResult>;
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
     * Press a key and wait for NVDA speech to stabilize.
     * Returns only the speech produced by this specific action.
     * If NVDA doesn't speak (e.g., at end of document), spokenPhrases will be empty.
     */
    async press(key: string): Promise<PressResult> {
        // Clear log to isolate speech from this action only
        await nvda.clearSpokenPhraseLog();
        
        // Perform the action
        await nvda.press(key);
        
        // Wait for speech to complete and capture what was spoken
        const spokenPhrases = await this.waitForSpeechStable();
        const itemText = await nvda.itemText();
        
        return { spokenPhrases, itemText };
    }

    /**
     * Wait for speech to stabilize by polling the phrase log until it stops changing.
     * Returns the phrases that were spoken.
     */
    private async waitForSpeechStable(): Promise<string[]> {
        const startTime = Date.now();
        let lastLogLength = -1;
        let stableCount = 0;

        while (Date.now() - startTime < this.timeoutMs) {
            const log = await nvda.spokenPhraseLog();

            if (log.length === lastLogLength) {
                stableCount++;
                if (stableCount >= this.stableThreshold) {
                    return log; // Speech has stabilized, return what was spoken
                }
            } else {
                stableCount = 0;
                lastLogLength = log.length;
            }

            await delay(this.pollIntervalMs);
        }
        
        // Timeout reached, return whatever we have
        return nvda.spokenPhraseLog();
    }
}
