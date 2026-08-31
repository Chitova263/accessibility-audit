import type { ScreenReader } from '../../drivers/nvda';
import type { IElementNavigator, NavigationItem, NavigatorConfig, NavigatorType } from '../types';

export class ElementNavigator implements IElementNavigator {
    constructor(
        private readonly sr: ScreenReader,
        private readonly config: NavigatorConfig,
        public readonly type: NavigatorType
    ) {}

    async *[Symbol.asyncIterator](): AsyncIterableIterator<NavigationItem> {
        while (true) {
            await this.sr.press(this.config.advanceKey);
            const phrase = await this.sr.lastSpokenPhrase();
            const itemText = await this.sr.itemText();

            if (this.config.isComplete({ phrase, itemText })) {
                return;
            }

            yield { phrase, itemText };
        }
    }
}
