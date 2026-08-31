import type { ScreenReader } from '../drivers/nvda';
import type { IElementNavigator, ScreenReaderKeyBindings, ScreenReaderEndPatterns } from './types';
import { ElementNavigator } from './element-navigator/element-navigator';
import { TabNavigator } from './tab-navigator/tab-navigator';
import { ArrowNavigator } from './arrow-navigator/arrow-navigator';

export class Navigator {
    constructor(
        private readonly sr: ScreenReader,
        private readonly keyBindings: ScreenReaderKeyBindings,
        private readonly endDetection: ScreenReaderEndPatterns
    ) {}

    static fromConfig(config: {
        reader: ScreenReader;
        keyBindings: ScreenReaderKeyBindings;
        endDetection: ScreenReaderEndPatterns;
    }): Navigator {
        return new Navigator(config.reader, config.keyBindings, config.endDetection);
    }

    headings(): IElementNavigator {
        return new ElementNavigator(
            this.sr,
            {
                advanceKey: this.keyBindings.nextHeading,
                isComplete: this.endDetection.heading,
            },
            'heading'
        );
    }

    headingsLevel1(): IElementNavigator {
        return this.headingsLevel(1);
    }

    headingsLevel2(): IElementNavigator {
        return this.headingsLevel(2);
    }

    headingsLevel3(): IElementNavigator {
        return this.headingsLevel(3);
    }

    headingsLevel4(): IElementNavigator {
        return this.headingsLevel(4);
    }

    headingsLevel5(): IElementNavigator {
        return this.headingsLevel(5);
    }

    headingsLevel6(): IElementNavigator {
        return this.headingsLevel(6);
    }

    headingsLevel(level: 1 | 2 | 3 | 4 | 5 | 6): IElementNavigator {
        const typeMap = {
            1: 'heading1',
            2: 'heading2',
            3: 'heading3',
            4: 'heading4',
            5: 'heading5',
            6: 'heading6',
        } as const;

        return new ElementNavigator(
            this.sr,
            {
                advanceKey: this.keyBindings.nextHeadingLevel(level),
                isComplete: this.endDetection.headingLevel,
            },
            typeMap[level]
        );
    }

    links(): IElementNavigator {
        return new ElementNavigator(
            this.sr,
            {
                advanceKey: this.keyBindings.nextLink,
                isComplete: this.endDetection.link,
            },
            'link'
        );
    }

    landmarks(): IElementNavigator {
        return new ElementNavigator(
            this.sr,
            {
                advanceKey: this.keyBindings.nextLandmark,
                isComplete: this.endDetection.landmark,
            },
            'landmark'
        );
    }

    buttons(): IElementNavigator {
        return new ElementNavigator(
            this.sr,
            {
                advanceKey: this.keyBindings.nextButton,
                isComplete: this.endDetection.button,
            },
            'button'
        );
    }

    focusableElements(): IElementNavigator {
        return new TabNavigator(this.sr, this.keyBindings.tab);
    }

    linearElements(): IElementNavigator {
        return new ArrowNavigator(this.sr, this.keyBindings.arrowDown);
    }

    async navigateToDocumentStart(): Promise<void> {
        await this.sr.press(this.keyBindings.documentStart);
    }
}
