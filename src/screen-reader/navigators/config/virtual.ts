import type { ScreenReaderKeyBindings, ScreenReaderEndDetection } from '../types';

/**
 * Virtual screen reader key bindings.
 * Uses `__vsr:commandName` format which the driver translates to perform() calls.
 */
export const virtualKeyBindings: ScreenReaderKeyBindings = {
    nextHeading: '__vsr:moveToNextHeading',
    nextHeadingLevel: (level: 1 | 2 | 3 | 4 | 5 | 6) => `__vsr:moveToNextHeadingLevel${level}`,
    nextLink: '__vsr:moveToNextLink',
    nextLandmark: '__vsr:moveToNextLandmark',
    nextButton: '__vsr:moveToNextButton',
    tab: 'Tab',
    arrowDown: '__vsr:next',
    documentStart: '__vsr:documentStart',
};

/**
 * Virtual screen reader end detection strategies.
 * Uses loop detection since the virtual reader wraps around instead of announcing "no next X".
 */
export const virtualEndDetection: ScreenReaderEndDetection = {
    heading: { type: 'loop-detection' },
    headingLevel: { type: 'loop-detection' },
    link: { type: 'loop-detection' },
    landmark: { type: 'loop-detection' },
    button: { type: 'loop-detection' },
    linear: { type: 'loop-detection' },
};
