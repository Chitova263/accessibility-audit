import type { ScreenReaderProfile } from '../types';
import { PhraseContainsGuard } from '../boundary-guards/phrase-contains-guard';
import { SilentGuard } from '../boundary-guards/silent-guard';
import { RepeatGuard } from '../boundary-guards/repeat-guard';
import { CompositeAnyGuard } from '../boundary-guards/composite-any-guard';
import { DocumentBoundaryGuard } from '../boundary-guards/document-boundary-guard';

/**
 * NVDA screen reader profile.
 *
 * @see https://www.nvaccess.org/files/nvda/documentation/userGuide.html#BrowseMode
 * @see https://www.nvaccess.org/files/nvda/documentation/userGuide.html#SystemCaret
 * @see https://www.nvaccess.org/files/nvda/documentation/keyboardShortcuts.html
 */
export const nvdaProfile: ScreenReaderProfile = {
    modes: {
        heading: {
            key: 'h',
            endDetector: new PhraseContainsGuard('no next heading'),
        },
        heading1: {
            key: '1',
            endDetector: new PhraseContainsGuard('no next'),
        },
        heading2: {
            key: '2',
            endDetector: new PhraseContainsGuard('no next'),
        },
        heading3: {
            key: '3',
            endDetector: new PhraseContainsGuard('no next'),
        },
        heading4: {
            key: '4',
            endDetector: new PhraseContainsGuard('no next'),
        },
        heading5: {
            key: '5',
            endDetector: new PhraseContainsGuard('no next'),
        },
        heading6: {
            key: '6',
            endDetector: new PhraseContainsGuard('no next'),
        },
        link: {
            key: 'k',
            endDetector: new PhraseContainsGuard('no next link'),
        },
        landmark: {
            key: 'd',
            endDetector: new PhraseContainsGuard('no next landmark'),
        },
        button: {
            key: 'b',
            endDetector: new PhraseContainsGuard('no next button'),
        },
        focusable: {
            key: 'Tab',
            endDetector: new DocumentBoundaryGuard(),
        },
        linear: {
            key: 'Down',
            endDetector: new CompositeAnyGuard([new SilentGuard(2), new RepeatGuard(30)]),
        },
    },
    documentStart: 'Control+Home',
};
