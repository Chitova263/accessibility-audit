import type { ScreenReader } from '../drivers/nvda';
import type { ElementNavigator, ScreenReaderKeyBindings, ScreenReaderEndDetection } from './types';
import { BrowseModeElementNavigator } from './element-navigator/element-navigator';
import { TabNavigator } from './tab-navigator/tab-navigator';
import { DownArrowNavigator } from './down-arrow-navigator/down-arrow-navigator';
import { createEndDetector } from './end-detector';

export class Navigator {
    constructor(
        private readonly sr: ScreenReader,
        private readonly keyBindings: ScreenReaderKeyBindings,
        private readonly endDetection: ScreenReaderEndDetection
    ) {}

    static fromConfig(config: {
        reader: ScreenReader;
        keyBindings: ScreenReaderKeyBindings;
        endDetection: ScreenReaderEndDetection;
    }): Navigator {
        return new Navigator(config.reader, config.keyBindings, config.endDetection);
    }

    headings(): ElementNavigator {
        return new BrowseModeElementNavigator(
            this.sr,
            {
                advanceKey: this.keyBindings.nextHeading,
                endDetector: createEndDetector(this.endDetection.heading),
            },
            'heading'
        );
    }

    headingsLevel1(): ElementNavigator {
        return this.headingsLevel(1);
    }

    headingsLevel2(): ElementNavigator {
        return this.headingsLevel(2);
    }

    headingsLevel3(): ElementNavigator {
        return this.headingsLevel(3);
    }

    headingsLevel4(): ElementNavigator {
        return this.headingsLevel(4);
    }

    headingsLevel5(): ElementNavigator {
        return this.headingsLevel(5);
    }

    headingsLevel6(): ElementNavigator {
        return this.headingsLevel(6);
    }

    headingsLevel(level: 1 | 2 | 3 | 4 | 5 | 6): ElementNavigator {
        const typeMap = {
            1: 'heading1',
            2: 'heading2',
            3: 'heading3',
            4: 'heading4',
            5: 'heading5',
            6: 'heading6',
        } as const;

        return new BrowseModeElementNavigator(
            this.sr,
            {
                advanceKey: this.keyBindings.nextHeadingLevel(level),
                endDetector: createEndDetector(this.endDetection.headingLevel),
            },
            typeMap[level]
        );
    }

    links(): ElementNavigator {
        return new BrowseModeElementNavigator(
            this.sr,
            {
                advanceKey: this.keyBindings.nextLink,
                endDetector: createEndDetector(this.endDetection.link),
            },
            'link'
        );
    }

    landmarks(): ElementNavigator {
        return new BrowseModeElementNavigator(
            this.sr,
            {
                advanceKey: this.keyBindings.nextLandmark,
                endDetector: createEndDetector(this.endDetection.landmark),
            },
            'landmark'
        );
    }

    buttons(): ElementNavigator {
        return new BrowseModeElementNavigator(
            this.sr,
            {
                advanceKey: this.keyBindings.nextButton,
                endDetector: createEndDetector(this.endDetection.button),
            },
            'button'
        );
    }

    focusableElements(): ElementNavigator {
        return new TabNavigator(this.sr, this.keyBindings.tab);
    }

    linearElements(): ElementNavigator {
        const endDetector = this.endDetection.linear ? createEndDetector(this.endDetection.linear) : undefined;
        return new DownArrowNavigator(this.sr, this.keyBindings.arrowDown, 30, endDetector);
    }

    async navigateToDocumentStart(): Promise<void> {
        await this.sr.press(this.keyBindings.documentStart);
    }
}
