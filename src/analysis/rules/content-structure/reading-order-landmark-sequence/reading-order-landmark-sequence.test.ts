import { describe, it, expect } from 'vitest';
import { rule } from './reading-order-landmark-sequence';
import { mockContext } from '../../test-fixtures';
import type { NavigationStep } from '../../../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';

const createStep = (
    index: number,
    overrides: Partial<{ itemText: string; spokenPhrases: string[]; role: string }> = {}
): NavigationStep => ({
    index,
    identifier: `step-${index}`,
    spokenPhrases: overrides.spokenPhrases ?? [overrides.itemText ?? `Item ${index}`],
    itemText: overrides.itemText ?? `Item ${index}`,
    itemTextLog: [],
    timestamp: 1_700_000_000_000 + index,
    axNode: overrides.role ? ({ nodeId: `${index}`, role: { value: overrides.role } } as never) : undefined,
    htmlSnippet: null,
});

const arrowResult = (navigationSteps: NavigationStep[]) =>
    mockContext([
        {
            meta: { name: 'arrow', description: 'Linear reading', mode: 'browse' },
            navigationSteps,
            completionReason: { kind: 'exhausted', detail: 'reached end of document' },
        },
    ]);

describe('reading-order-landmark-sequence rule', () => {
    it('has correct metadata', () => {
        expect(rule.id).toBe('reading-order-landmark-sequence');
        expect(rule.meta.impact).toBe('serious');
        expect(rule.meta.wcag.primary.criterion).toBe('1.3.2');
    });

    it('does not treat ordinary content containing landmark words as landmarks', async () => {
        const result = await rule.run(
            arrowResult([
                createStep(0, { itemText: 'Choose your domain name' }),
                createStep(1, { itemText: 'Park beside the entrance' }),
                createStep(2, { itemText: 'Scheduled maintenance tonight' }),
                createStep(3, { itemText: 'Read the footer notes below' }),
            ])
        );

        expect(result.stats!.landmarkSequence).toEqual([]);
        expect(result.violations).toHaveLength(0);
    });

    it('detects landmarks from spoken announcements', async () => {
        const result = await rule.run(
            arrowResult([
                createStep(0, { itemText: 'banner landmark' }),
                createStep(1, { itemText: 'main landmark' }),
                createStep(2, { itemText: 'content info landmark' }),
            ])
        );

        expect(result.stats!.landmarkSequence.map((l) => l.landmark)).toEqual(['banner', 'main', 'contentinfo']);
        expect(result.violations).toHaveLength(0);
    });

    it('reports contentinfo announced before main', async () => {
        const result = await rule.run(
            arrowResult([
                createStep(0, { itemText: 'content info landmark' }),
                createStep(1, { itemText: 'main landmark' }),
            ])
        );

        expect(result.stats!.hasMainBeforeFooter).toBe(false);
        expect(result.violations.map((v) => v.rule.id)).toEqual(['reading-order-landmark-sequence']);
    });

    it('reports complementary announced before main', async () => {
        const result = await rule.run(
            arrowResult([
                createStep(0, { itemText: 'complementary landmark' }),
                createStep(1, { itemText: 'main landmark' }),
            ])
        );

        expect(result.stats!.hasMainBeforeAside).toBe(false);
        expect(result.violations).toHaveLength(1);
    });

    it('skips analysis when no arrow strategy ran', async () => {
        const result = await rule.run(mockContext([]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.landmarkSequence).toEqual([]);
    });
});
