import type { ScreenReader } from '../../drivers/nvda';
import type { ElementNavigator, NavigationItem, NavigatorType, EndDetector } from '../types';

export interface BrowseModeElementNavigatorConfig {
    readonly advanceKey: string;
    readonly endDetector: EndDetector;
}

export class BrowseModeElementNavigator implements ElementNavigator {
    constructor(
        private readonly sr: ScreenReader,
        private readonly config: BrowseModeElementNavigatorConfig,
        public readonly type: NavigatorType
    ) {}

    async *[Symbol.asyncIterator](): AsyncIterableIterator<NavigationItem> {
        this.config.endDetector.reset();

        while (true) {
            const { spokenPhrases, focusedElementText } = await this.sr.press(this.config.advanceKey);

            const phrase = spokenPhrases.length > 0 ? spokenPhrases[spokenPhrases.length - 1]! : '';

            if (this.config.endDetector.check({ phrase, focusedElementText })) {
                return;
            }

            yield { phrase, focusedElementText };
        }
    }
}
