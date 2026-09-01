import type { ScreenReaderKeyBindings, ScreenReaderEndDetection } from '../types';

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

/**
 * NVDA end detection strategies.
 * NVDA announces "no next X" when there are no more elements of that type.
 */
export const nvdaEndDetection: ScreenReaderEndDetection = {
    heading: { type: 'phrase-contains', text: 'no next heading' },
    headingLevel: { type: 'phrase-contains', text: 'no next' },
    link: { type: 'phrase-contains', text: 'no next link' },
    landmark: { type: 'phrase-contains', text: 'no next landmark' },
    button: { type: 'phrase-contains', text: 'no next button' },
};
