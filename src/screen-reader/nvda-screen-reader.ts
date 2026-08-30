import { type CommandOptions, nvda, type StartOptions } from '@guidepup/guidepup';
import { ScreenReader } from './screen-reader';
import { execSync } from 'node:child_process';

export class NvdaScreenReader extends ScreenReader {
    public constructor() {
        super(nvda);
    }

    public start(options?: StartOptions): Promise<void> {
        // Powershell script to bring the browser process window to foreground for the screen reader to act on
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
        return this.sr.start(options);
    }

    public navigateToDocumentStart(options?: CommandOptions): Promise<void> {
        return this.sr.press('Control+Home', options);
    }
}
