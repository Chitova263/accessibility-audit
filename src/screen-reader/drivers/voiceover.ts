import { voiceOver } from '@guidepup/guidepup';
import { delay } from '@guidepup/guidepup/lib/delay';
import type { ScreenReader, KeyPressResult } from './types';

export class VoiceOverDriver implements ScreenReader {
    readonly name = 'voiceover' as const;
    private readonly pollIntervalMs = 100;
    private readonly stableThreshold = 3;
    private readonly timeoutMs = 3000;

    async start(): Promise<void> {
        await voiceOver.start({ capture: false });
    }

    async stop(): Promise<void> {
        await voiceOver.stop();
    }

    async press(key: string): Promise<KeyPressResult> {
        await voiceOver.clearSpokenPhraseLog();
        await voiceOver.press(key);
        const spokenPhrases = await this.waitForSpeechStable();
        const focusedElementText = await voiceOver.itemText();

        return { spokenPhrases, focusedElementText };
    }

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
