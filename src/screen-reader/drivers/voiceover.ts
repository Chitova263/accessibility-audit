import { voiceOver } from '@guidepup/guidepup';
import { delay } from '@guidepup/guidepup/lib/delay';
import type { ScreenReader, PressResult } from './types';

export interface VoiceOverOptions {
    /** Enable speech audio output. Default: false (silent) */
    speech?: boolean;
}

export class VoiceOverDriver implements ScreenReader {
    private readonly pollIntervalMs = 100;
    private readonly stableThreshold = 3;
    private readonly timeoutMs = 3000;
    private readonly speech: boolean;

    constructor(options: VoiceOverOptions = {}) {
        this.speech = options.speech ?? false;
    }

    async start(): Promise<void> {
        await voiceOver.start({ capture: this.speech });
    }

    async stop(): Promise<void> {
        await voiceOver.stop();
    }

    async press(key: string): Promise<PressResult> {
        await voiceOver.clearSpokenPhraseLog();
        await voiceOver.press(key);
        const spokenPhrases = await this.waitForSpeechStable();
        const itemText = await voiceOver.itemText();

        return { spokenPhrases, itemText };
    }

    /** Wait for speech to stabilize by polling until the phrase log stops changing. */
    private async waitForSpeechStable(): Promise<string[]> {
        const startTime = Date.now();
        let lastLogLength = -1;
        let stableCount = 0;

        while (Date.now() - startTime < this.timeoutMs) {
            const log = await voiceOver.spokenPhraseLog();

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

        return voiceOver.spokenPhraseLog();
    }
}
