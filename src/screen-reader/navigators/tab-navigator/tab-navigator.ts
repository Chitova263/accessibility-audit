import type { ScreenReader } from '../../drivers/nvda';
import type { ElementNavigator, NavigationItem } from '../types';

export class TabNavigator implements ElementNavigator {
    public readonly type = 'focusable' as const;

    constructor(
        private readonly sr: ScreenReader,
        private readonly tabKey: string = 'Tab'
    ) {}

    async *[Symbol.asyncIterator](): AsyncIterableIterator<NavigationItem> {
        const firstResult = await this.sr.press(this.tabKey);
        const firstPhrase =
            firstResult.spokenPhrases.length > 0
                ? firstResult.spokenPhrases[firstResult.spokenPhrases.length - 1]!
                : '';

        yield { phrase: firstPhrase, focusedElementText: firstResult.focusedElementText };

        while (true) {
            const { spokenPhrases, focusedElementText } = await this.sr.press(this.tabKey);
            const phrase = spokenPhrases.length > 0 ? spokenPhrases[spokenPhrases.length - 1]! : '';

            // Cycle detection - back to first element
            if (phrase === firstPhrase) {
                return;
            }

            yield { phrase, focusedElementText };
        }
    }
}
