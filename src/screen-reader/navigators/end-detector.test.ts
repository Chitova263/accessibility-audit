import { describe, it, expect } from 'vitest';
import { createEndDetector } from './end-detector';
import type { EndDetectionStrategy } from './types';

describe('createEndDetector', () => {
    describe('phrase-contains', () => {
        it('detects when phrase contains text (case insensitive by default)', () => {
            const strategy: EndDetectionStrategy = { type: 'phrase-contains', text: 'no next' };
            const detector = createEndDetector(strategy);

            expect(detector.check({ phrase: 'No Next Heading', itemText: '' })).toBe(true);
            expect(detector.check({ phrase: 'Some heading', itemText: '' })).toBe(false);
        });

        it('respects caseSensitive option', () => {
            const strategy: EndDetectionStrategy = { type: 'phrase-contains', text: 'No Next', caseSensitive: true };
            const detector = createEndDetector(strategy);

            expect(detector.check({ phrase: 'No Next Heading', itemText: '' })).toBe(true);
            expect(detector.check({ phrase: 'no next heading', itemText: '' })).toBe(false);
        });
    });

    describe('phrase-regex', () => {
        it('detects when phrase matches regex', () => {
            const strategy: EndDetectionStrategy = { type: 'phrase-regex', pattern: 'no (more|next)' };
            const detector = createEndDetector(strategy);

            expect(detector.check({ phrase: 'no next heading', itemText: '' })).toBe(true);
            expect(detector.check({ phrase: 'no more links', itemText: '' })).toBe(true);
            expect(detector.check({ phrase: 'some heading', itemText: '' })).toBe(false);
        });

        it('respects flags option', () => {
            const strategy: EndDetectionStrategy = { type: 'phrase-regex', pattern: 'ERROR', flags: '' };
            const detector = createEndDetector(strategy);

            expect(detector.check({ phrase: 'ERROR found', itemText: '' })).toBe(true);
            expect(detector.check({ phrase: 'error found', itemText: '' })).toBe(false);
        });
    });

    describe('loop-detection', () => {
        it('detects when same phrase is seen twice', () => {
            const strategy: EndDetectionStrategy = { type: 'loop-detection' };
            const detector = createEndDetector(strategy);

            expect(detector.check({ phrase: 'heading 1', itemText: '' })).toBe(false);
            expect(detector.check({ phrase: 'heading 2', itemText: '' })).toBe(false);
            expect(detector.check({ phrase: 'heading 1', itemText: '' })).toBe(true);
        });

        it('can use itemText as key', () => {
            const strategy: EndDetectionStrategy = { type: 'loop-detection', key: 'itemText' };
            const detector = createEndDetector(strategy);

            expect(detector.check({ phrase: 'different', itemText: 'item 1' })).toBe(false);
            expect(detector.check({ phrase: 'different 2', itemText: 'item 1' })).toBe(true);
        });

        it('resets state correctly', () => {
            const strategy: EndDetectionStrategy = { type: 'loop-detection' };
            const detector = createEndDetector(strategy);

            detector.check({ phrase: 'heading 1', itemText: '' });
            detector.reset();
            expect(detector.check({ phrase: 'heading 1', itemText: '' })).toBe(false);
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
                expect(detector.check({ phrase: 'anything', itemText: '', documentHasFocus: false })).toBe(true);
            });

            it('does not trigger when documentHasFocus is true and no pattern match', () => {
                const strategy: EndDetectionStrategy = { type: 'document-boundary' };
                const detector = createEndDetector(strategy);

                expect(
                    detector.check({
                        phrase: 'Submit button',
                        itemText: '',
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
                expect(detector.check({ phrase: 'tool bar', itemText: '', documentHasFocus: true })).toBe(true);
            });
        });

        describe('fallback signal: phrase patterns', () => {
            it('detects "tool bar" even when backendNodeId is present', () => {
                const strategy: EndDetectionStrategy = { type: 'document-boundary' };
                const detector = createEndDetector(strategy);

                // backendNodeId may still be present (e.g., body element) when focus is on browser chrome
                expect(detector.check({ phrase: 'tool bar', itemText: '', backendNodeId: 12345 })).toBe(true);
            });

            it('detects "tool bar" when documentHasFocus is undefined (not provided)', () => {
                const strategy: EndDetectionStrategy = { type: 'document-boundary' };
                const detector = createEndDetector(strategy);

                expect(detector.check({ phrase: 'tool bar', itemText: '' })).toBe(true);
            });

            it('detects "toolbar" (no space)', () => {
                const strategy: EndDetectionStrategy = { type: 'document-boundary' };
                const detector = createEndDetector(strategy);

                expect(detector.check({ phrase: 'Application toolbar', itemText: '' })).toBe(true);
            });

            it('detects "address bar"', () => {
                const strategy: EndDetectionStrategy = { type: 'document-boundary' };
                const detector = createEndDetector(strategy);

                expect(detector.check({ phrase: 'address bar', itemText: '' })).toBe(true);
            });

            it('detects "address and search bar"', () => {
                const strategy: EndDetectionStrategy = { type: 'document-boundary' };
                const detector = createEndDetector(strategy);

                expect(detector.check({ phrase: 'address and search bar', itemText: '' })).toBe(true);
            });

            it('detects Chrome browser window', () => {
                const strategy: EndDetectionStrategy = { type: 'document-boundary' };
                const detector = createEndDetector(strategy);

                expect(detector.check({ phrase: 'My Page - Google Chrome, region', itemText: '' })).toBe(true);
            });

            it('detects Firefox browser window', () => {
                const strategy: EndDetectionStrategy = { type: 'document-boundary' };
                const detector = createEndDetector(strategy);

                expect(detector.check({ phrase: 'My Page - Mozilla Firefox', itemText: '' })).toBe(true);
            });

            it('detects Edge browser window', () => {
                const strategy: EndDetectionStrategy = { type: 'document-boundary' };
                const detector = createEndDetector(strategy);

                expect(detector.check({ phrase: 'My Page - Microsoft Edge', itemText: '' })).toBe(true);
            });

            it('detects Safari browser window', () => {
                const strategy: EndDetectionStrategy = { type: 'document-boundary' };
                const detector = createEndDetector(strategy);

                expect(detector.check({ phrase: 'My Page - Safari', itemText: '' })).toBe(true);
            });

            it('detects Brave browser window', () => {
                const strategy: EndDetectionStrategy = { type: 'document-boundary' };
                const detector = createEndDetector(strategy);

                expect(detector.check({ phrase: 'My Page - Brave', itemText: '' })).toBe(true);
            });

            it('is case insensitive', () => {
                const strategy: EndDetectionStrategy = { type: 'document-boundary' };
                const detector = createEndDetector(strategy);

                expect(detector.check({ phrase: 'TOOL BAR', itemText: '' })).toBe(true);
            });

            it('returns false for page content phrases when documentHasFocus is not false', () => {
                const strategy: EndDetectionStrategy = { type: 'document-boundary' };
                const detector = createEndDetector(strategy);

                expect(detector.check({ phrase: 'Submit button', itemText: '' })).toBe(false);
                expect(detector.check({ phrase: 'Main navigation', itemText: '' })).toBe(false);
                expect(detector.check({ phrase: 'Search input', itemText: '' })).toBe(false);
            });

            it('supports additional patterns', () => {
                const strategy: EndDetectionStrategy = {
                    type: 'document-boundary',
                    additionalPatterns: ['custom browser'],
                };
                const detector = createEndDetector(strategy);

                expect(detector.check({ phrase: 'Custom Browser UI', itemText: '' })).toBe(true);
                expect(detector.check({ phrase: 'tool bar', itemText: '' })).toBe(true);
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

            expect(detector.check({ phrase: 'no next heading', itemText: '' })).toBe(true);
            expect(detector.check({ phrase: 'end of list', itemText: '' })).toBe(true);
            expect(detector.check({ phrase: 'some content', itemText: '' })).toBe(false);
        });

        it('resets all sub-detectors', () => {
            const strategy: EndDetectionStrategy = {
                type: 'any',
                of: [{ type: 'loop-detection' }],
            };
            const detector = createEndDetector(strategy);

            detector.check({ phrase: 'item 1', itemText: '' });
            detector.reset();
            expect(detector.check({ phrase: 'item 1', itemText: '' })).toBe(false);
        });
    });
});
