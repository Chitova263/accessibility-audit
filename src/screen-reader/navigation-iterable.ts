import type { ScreenReader } from './drivers/types';
import type { NavigationItem, NavigatorType, NavigationEndDetector } from './types';

export interface NavigationConfig {
    readonly key: string;
    readonly navigationEndDetector: NavigationEndDetector;
    readonly type: NavigatorType;
}

/**
 * An AsyncIterable over screen reader announcements, traversed via key presses.
 */
export class NavigationIterable implements AsyncIterable<NavigationItem> {
    constructor(
        private readonly sr: ScreenReader,
        private readonly config: NavigationConfig
    ) {}

    get type(): NavigatorType {
        return this.config.type;
    }

    async *[Symbol.asyncIterator](): AsyncIterableIterator<NavigationItem> {
        this.config.navigationEndDetector.reset();

        while (true) {
            const { spokenPhrases, focusedElementText, backendDOMNodeId } = await this.sr.press(this.config.key);
            const phrase = spokenPhrases.length > 0 ? spokenPhrases[spokenPhrases.length - 1]! : '';

            if (!this.config.navigationEndDetector.hasNext({ phrase, focusedElementText })) {
                return;
            }

            yield { phrase, focusedElementText, backendDOMNodeId };
        }
    }
}
