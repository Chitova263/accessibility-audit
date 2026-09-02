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
        it('returns false when backendNodeId is present', () => {
            const strategy: EndDetectionStrategy = { type: 'document-boundary' };
            const detector = createEndDetector(strategy);

            expect(detector.check({ phrase: 'tool bar', itemText: '', backendNodeId: 12345 })).toBe(false);
        });

        it('detects "tool bar" when backendNodeId is null', () => {
            const strategy: EndDetectionStrategy = { type: 'document-boundary' };
            const detector = createEndDetector(strategy);

            expect(detector.check({ phrase: 'tool bar', itemText: '', backendNodeId: null })).toBe(true);
        });

        it('detects "toolbar" when backendNodeId is null', () => {
            const strategy: EndDetectionStrategy = { type: 'document-boundary' };
            const detector = createEndDetector(strategy);

            expect(detector.check({ phrase: 'Application toolbar', itemText: '', backendNodeId: null })).toBe(true);
        });

        it('detects "address bar" when backendNodeId is null', () => {
            const strategy: EndDetectionStrategy = { type: 'document-boundary' };
            const detector = createEndDetector(strategy);

            expect(detector.check({ phrase: 'address bar', itemText: '', backendNodeId: null })).toBe(true);
        });

        it('detects Chrome browser window', () => {
            const strategy: EndDetectionStrategy = { type: 'document-boundary' };
            const detector = createEndDetector(strategy);

            expect(
                detector.check({ phrase: 'My Page - Google Chrome, region', itemText: '', backendNodeId: null })
            ).toBe(true);
        });

        it('detects Firefox browser window', () => {
            const strategy: EndDetectionStrategy = { type: 'document-boundary' };
            const detector = createEndDetector(strategy);

            expect(detector.check({ phrase: 'My Page - Mozilla Firefox', itemText: '', backendNodeId: null })).toBe(
                true
            );
        });

        it('detects Edge browser window', () => {
            const strategy: EndDetectionStrategy = { type: 'document-boundary' };
            const detector = createEndDetector(strategy);

            expect(detector.check({ phrase: 'My Page - Microsoft Edge', itemText: '', backendNodeId: null })).toBe(
                true
            );
        });

        it('detects Safari browser window', () => {
            const strategy: EndDetectionStrategy = { type: 'document-boundary' };
            const detector = createEndDetector(strategy);

            expect(detector.check({ phrase: 'My Page - Safari', itemText: '', backendNodeId: null })).toBe(true);
        });

        it('detects Brave browser window', () => {
            const strategy: EndDetectionStrategy = { type: 'document-boundary' };
            const detector = createEndDetector(strategy);

            expect(detector.check({ phrase: 'My Page - Brave', itemText: '', backendNodeId: null })).toBe(true);
        });

        it('is case insensitive', () => {
            const strategy: EndDetectionStrategy = { type: 'document-boundary' };
            const detector = createEndDetector(strategy);

            expect(detector.check({ phrase: 'TOOL BAR', itemText: '', backendNodeId: null })).toBe(true);
        });

        it('returns false for page content phrases even with null backendNodeId', () => {
            const strategy: EndDetectionStrategy = { type: 'document-boundary' };
            const detector = createEndDetector(strategy);

            expect(detector.check({ phrase: 'Submit button', itemText: '', backendNodeId: null })).toBe(false);
        });

        it('supports additional patterns', () => {
            const strategy: EndDetectionStrategy = {
                type: 'document-boundary',
                additionalPatterns: ['custom browser'],
            };
            const detector = createEndDetector(strategy);

            expect(detector.check({ phrase: 'Custom Browser UI', itemText: '', backendNodeId: null })).toBe(true);
            expect(detector.check({ phrase: 'tool bar', itemText: '', backendNodeId: null })).toBe(true);
        });

        it('treats undefined backendNodeId as outside document', () => {
            const strategy: EndDetectionStrategy = { type: 'document-boundary' };
            const detector = createEndDetector(strategy);

            // undefined means not provided, should be treated same as null (outside document)
            expect(detector.check({ phrase: 'tool bar', itemText: '' })).toBe(true);
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
