import { describe, it, expect } from 'vitest';
import { ExcessiveBlankAnnouncementsRule } from './excessive-blank-announcements';
import { mockContext } from '../../test-fixtures';
import type { NavigationStep } from '../../../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';

const rule = new ExcessiveBlankAnnouncementsRule();

const createStep = (index: number, itemText: string): NavigationStep => ({
    index,
    identifier: `step-${index}`,
    spokenPhrases: [itemText],
    itemText,
    itemTextLog: [],
    timestamp: 1_700_000_000_000 + index,
    axNode: undefined,
    htmlSnippet: null,
});

const arrowResult = (navigationSteps: NavigationStep[]) =>
    mockContext([
        {
            meta: { name: 'arrow', description: 'Linear reading', type: 'arrow', mode: 'browse' },
            navigationSteps,
            completionReason: { kind: 'exhausted', detail: 'reached end of document' },
        },
    ]);

describe('excessive-blank-announcements rule', () => {
    it('has correct metadata', () => {
        expect(rule.id).toBe('excessive-blank-announcements');
        expect(rule.meta.impact).toBe('moderate');
        expect(rule.meta.wcag.primary.criterion).toBe('1.3.1');
    });

    it('tolerates short runs of blanks', async () => {
        const steps = [
            createStep(0, 'Some content'),
            createStep(1, 'blank'),
            createStep(2, 'blank'),
            createStep(3, 'blank'),
            createStep(4, 'More content'),
        ];

        const result = await rule.run(arrowResult(steps));

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.threshold).toBe(5);
    });

    it('reports runs that reach the threshold', async () => {
        const steps = [
            createStep(0, 'Before'),
            ...Array.from({ length: 6 }, (_, i) => createStep(i + 1, 'blank')),
            createStep(7, 'After'),
        ];

        const result = await rule.run(arrowResult(steps));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]!.message).toContain('6 consecutive blank announcements');
        expect(result.violations[0]!.message).toContain('after "Before"');
        expect(result.violations[0]!.message).toContain('before "After"');
    });

    it('detects "out of list, blank" as a blank', async () => {
        const steps = [
            createStep(0, 'link, Mobile subscriptions'),
            createStep(1, 'out of list, blank'),
            ...Array.from({ length: 5 }, (_, i) => createStep(i + 2, 'blank')),
            createStep(7, 'Safe and unlimited'),
        ];

        const result = await rule.run(arrowResult(steps));

        expect(result.violations).toHaveLength(1);
        expect(result.stats!.blankRuns[0]!.count).toBe(6);
    });

    it('honours a custom threshold', async () => {
        const steps = [
            createStep(0, 'Before'),
            createStep(1, 'blank'),
            createStep(2, 'blank'),
            createStep(3, 'blank'),
            createStep(4, 'After'),
        ];
        const customRule = new ExcessiveBlankAnnouncementsRule({ threshold: 3 });

        const result = await customRule.run(arrowResult(steps));

        expect(result.violations).toHaveLength(1);
    });

    it('handles blanks at end of navigation', async () => {
        const steps = [createStep(0, 'Content'), ...Array.from({ length: 5 }, (_, i) => createStep(i + 1, 'blank'))];

        const result = await rule.run(arrowResult(steps));

        expect(result.violations).toHaveLength(1);
        expect(result.stats!.blankRuns[0]!.afterContext).toBeNull();
    });

    it('handles multiple separate blank runs', async () => {
        const steps = [
            createStep(0, 'Section 1'),
            ...Array.from({ length: 5 }, (_, i) => createStep(i + 1, 'blank')),
            createStep(6, 'Section 2'),
            ...Array.from({ length: 6 }, (_, i) => createStep(i + 7, 'blank')),
            createStep(13, 'Section 3'),
        ];

        const result = await rule.run(arrowResult(steps));

        expect(result.violations).toHaveLength(2);
        expect(result.stats!.blankRuns[0]!.count).toBe(5);
        expect(result.stats!.blankRuns[1]!.count).toBe(6);
    });

    it('skips analysis when no arrow strategy ran', async () => {
        const result = await rule.run(mockContext([]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.blankRuns).toEqual([]);
    });
});
