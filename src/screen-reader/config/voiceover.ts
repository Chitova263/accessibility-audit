import type { ScreenReaderProfile } from '../types';
import { LoopGuard } from '../boundary-guards/loop-guard';
import { DocumentBoundaryGuard } from '../boundary-guards/document-boundary-guard';

/**
 * VoiceOver screen reader profile.
 * VO = Control+Option (VoiceOver modifier)
 *
 * VoiceOver behavior differs from NVDA:
 * - VoiceOver often wraps around to the beginning instead of announcing "no more X"
 * - VoiceOver may play a sound (a "bonk") when reaching boundaries
 * - Primary strategy is loop detection since VoiceOver wraps
 *
 * @see https://support.apple.com/guide/voiceover/cpvokys04/mac
 * @see https://dequeuniversity.com/screenreaders/voiceover-keyboard-shortcuts
 * @see https://support.apple.com/guide/voiceover/cursor-tracking-and-wrapping-vo27951/mac
 */
export const voiceOverProfile: ScreenReaderProfile = {
    modes: {
        // VO+Command+H = next heading
        heading: { key: 'Control+Option+Command+h', endDetector: new LoopGuard('focusedElementText') },
        // VoiceOver doesn't have direct heading level navigation keys like NVDA
        // Use the rotor for heading levels; fall back to general heading nav
        heading1: { key: 'Control+Option+Command+h', endDetector: new LoopGuard('focusedElementText') },
        heading2: { key: 'Control+Option+Command+h', endDetector: new LoopGuard('focusedElementText') },
        heading3: { key: 'Control+Option+Command+h', endDetector: new LoopGuard('focusedElementText') },
        heading4: { key: 'Control+Option+Command+h', endDetector: new LoopGuard('focusedElementText') },
        heading5: { key: 'Control+Option+Command+h', endDetector: new LoopGuard('focusedElementText') },
        heading6: { key: 'Control+Option+Command+h', endDetector: new LoopGuard('focusedElementText') },
        // VO+Command+L = next link
        link: { key: 'Control+Option+Command+l', endDetector: new LoopGuard('focusedElementText') },
        // VoiceOver uses rotor for landmarks, no direct key; using VO+Command+L as placeholder
        landmark: { key: 'Control+Option+Command+l', endDetector: new LoopGuard('focusedElementText') },
        // VO+Command+J = next form element (closest to "button")
        button: { key: 'Control+Option+Command+j', endDetector: new LoopGuard('focusedElementText') },
        focusable: { key: 'Tab', endDetector: new LoopGuard('focusedElementText') },
        // VO+Right = next item (linear navigation)
        linear: { key: 'Control+Option+Right', endDetector: new DocumentBoundaryGuard() },
    },
    // VO+Home or VO+Fn+Left = top of page
    documentStart: 'Control+Option+fn+Left',
};
