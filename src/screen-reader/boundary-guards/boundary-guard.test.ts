import { describe, it, expect } from 'vitest';
import { PhraseContainsGuard } from './phrase-contains-guard';
import { PhraseRegexGuard } from './phrase-regex-guard';
import { LoopGuard } from './loop-guard';
import { DocumentBoundaryGuard } from './document-boundary-guard';
import { SilentGuard } from './silent-guard';
import { RepeatGuard } from './repeat-guard';
import { CompositeAnyGuard } from './composite-any-guard';

describe('NavigationEndDetector guards', () => {
    describe('PhraseContainsGuard', () => {
        it('returns false (no more) when phrase contains text (case insensitive by default)', () => {
            const detector = new PhraseContainsGuard('no next');

            expect(detector.hasNext({ phrase: 'No Next Heading', focusedElementText: '' })).toBe(false);
            expect(detector.hasNext({ phrase: 'Some heading', focusedElementText: '' })).toBe(true);
        });

        it('respects caseSensitive option', () => {
            const detector = new PhraseContainsGuard('No Next', true);

            expect(detector.hasNext({ phrase: 'No Next Heading', focusedElementText: '' })).toBe(false);
            expect(detector.hasNext({ phrase: 'no next heading', focusedElementText: '' })).toBe(true);
        });
    });

    describe('PhraseRegexGuard', () => {
        it('returns false (no more) when phrase matches regex', () => {
            const detector = new PhraseRegexGuard('no (more|next)');

            expect(detector.hasNext({ phrase: 'no next heading', focusedElementText: '' })).toBe(false);
            expect(detector.hasNext({ phrase: 'no more links', focusedElementText: '' })).toBe(false);
            expect(detector.hasNext({ phrase: 'some heading', focusedElementText: '' })).toBe(true);
        });

        it('respects flags option', () => {
            const detector = new PhraseRegexGuard('ERROR', '');

            expect(detector.hasNext({ phrase: 'ERROR found', focusedElementText: '' })).toBe(false);
            expect(detector.hasNext({ phrase: 'error found', focusedElementText: '' })).toBe(true);
        });
    });

    describe('LoopGuard', () => {
        it('returns false (no more) when same phrase is seen twice', () => {
            const detector = new LoopGuard('phrase');

            expect(detector.hasNext({ phrase: 'heading 1', focusedElementText: '' })).toBe(true);
            expect(detector.hasNext({ phrase: 'heading 2', focusedElementText: '' })).toBe(true);
            expect(detector.hasNext({ phrase: 'heading 1', focusedElementText: '' })).toBe(false);
        });

        it('can use focusedElementText as key', () => {
            const detector = new LoopGuard('focusedElementText');

            expect(detector.hasNext({ phrase: 'different', focusedElementText: 'item 1' })).toBe(true);
            expect(detector.hasNext({ phrase: 'different 2', focusedElementText: 'item 1' })).toBe(false);
        });

        it('resets state correctly', () => {
            const detector = new LoopGuard('phrase');

            detector.hasNext({ phrase: 'heading 1', focusedElementText: '' });
            detector.reset();
            expect(detector.hasNext({ phrase: 'heading 1', focusedElementText: '' })).toBe(true);
        });
    });

    describe('DocumentBoundaryGuard', () => {
        // DocumentBoundaryGuard uses two signals:
        // 1. document.hasFocus() === false (primary, language-agnostic)
        // 2. NVDA phrase patterns (fallback)

        describe('primary signal: documentHasFocus', () => {
            it('returns false (no more) when documentHasFocus is false', () => {
                const detector = new DocumentBoundaryGuard();

                // documentHasFocus: false is the definitive signal that focus left the document
                expect(detector.hasNext({ phrase: 'anything', focusedElementText: '', documentHasFocus: false })).toBe(
                    false
                );
            });

            it('returns true (has more) when documentHasFocus is true and no pattern match', () => {
                const detector = new DocumentBoundaryGuard();

                expect(
                    detector.hasNext({
                        phrase: 'Submit button',
                        focusedElementText: '',
                        documentHasFocus: true,
                        backendNodeId: 123,
                    })
                ).toBe(true);
            });

            it('returns false via pattern even when documentHasFocus is true (defense in depth)', () => {
                const detector = new DocumentBoundaryGuard();

                // Pattern match should still trigger even if documentHasFocus reports true
                // (handles edge cases where hasFocus might be unreliable)
                expect(detector.hasNext({ phrase: 'tool bar', focusedElementText: '', documentHasFocus: true })).toBe(
                    false
                );
            });
        });

        describe('fallback signal: phrase patterns', () => {
            // Patterns are the fallback when documentHasFocus is unavailable, so these are
            // checked without it. backendNodeId may still be present (e.g. the body element)
            // when focus has moved to browser chrome.
            it.each([
                ['tool bar', 'tool bar'],
                ['toolbar (no space)', 'Application toolbar'],
                ['case insensitive match', 'TOOL BAR'],
                ['address bar', 'address bar'],
                ['address and search bar', 'address and search bar'],
                ['Chrome window', 'My Page - Google Chrome, region'],
                ['Firefox window', 'My Page - Mozilla Firefox'],
                ['Edge window', 'My Page - Microsoft Edge'],
                ['Safari window', 'My Page - Safari'],
                ['Brave window', 'My Page - Brave'],
            ])('returns false (no more) for %s', (_label, phrase) => {
                const detector = new DocumentBoundaryGuard();

                expect(detector.hasNext({ phrase, focusedElementText: '', backendNodeId: 12345 })).toBe(false);
            });

            it('returns true (has more) for page content phrases when documentHasFocus is not false', () => {
                const detector = new DocumentBoundaryGuard();

                expect(detector.hasNext({ phrase: 'Submit button', focusedElementText: '' })).toBe(true);
                expect(detector.hasNext({ phrase: 'Main navigation', focusedElementText: '' })).toBe(true);
                expect(detector.hasNext({ phrase: 'Search input', focusedElementText: '' })).toBe(true);
            });

            it('supports additional patterns', () => {
                const detector = new DocumentBoundaryGuard(['custom browser']);

                expect(detector.hasNext({ phrase: 'Custom Browser UI', focusedElementText: '' })).toBe(false);
                expect(detector.hasNext({ phrase: 'tool bar', focusedElementText: '' })).toBe(false);
            });
        });
    });

    describe('SilentGuard', () => {
        it('returns false (no more) after N consecutive silent presses', () => {
            const detector = new SilentGuard(2);

            expect(detector.hasNext({ phrase: 'content', focusedElementText: '' })).toBe(true);
            expect(detector.hasNext({ phrase: '', focusedElementText: '' })).toBe(true); // 1st silent
            expect(detector.hasNext({ phrase: '', focusedElementText: '' })).toBe(false); // 2nd silent - exhausted
        });

        it('resets counter when speech occurs', () => {
            const detector = new SilentGuard(2);

            expect(detector.hasNext({ phrase: '', focusedElementText: '' })).toBe(true); // 1st silent
            expect(detector.hasNext({ phrase: 'content', focusedElementText: '' })).toBe(true); // resets
            expect(detector.hasNext({ phrase: '', focusedElementText: '' })).toBe(true); // 1st silent again
        });
    });

    describe('RepeatGuard', () => {
        it('returns false (no more) after same phrase repeats N times', () => {
            const detector = new RepeatGuard(3);

            expect(detector.hasNext({ phrase: 'item', focusedElementText: '' })).toBe(true); // 1st occurrence
            expect(detector.hasNext({ phrase: 'item', focusedElementText: '' })).toBe(true); // 1st repeat
            expect(detector.hasNext({ phrase: 'item', focusedElementText: '' })).toBe(true); // 2nd repeat
            expect(detector.hasNext({ phrase: 'item', focusedElementText: '' })).toBe(false); // 3rd repeat - exhausted
        });

        it('resets counter when phrase changes', () => {
            const detector = new RepeatGuard(3);

            expect(detector.hasNext({ phrase: 'item', focusedElementText: '' })).toBe(true);
            expect(detector.hasNext({ phrase: 'item', focusedElementText: '' })).toBe(true);
            expect(detector.hasNext({ phrase: 'different', focusedElementText: '' })).toBe(true); // resets
            expect(detector.hasNext({ phrase: 'item', focusedElementText: '' })).toBe(true); // starts over
        });
    });

    describe('CompositeAnyGuard', () => {
        it('returns false (no more) when any sub-guard returns false', () => {
            const detector = new CompositeAnyGuard([
                new PhraseContainsGuard('no next'),
                new PhraseContainsGuard('end of'),
            ]);

            expect(detector.hasNext({ phrase: 'no next heading', focusedElementText: '' })).toBe(false);
            expect(detector.hasNext({ phrase: 'end of list', focusedElementText: '' })).toBe(false);
            expect(detector.hasNext({ phrase: 'some content', focusedElementText: '' })).toBe(true);
        });

        it('resets all sub-detectors', () => {
            const detector = new CompositeAnyGuard([new LoopGuard('phrase')]);

            detector.hasNext({ phrase: 'item 1', focusedElementText: '' });
            detector.reset();
            expect(detector.hasNext({ phrase: 'item 1', focusedElementText: '' })).toBe(true);
        });
    });
});
