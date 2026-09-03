import { nvda } from '@guidepup/guidepup';
import { delay } from '@guidepup/guidepup/lib/delay';
import type { ScreenReader, KeyPressResult } from './types';
import type { BrowserTarget } from '../browser-target';
import { focusChromeWindow } from '../../utils/windows-focus';

export type { ScreenReader, KeyPressResult, ScreenReaderType } from './types';
export { getScreenReaderDisplayName } from './types';

/** NVDA only reads the foreground window, so give Windows time to settle after raising it. */
const WINDOW_FOCUS_SETTLE_MS = 2000;

/**
 * NVDA screen reader driver, wrapping @guidepup/guidepup's NVDA interface.
 *
 * NVDA reads whatever window is in the foreground, so starting it is only meaningful
 * once the target's window is focused - which is why this driver, not its caller,
 * owns the focus dance.
 */
export class Nvda implements ScreenReader {
    readonly name = 'nvda' as const;
    private readonly pollIntervalMs = 100;
    private readonly stableThreshold = 3;
    private readonly timeoutMs = 3000;

    constructor(private readonly target: BrowserTarget) {}

    async start(): Promise<void> {
        await this.target.bringToFront();
        await focusChromeWindow(this.target.cdp);
        await delay(WINDOW_FOCUS_SETTLE_MS);
        await nvda.start();
    }

    stop(): Promise<void> {
        return nvda.stop();
    }

    async press(key: string): Promise<KeyPressResult> {
        await nvda.clearSpokenPhraseLog();
        await nvda.press(key);
        const spokenPhrases = await this.waitForSpeechStable();
        const focusedElementText = await nvda.itemText();

        return { spokenPhrases, focusedElementText };
    }

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
