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

    press(key: string): Promise<void> {
        return nvda.press(key);
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
}
