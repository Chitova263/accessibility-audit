import type { ScreenReader } from '../../drivers/nvda';
import type { IElementNavigator, NavigationItem } from '../types';

export class TabNavigator implements IElementNavigator {
    public readonly type = 'focusable' as const;

    constructor(
        private readonly sr: ScreenReader,
        private readonly tabKey: string = 'Tab'
    ) {}

    async *[Symbol.asyncIterator](): AsyncIterableIterator<NavigationItem> {
        await this.sr.press(this.tabKey);

        const firstPhrase = await this.sr.lastSpokenPhrase();
        const firstItemText = await this.sr.itemText();

        yield { phrase: firstPhrase, itemText: firstItemText };

        while (true) {
            await this.sr.press(this.tabKey);

            const phrase = await this.sr.lastSpokenPhrase();
            const itemText = await this.sr.itemText();

            if (phrase === firstPhrase) {
                return;
            }

            yield { phrase, itemText };
        }
    }
}
