import {
    type CommandOptions,
    type IScreenReader as IGuidepupScreenReader,
    type StartOptions,
} from '@guidepup/guidepup';

export interface NavigationItem {
    /** The phrase spoken by the screen reader */
    phrase: string;
    /** The accessible text of the current item */
    itemText: string;
}

export interface IScreenReader {
    // Lifecycle
    start(options?: StartOptions): Promise<void>;
    stop(options?: CommandOptions): Promise<void>;
    navigateToDocumentStart(options?: CommandOptions): Promise<void>;

    // State
    lastSpokenPhrase(): Promise<string>;
    itemText(): Promise<string>;
    spokenPhraseLog(): Promise<string[]>;
    clearSpokenPhraseLog(): Promise<void>;
    itemTextLog(): Promise<string[]>;
    clearItemTextLog(): Promise<void>;

    // Iterators each handles its own end detection
    headings(): AsyncIterableIterator<NavigationItem>;
    headingsLevel1(): AsyncIterableIterator<NavigationItem>;
    headingsLevel2(): AsyncIterableIterator<NavigationItem>;
    headingsLevel3(): AsyncIterableIterator<NavigationItem>;
    headingsLevel4(): AsyncIterableIterator<NavigationItem>;
    headingsLevel5(): AsyncIterableIterator<NavigationItem>;
    headingsLevel6(): AsyncIterableIterator<NavigationItem>;
    links(): AsyncIterableIterator<NavigationItem>;
    landmarks(): AsyncIterableIterator<NavigationItem>;
    buttons(): AsyncIterableIterator<NavigationItem>;
    focusableElements(): AsyncIterableIterator<NavigationItem>;
    arrowElements(): AsyncIterableIterator<NavigationItem>;
}

export function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Abstract base class for real screen readers (NVDA, VoiceOver).
 */
export abstract class ScreenReader implements IScreenReader {
    protected constructor(public readonly sr: IGuidepupScreenReader) {}

    // --- Lifecycle ---
    public abstract start(options?: StartOptions): Promise<void>;

    public stop(options?: CommandOptions): Promise<void> {
        return this.sr.stop(options);
    }

    // --- Low-level navigation ---

    private nextHeading(options?: CommandOptions): Promise<void> {
        return this.sr.nextHeading(options);
    }

    private nextHeadingLevel1(options?: CommandOptions): Promise<void> {
        return this.sr.press('1', options);
    }

    private nextHeadingLevel2(options?: CommandOptions): Promise<void> {
        return this.sr.press('2', options);
    }

    private nextHeadingLevel3(options?: CommandOptions): Promise<void> {
        return this.sr.press('3', options);
    }

    private nextHeadingLevel4(options?: CommandOptions): Promise<void> {
        return this.sr.press('4', options);
    }

    private nextHeadingLevel5(options?: CommandOptions): Promise<void> {
        return this.sr.press('5', options);
    }

    private nextHeadingLevel6(options?: CommandOptions): Promise<void> {
        return this.sr.press('6', options);
    }

    private nextLink(options?: CommandOptions): Promise<void> {
        return this.sr.nextLink(options);
    }

    private nextLandmark(options?: CommandOptions): Promise<void> {
        return this.sr.nextLandmark(options);
    }

    private nextButton(options?: CommandOptions): Promise<void> {
        return this.sr.press('b', options);
    }

    private press(key: string, options?: CommandOptions): Promise<void> {
        return this.sr.press(key, options);
    }

    private pressTab(options?: CommandOptions): Promise<void> {
        return this.sr.press('Tab', options);
    }

    public abstract navigateToDocumentStart(options?: CommandOptions): Promise<void>;

    // --- State ---

    public lastSpokenPhrase(): Promise<string> {
        return this.sr.lastSpokenPhrase();
    }

    public itemText(): Promise<string> {
        return this.sr.itemText();
    }

    public spokenPhraseLog(): Promise<string[]> {
        return this.sr.spokenPhraseLog();
    }

    public clearSpokenPhraseLog(): Promise<void> {
        return this.sr.clearSpokenPhraseLog();
    }

    public itemTextLog(): Promise<string[]> {
        return this.sr.itemTextLog();
    }

    public clearItemTextLog(): Promise<void> {
        return this.sr.clearItemTextLog();
    }

    // --- High-level iterators ---
    async *headings(): AsyncIterableIterator<NavigationItem> {
        while (true) {
            await this.nextHeading();
            const phrase = await this.lastSpokenPhrase();
            if (phrase.toLowerCase().includes('no next heading')) return;
            yield { phrase, itemText: await this.itemText() };
        }
    }

    async *headingsLevel1(): AsyncIterableIterator<NavigationItem> {
        while (true) {
            await this.nextHeadingLevel1();
            const phrase = await this.lastSpokenPhrase();
            if (phrase.toLowerCase().includes('no next')) return;
            yield { phrase, itemText: await this.itemText() };
        }
    }

    async *headingsLevel2(): AsyncIterableIterator<NavigationItem> {
        while (true) {
            await this.nextHeadingLevel2();
            const phrase = await this.lastSpokenPhrase();
            if (phrase.toLowerCase().includes('no next')) return;
            yield { phrase, itemText: await this.itemText() };
        }
    }

    async *headingsLevel3(): AsyncIterableIterator<NavigationItem> {
        while (true) {
            await this.nextHeadingLevel3();
            const phrase = await this.lastSpokenPhrase();
            if (phrase.toLowerCase().includes('no next')) return;
            yield { phrase, itemText: await this.itemText() };
        }
    }

    async *headingsLevel4(): AsyncIterableIterator<NavigationItem> {
        while (true) {
            await this.nextHeadingLevel4();
            const phrase = await this.lastSpokenPhrase();
            if (phrase.toLowerCase().includes('no next')) return;
            yield { phrase, itemText: await this.itemText() };
        }
    }

    async *headingsLevel5(): AsyncIterableIterator<NavigationItem> {
        while (true) {
            await this.nextHeadingLevel5();
            const phrase = await this.lastSpokenPhrase();
            if (phrase.toLowerCase().includes('no next')) return;
            yield { phrase, itemText: await this.itemText() };
        }
    }

    async *headingsLevel6(): AsyncIterableIterator<NavigationItem> {
        while (true) {
            await this.nextHeadingLevel6();
            const phrase = await this.lastSpokenPhrase();
            if (phrase.toLowerCase().includes('no next')) return;
            yield { phrase, itemText: await this.itemText() };
        }
    }

    async *links(): AsyncIterableIterator<NavigationItem> {
        while (true) {
            await this.nextLink();
            const phrase = await this.lastSpokenPhrase();
            if (phrase.toLowerCase().includes('no next link')) return;
            yield { phrase, itemText: await this.itemText() };
        }
    }

    async *landmarks(): AsyncIterableIterator<NavigationItem> {
        while (true) {
            await this.nextLandmark();
            const phrase = await this.lastSpokenPhrase();
            if (phrase.toLowerCase().includes('no next landmark')) return;
            yield { phrase, itemText: await this.itemText() };
        }
    }

    async *buttons(): AsyncIterableIterator<NavigationItem> {
        while (true) {
            await this.nextButton();
            const phrase = await this.lastSpokenPhrase();
            if (phrase.toLowerCase().includes('no next button')) return;
            yield { phrase, itemText: await this.itemText() };
        }
    }

    async *focusableElements(): AsyncIterableIterator<NavigationItem> {
        // Tab navigation: detect when we cycle back to the first element
        await this.pressTab();
        const firstPhrase = await this.lastSpokenPhrase();
        yield { phrase: firstPhrase, itemText: await this.itemText() };

        while (true) {
            await this.pressTab();
            const phrase = await this.lastSpokenPhrase();
            if (phrase === firstPhrase) return; // cycled back
            yield { phrase, itemText: await this.itemText() };
        }
    }

    async *arrowElements(): AsyncIterableIterator<NavigationItem> {
        // Arrow navigation: detect end by repeated content (same phrase N times)
        const maxSameContent = 3;
        let previousPhrase = '';
        let sameContentCount = 0;

        while (true) {
            await this.press('Down');
            const phrase = await this.lastSpokenPhrase();
            const itemText = await this.itemText();

            // Detect end of document (same content repeated)
            if (phrase === previousPhrase && phrase !== '') {
                sameContentCount++;
                if (sameContentCount >= maxSameContent) return;
            } else {
                sameContentCount = 0;
            }
            previousPhrase = phrase;

            // Skip empty announcements but don't yield them
            if (!itemText && !phrase) continue;

            yield { phrase, itemText };
        }
    }
}
