import type { ScreenReaderProfile } from '../types';
import { LoopGuard } from '../boundary-guards/loop-guard';

/**
 * Virtual screen reader profile.
 * Uses `__vsr:commandName` format which the driver translates to perform() calls.
 * Uses loop detection for end signals since the virtual reader wraps around.
 */
export const virtualProfile: ScreenReaderProfile = {
    modes: {
        heading: { key: '__vsr:moveToNextHeading', endDetector: new LoopGuard('phrase') },
        heading1: { key: '__vsr:moveToNextHeadingLevel1', endDetector: new LoopGuard('phrase') },
        heading2: { key: '__vsr:moveToNextHeadingLevel2', endDetector: new LoopGuard('phrase') },
        heading3: { key: '__vsr:moveToNextHeadingLevel3', endDetector: new LoopGuard('phrase') },
        heading4: { key: '__vsr:moveToNextHeadingLevel4', endDetector: new LoopGuard('phrase') },
        heading5: { key: '__vsr:moveToNextHeadingLevel5', endDetector: new LoopGuard('phrase') },
        heading6: { key: '__vsr:moveToNextHeadingLevel6', endDetector: new LoopGuard('phrase') },
        link: { key: '__vsr:moveToNextLink', endDetector: new LoopGuard('phrase') },
        landmark: { key: '__vsr:moveToNextLandmark', endDetector: new LoopGuard('phrase') },
        button: { key: '__vsr:moveToNextButton', endDetector: new LoopGuard('phrase') },
        focusable: { key: 'Tab', endDetector: new LoopGuard('phrase') },
        linear: { key: '__vsr:next', endDetector: new LoopGuard('phrase') },
    },
    documentStart: '__vsr:documentStart',
};
