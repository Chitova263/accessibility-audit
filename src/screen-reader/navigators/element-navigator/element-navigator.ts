import type { ScreenReader } from '../../drivers/nvda';
import type { IElementNavigator, NavigationItem, NavigatorType, EndDetector } from '../types';

export interface ElementNavigatorConfig {
    readonly advanceKey: string;
    readonly endDetector: EndDetector;
}

export class ElementNavigator implements IElementNavigator {
    constructor(
        private readonly sr: ScreenReader,
        private readonly config: ElementNavigatorConfig,
        public readonly type: NavigatorType
    ) {}

    async *[Symbol.asyncIterator](): AsyncIterableIterator<NavigationItem> {
        // Reset detector state at the start of each navigation
        this.config.endDetector.reset();

        while (true) {
            const { spokenPhrases, itemText } = await this.sr.press(this.config.advanceKey);

            // Use the last phrase (most complete announcement)
            const phrase = spokenPhrases.length > 0 
                ? spokenPhrases[spokenPhrases.length - 1]! 
                : '';

            if (this.config.endDetector.check({ phrase, itemText })) {
                return;
            }

            yield { phrase, itemText };
        }
    }
}
