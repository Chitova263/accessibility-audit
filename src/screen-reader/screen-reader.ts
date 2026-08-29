import {
    type CommandOptions,
    type IScreenReader as IGuidepupScreenReader,
    type StartOptions,
} from '@guidepup/guidepup';
import { execSync } from 'node:child_process';

export interface IScreenReader {
    start(options?: StartOptions): Promise<void>;
    stop(options?: CommandOptions): Promise<void>;
    nextHeading(options?: CommandOptions): Promise<void>;
    nextHeadingLevel1(options?: CommandOptions): Promise<void>;
    nextHeadingLevel2(options?: CommandOptions): Promise<void>;
    nextHeadingLevel3(options?: CommandOptions): Promise<void>;
    nextHeadingLevel4(options?: CommandOptions): Promise<void>;
    nextHeadingLevel5(options?: CommandOptions): Promise<void>;
    nextHeadingLevel6(options?: CommandOptions): Promise<void>;
    nextLink(options?: CommandOptions): Promise<void>;
    nextLandmark(options?: CommandOptions): Promise<void>;
    nextButton(options?: CommandOptions): Promise<void>;
    press(key: string, options?: CommandOptions): Promise<void>;
    /** Press Tab key to move to next focusable element */
    pressTab(options?: CommandOptions): Promise<void>;
    perform(command: unknown, options?: CommandOptions): Promise<void>;
    lastSpokenPhrase(): Promise<string>;
    itemText(): Promise<string>;
    spokenPhraseLog(): Promise<string[]>;
    clearSpokenPhraseLog(): Promise<void>;
    itemTextLog(): Promise<string[]>;
    clearItemTextLog(): Promise<void>;
    toggleBetweenBrowseAndFocusMode(): Promise<'Browse' | 'Focus' | undefined>;
    /** Move NVDA cursor to the beginning of the document (Ctrl+Home) */
    navigateToDocumentStart(options?: CommandOptions): Promise<void>;
}

export function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export abstract class ScreenReader implements IScreenReader {
    protected constructor(public readonly sr: IGuidepupScreenReader) {}

    public async toggleBetweenBrowseAndFocusMode(): Promise<'Browse' | 'Focus' | undefined> {
        return undefined;
    }

    public perform(command: unknown, options?: CommandOptions): Promise<void> {
        return this.sr.perform(command, options);
    }

    public lastSpokenPhrase(): Promise<string> {
        return this.sr.lastSpokenPhrase();
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

    public stop(options?: CommandOptions): Promise<void> {
        return this.sr.stop(options);
    }

    public clearItemTextLog(): Promise<void> {
        return this.sr.clearItemTextLog();
    }

    public clearSpokenPhraseLog(): Promise<void> {
        return this.sr.clearSpokenPhraseLog();
    }

    public spokenPhraseLog(): Promise<string[]> {
        return this.sr.spokenPhraseLog();
    }

    public nextHeading(options?: CommandOptions): Promise<void> {
        return this.sr.nextHeading(options);
    }

    public nextHeadingLevel1(options?: CommandOptions): Promise<void> {
        return this.sr.press('1', options);
    }

    public nextHeadingLevel2(options?: CommandOptions): Promise<void> {
        return this.sr.press('2', options);
    }

    public nextHeadingLevel3(options?: CommandOptions): Promise<void> {
        return this.sr.press('3', options);
    }

    public nextHeadingLevel4(options?: CommandOptions): Promise<void> {
        return this.sr.press('4', options);
    }

    public nextHeadingLevel5(options?: CommandOptions): Promise<void> {
        return this.sr.press('5', options);
    }

    public nextHeadingLevel6(options?: CommandOptions): Promise<void> {
        return this.sr.press('6', options);
    }

    public nextLink(options?: CommandOptions): Promise<void> {
        return this.sr.nextLink(options);
    }

    public nextLandmark(options?: CommandOptions): Promise<void> {
        return this.sr.nextLandmark(options);
    }

    public nextButton(options?: CommandOptions): Promise<void> {
        return this.sr.press('b', options);
    }

    public itemText(): Promise<string> {
        return this.sr.itemText();
    }

    public itemTextLog(): Promise<string[]> {
        return this.sr.itemTextLog();
    }

    public press(key: string, options?: CommandOptions): Promise<void> {
        return this.sr.press(key, options);
    }

    public pressTab(options?: CommandOptions): Promise<void> {
        return this.sr.press('Tab', options);
    }

    public navigateToDocumentStart(options?: CommandOptions): Promise<void> {
        return this.sr.press('Control+Home', options);
    }
}
