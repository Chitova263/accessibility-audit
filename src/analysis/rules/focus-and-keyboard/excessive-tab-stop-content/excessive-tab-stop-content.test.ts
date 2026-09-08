import { describe, it, expect } from 'vitest';
import { rule } from './excessive-tab-stop-content';
import { createSteps, strategyResult, mockContext } from '../../test-fixtures';

describe('excessive-tab-stop-content rule', () => {
    it('flags a tab stop exceeding 500 characters', async () => {
        const longSpoken = 'This is a carousel with many items. '.repeat(20); // ~720 chars
        const steps = createSteps([
            { focusedElementText: 'Home', spokenPhrases: ['Home link'] },
            { focusedElementText: 'Carousel', spokenPhrases: [longSpoken], htmlSnippet: '<div tabindex="0">' },
            { focusedElementText: 'Contact', spokenPhrases: ['Contact link'] },
        ]);

        const result = await rule.run(mockContext([strategyResult('tab', steps)]));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]!.rule.id).toBe('excessive-tab-stop-content');
        expect(result.violations[0]!.message).toContain('characters');
        expect(result.violations[0]!.message).toContain('threshold: 500');
        expect(result.stats!.maxSpokenLength).toBeGreaterThan(500);
    });

    it('flags a tab stop with 3+ headings', async () => {
        const steps = createSteps([
            {
                focusedElementText: 'Widget',
                spokenPhrases: [
                    'Widget container',
                    'heading, level 2, Section A',
                    'Some content',
                    'heading, level 3, Sub A',
                    'More content',
                    'heading, level 3, Sub B',
                ],
            },
        ]);

        const result = await rule.run(mockContext([strategyResult('tab', steps)]));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]!.message).toContain('3 headings');
        expect(result.violations[0]!.message).toContain('threshold: 2');
        expect(result.stats!.maxHeadingsInStep).toBe(3);
    });

    it('flags a tab stop with 3+ buttons', async () => {
        const steps = createSteps([
            {
                focusedElementText: 'Card grid',
                spokenPhrases: ['Card 1, button, Add to cart, button, Wishlist, button'],
            },
        ]);

        const result = await rule.run(mockContext([strategyResult('tab', steps)]));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]!.message).toContain('3 buttons');
        expect(result.violations[0]!.message).toContain('threshold: 2');
        expect(result.stats!.maxButtonsInStep).toBe(3);
    });

    it('does not flag normal tab stops', async () => {
        const steps = createSteps([
            { focusedElementText: 'Home', spokenPhrases: ['Home link'] },
            { focusedElementText: 'Buy now', spokenPhrases: ['Buy now button'] },
            { focusedElementText: 'Newsletter', spokenPhrases: ['Newsletter, heading, level 2, Email textbox'] },
        ]);

        const result = await rule.run(mockContext([strategyResult('tab', steps)]));

        expect(result.violations).toHaveLength(0);
    });

    it('ignores non-tab strategies', async () => {
        const longSpoken = 'A'.repeat(600);
        const steps = createSteps([{ focusedElementText: 'Long', spokenPhrases: [longSpoken] }]);

        const result = await rule.run(mockContext([strategyResult('arrow', steps)]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.tabStepsChecked).toBe(0);
    });

    it('reports multiple violations for multiple excessive tab stops', async () => {
        const longSpoken = 'B'.repeat(600);
        const steps = createSteps([
            { focusedElementText: 'First', spokenPhrases: [longSpoken] },
            { focusedElementText: 'Normal', spokenPhrases: ['short'] },
            { focusedElementText: 'Second', spokenPhrases: [longSpoken] },
        ]);

        const result = await rule.run(mockContext([strategyResult('tab', steps)]));

        expect(result.violations).toHaveLength(2);
        expect(result.stats!.violationsFound).toBe(2);
    });

    it('flags critical impact for extremely long announcements (>1000 chars)', async () => {
        const veryLongSpoken = 'X'.repeat(1100);
        const steps = createSteps([{ focusedElementText: 'Mega', spokenPhrases: [veryLongSpoken] }]);

        const result = await rule.run(mockContext([strategyResult('tab', steps)]));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]!.rule.impact).toBe('critical');
    });

    it('truncates the message for very long spoken text', async () => {
        const longSpoken = 'Z'.repeat(600);
        const steps = createSteps([{ focusedElementText: 'Truncated', spokenPhrases: [longSpoken] }]);

        const result = await rule.run(mockContext([strategyResult('tab', steps)]));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]!.message).toContain('[truncated]');
    });

    it('combines multiple threshold violations in one message', async () => {
        const steps = createSteps([
            {
                focusedElementText: 'Everything',
                spokenPhrases: [
                    'X'.repeat(600) +
                        ' heading, level 1, A, heading, level 2, B, heading, level 3, C, button, button, button',
                ],
            },
        ]);

        const result = await rule.run(mockContext([strategyResult('tab', steps)]));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]!.message).toContain('characters');
        expect(result.violations[0]!.message).toContain('headings');
        expect(result.violations[0]!.message).toContain('buttons');
    });
});
