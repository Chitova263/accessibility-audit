import type { ScreenReader } from './drivers/types';
import type { NavigationMode, NavigatorType, ScreenReaderProfile } from './types';
import { NavigationIterable } from './navigation-iterable';

/**
 * The screen reader's virtual cursor: the single position on the page that every
 * traversal below moves.
 */
export class VirtualCursor {
    constructor(
        private readonly reader: ScreenReader,
        private readonly profile: ScreenReaderProfile
    ) {}

    private getNavigationIterable(mode: NavigationMode, type: NavigatorType) {
        return new NavigationIterable(this.reader, {
            key: mode.key,
            navigationEndDetector: mode.endDetector,
            type,
        });
    }

    headings() {
        return this.getNavigationIterable(this.profile.modes.heading, 'heading');
    }
    headingsLevel(level: 1 | 2 | 3 | 4 | 5 | 6) {
        return this.getNavigationIterable(this.profile.modes[`heading${level}`], `heading${level}` as NavigatorType);
    }
    links() {
        return this.getNavigationIterable(this.profile.modes.link, 'link');
    }
    landmarks() {
        return this.getNavigationIterable(this.profile.modes.landmark, 'landmark');
    }
    buttons() {
        return this.getNavigationIterable(this.profile.modes.button, 'button');
    }
    focusableElements() {
        return this.getNavigationIterable(this.profile.modes.focusable, 'focusable');
    }
    linearElements() {
        return this.getNavigationIterable(this.profile.modes.linear, 'linear');
    }

    /** Moves the cursor back to the start of the document. */
    async reset(): Promise<void> {
        await this.reader.press(this.profile.documentStart);
    }
}
