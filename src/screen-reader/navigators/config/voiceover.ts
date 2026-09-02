import type { ScreenReaderKeyBindings, ScreenReaderEndDetection } from '../types';

/**
 * VoiceOver key bindings for navigation.
 * VO = Control+Option (VoiceOver modifier)
 *
 * @see https://support.apple.com/guide/voiceover/cpvokys04/mac
 * @see https://dequeuniversity.com/screenreaders/voiceover-keyboard-shortcuts
 */
export const voiceOverKeyBindings: ScreenReaderKeyBindings = {
    // VO+Command+H = next heading
    nextHeading: 'Control+Option+Command+h',
    nextHeadingLevel: (level: 1 | 2 | 3 | 4 | 5 | 6) => {
        // VoiceOver doesn't have direct heading level navigation keys like NVDA
        // Use the rotor for heading levels; fall back to general heading nav
        return 'Control+Option+Command+h';
    },
    // VO+Command+L = next link
    nextLink: 'Control+Option+Command+l',
    // VoiceOver uses rotor for landmarks, no direct key; using VO+Command+L as placeholder
    // In practice, landmarks are navigated via the rotor (VO+U)
    nextLandmark: 'Control+Option+Command+l',
    // VO+Command+J = next form element (closest to "button")
    nextButton: 'Control+Option+Command+j',
    tab: 'Tab',
    // VO+Right = next item (linear navigation)
    arrowDown: 'Control+Option+Right',
    // VO+Home or VO+Fn+Left = top of page
    documentStart: 'Control+Option+fn+Left',
};

/**
 * VoiceOver end detection strategies.
 *
 * VoiceOver behavior differs from NVDA:
 * - VoiceOver often wraps around to the beginning instead of announcing "no more X"
 * - VoiceOver may play a sound (a "bonk") when reaching boundaries
 * - Primary strategy is loop detection since VoiceOver wraps
 *
 * @see https://support.apple.com/guide/voiceover/cursor-tracking-and-wrapping-vo27951/mac
 */
export const voiceOverEndDetection: ScreenReaderEndDetection = {
    // VoiceOver wraps around - detect loops
    heading: {
        type: 'loop-detection',
        key: 'itemText',
    },
    headingLevel: {
        type: 'loop-detection',
        key: 'itemText',
    },
    link: {
        type: 'loop-detection',
        key: 'itemText',
    },
    landmark: {
        type: 'loop-detection',
        key: 'itemText',
    },
    button: {
        type: 'loop-detection',
        key: 'itemText',
    },
    linear: {
        type: 'document-boundary',
    },
};
