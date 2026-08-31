import type { ScreenReaderKeyBindings, ScreenReaderEndPatterns } from '../types';

/**
 * NVDA key bindings for navigation.
 * @see https://www.nvaccess.org/files/nvda/documentation/userGuide.html#BrowseMode
 * @see https://www.nvaccess.org/files/nvda/documentation/userGuide.html#SystemCaret
 * @see https://www.nvaccess.org/files/nvda/documentation/keyboardShortcuts.html
 */
export const nvdaKeyBindings: ScreenReaderKeyBindings = {
    nextHeading: 'h',
    nextHeadingLevel: (level: 1 | 2 | 3 | 4 | 5 | 6) => String(level),
    nextLink: 'k',
    nextLandmark: 'd',
    nextButton: 'b',
    tab: 'Tab',
    arrowDown: 'Down',
    documentStart: 'Control+Home',
};

export const nvdaEndPatterns: ScreenReaderEndPatterns = {
    heading: (ctx) => ctx.phrase.toLowerCase().includes('no next heading'),
    headingLevel: (ctx) => ctx.phrase.toLowerCase().includes('no next'),
    link: (ctx) => ctx.phrase.toLowerCase().includes('no next link'),
    landmark: (ctx) => ctx.phrase.toLowerCase().includes('no next landmark'),
    button: (ctx) => ctx.phrase.toLowerCase().includes('no next button'),
};
