import { describe, it, expect } from 'vitest';
import { createEndDetector } from './end-detector';
import type { EndDetectionStrategy } from './types';

describe('createEndDetector', () => {
    describe('phrase-contains', () => {
        it('detects when phrase contains text (case insensitive by default)', () => {
            const strategy: EndDetectionStrategy = { type: 'phrase-contains', text: 'no next' };
            const detector = createEndDetector(strategy);

            expect(detector.check({ phrase: 'No Next Heading', focusedElementText: '' })).toBe(true);
            expect(detector.check({ phrase: 'Some heading', focusedElementText: '' })).toBe(false);
        });

        it('respects caseSensitive option', () => {
            const strategy: EndDetectionStrategy = { type: 'phrase-contains', text: 'No Next', caseSensitive: true };
            const detector = createEndDetector(strategy);

            expect(detector.check({ phrase: 'No Next Heading', focusedElementText: '' })).toBe(true);
            expect(detector.check({ phrase: 'no next heading', focusedElementText: '' })).toBe(false);
        });
    });

    describe('phrase-regex', () => {
        it('detects when phrase matches regex', () => {
            const strategy: EndDetectionStrategy = { type: 'phrase-regex', pattern: 'no (more|next)' };
            const detector = createEndDetector(strategy);

            expect(detector.check({ phrase: 'no next heading', focusedElementText: '' })).toBe(true);
            expect(detector.check({ phrase: 'no more links', focusedElementText: '' })).toBe(true);
            expect(detector.check({ phrase: 'some heading', focusedElementText: '' })).toBe(false);
        });

        it('respects flags option', () => {
            const strategy: EndDetectionStrategy = { type: 'phrase-regex', pattern: 'ERROR', flags: '' };
            const detector = createEndDetector(strategy);

            expect(detector.check({ phrase: 'ERROR found', focusedElementText: '' })).toBe(true);
            expect(detector.check({ phrase: 'error found', focusedElementText: '' })).toBe(false);
        });
    });

    describe('loop-detection', () => {
        it('detects when same phrase is seen twice', () => {
            const strategy: EndDetectionStrategy = { type: 'loop-detection' };
            const detector = createEndDetector(strategy);

            expect(detector.check({ phrase: 'heading 1', focusedElementText: '' })).toBe(false);
            expect(detector.check({ phrase: 'heading 2', focusedElementText: '' })).toBe(false);
            expect(detector.check({ phrase: 'heading 1', focusedElementText: '' })).toBe(true);
        });

        it('can use focusedElementText as key', () => {
            const strategy: EndDetectionStrategy = { type: 'loop-detection', key: 'focusedElementText' };
            const detector = createEndDetector(strategy);

            expect(detector.check({ phrase: 'different', focusedElementText: 'item 1' })).toBe(false);
            expect(detector.check({ phrase: 'different 2', focusedElementText: 'item 1' })).toBe(true);
        });

        it('resets state correctly', () => {
            const strategy: EndDetectionStrategy = { type: 'loop-detection' };
            const detector = createEndDetector(strategy);

            detector.check({ phrase: 'heading 1', focusedElementText: '' });
            detector.reset();
            expect(detector.check({ phrase: 'heading 1', focusedElementText: '' })).toBe(false);
        });
    });

    describe('document-boundary', () => {
        // DocumentBoundaryDetector uses two signals:
        // 1. document.hasFocus() === false (primary, language-agnostic)
        // 2. NVDA phrase patterns (fallback)

        describe('primary signal: documentHasFocus', () => {
            it('detects boundary when documentHasFocus is false', () => {
                const strategy: EndDetectionStrategy = { type: 'document-boundary' };
                const detector = createEndDetector(strategy);

                // documentHasFocus: false is the definitive signal that focus left the document
                expect(detector.check({ phrase: 'anything', focusedElementText: '', documentHasFocus: false })).toBe(
                    true
                );
            });

            it('does not trigger when documentHasFocus is true and no pattern match', () => {
                const strategy: EndDetectionStrategy = { type: 'document-boundary' };
                const detector = createEndDetector(strategy);

                expect(
                    detector.check({
                        phrase: 'Submit button',
                        focusedElementText: '',
                        documentHasFocus: true,
                        backendNodeId: 123,
                    })
                ).toBe(false);
            });

            it('detects boundary via pattern even when documentHasFocus is true (defense in depth)', () => {
                const strategy: EndDetectionStrategy = { type: 'document-boundary' };
                const detector = createEndDetector(strategy);

                // Pattern match should still trigger even if documentHasFocus reports true
                // (handles edge cases where hasFocus might be unreliable)
                expect(detector.check({ phrase: 'tool bar', focusedElementText: '', documentHasFocus: true })).toBe(
                    true
                );
            });
        });

        describe('fallback signal: phrase patterns', () => {
            it('detects "tool bar" even when backendNodeId is present', () => {
                const strategy: EndDetectionStrategy = { type: 'document-boundary' };
                const detector = createEndDetector(strategy);

                // backendNodeId may still be present (e.g., body element) when focus is on browser chrome
                expect(detector.check({ phrase: 'tool bar', focusedElementText: '', backendNodeId: 12345 })).toBe(true);
            });

            it('detects "tool bar" when documentHasFocus is undefined (not provided)', () => {
                const strategy: EndDetectionStrategy = { type: 'document-boundary' };
                const detector = createEndDetector(strategy);

                expect(detector.check({ phrase: 'tool bar', focusedElementText: '' })).toBe(true);
            });

            it('detects "toolbar" (no space)', () => {
                const strategy: EndDetectionStrategy = { type: 'document-boundary' };
                const detector = createEndDetector(strategy);

                expect(detector.check({ phrase: 'Application toolbar', focusedElementText: '' })).toBe(true);
            });

            it('detects "address bar"', () => {
                const strategy: EndDetectionStrategy = { type: 'document-boundary' };
                const detector = createEndDetector(strategy);

                expect(detector.check({ phrase: 'address bar', focusedElementText: '' })).toBe(true);
            });

            it('detects "address and search bar"', () => {
                const strategy: EndDetectionStrategy = { type: 'document-boundary' };
                const detector = createEndDetector(strategy);

                expect(detector.check({ phrase: 'address and search bar', focusedElementText: '' })).toBe(true);
            });

            it('detects Chrome browser window', () => {
                const strategy: EndDetectionStrategy = { type: 'document-boundary' };
                const detector = createEndDetector(strategy);

                expect(detector.check({ phrase: 'My Page - Google Chrome, region', focusedElementText: '' })).toBe(
                    true
                );
            });

            it('detects Firefox browser window', () => {
                const strategy: EndDetectionStrategy = { type: 'document-boundary' };
                const detector = createEndDetector(strategy);

                expect(detector.check({ phrase: 'My Page - Mozilla Firefox', focusedElementText: '' })).toBe(true);
            });

            it('detects Edge browser window', () => {
                const strategy: EndDetectionStrategy = { type: 'document-boundary' };
                const detector = createEndDetector(strategy);

                expect(detector.check({ phrase: 'My Page - Microsoft Edge', focusedElementText: '' })).toBe(true);
            });

            it('detects Safari browser window', () => {
                const strategy: EndDetectionStrategy = { type: 'document-boundary' };
                const detector = createEndDetector(strategy);

                expect(detector.check({ phrase: 'My Page - Safari', focusedElementText: '' })).toBe(true);
            });

            it('detects Brave browser window', () => {
                const strategy: EndDetectionStrategy = { type: 'document-boundary' };
                const detector = createEndDetector(strategy);

                expect(detector.check({ phrase: 'My Page - Brave', focusedElementText: '' })).toBe(true);
            });

            it('is case insensitive', () => {
                const strategy: EndDetectionStrategy = { type: 'document-boundary' };
                const detector = createEndDetector(strategy);

                expect(detector.check({ phrase: 'TOOL BAR', focusedElementText: '' })).toBe(true);
            });

            it('returns false for page content phrases when documentHasFocus is not false', () => {
                const strategy: EndDetectionStrategy = { type: 'document-boundary' };
                const detector = createEndDetector(strategy);

                expect(detector.check({ phrase: 'Submit button', focusedElementText: '' })).toBe(false);
                expect(detector.check({ phrase: 'Main navigation', focusedElementText: '' })).toBe(false);
                expect(detector.check({ phrase: 'Search input', focusedElementText: '' })).toBe(false);
            });

            it('supports additional patterns', () => {
                const strategy: EndDetectionStrategy = {
                    type: 'document-boundary',
                    additionalPatterns: ['custom browser'],
                };
                const detector = createEndDetector(strategy);

                expect(detector.check({ phrase: 'Custom Browser UI', focusedElementText: '' })).toBe(true);
                expect(detector.check({ phrase: 'tool bar', focusedElementText: '' })).toBe(true);
            });
        });
    });

    describe('any', () => {
        it('triggers when any sub-strategy matches', () => {
            const strategy: EndDetectionStrategy = {
                type: 'any',
                of: [
                    { type: 'phrase-contains', text: 'no next' },
                    { type: 'phrase-contains', text: 'end of' },
                ],
            };
            const detector = createEndDetector(strategy);

            expect(detector.check({ phrase: 'no next heading', focusedElementText: '' })).toBe(true);
            expect(detector.check({ phrase: 'end of list', focusedElementText: '' })).toBe(true);
            expect(detector.check({ phrase: 'some content', focusedElementText: '' })).toBe(false);
        });

        it('resets all sub-detectors', () => {
            const strategy: EndDetectionStrategy = {
                type: 'any',
                of: [{ type: 'loop-detection' }],
            };
            const detector = createEndDetector(strategy);

            detector.check({ phrase: 'item 1', focusedElementText: '' });
            detector.reset();
            expect(detector.check({ phrase: 'item 1', focusedElementText: '' })).toBe(false);
        });
    });
});
