import { describe, it, expect } from 'vitest';
import { analyzeEmptyAccessibleNames } from './empty-accessible-name';
import { createSteps, strategyResult, mockContext } from '../test-fixtures';

describe('analyzeEmptyAccessibleNames', () => {
    it('reports an interactive element with no accessible name', async () => {
        const steps = createSteps([{ role: 'button', name: '' }]);

        const result = await analyzeEmptyAccessibleNames(mockContext([strategyResult('button', steps)]));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toMatchObject({
            rule: {
                id: 'empty-accessible-name',
                impact: 'serious',
                wcag: { primary: { criterion: '4.1.2', level: 'A' } },
            },
            tool: 'nvda-audit',
        });
        expect(result.violations[0]?.message).toContain('Button has no accessible name');
    });

    it('treats a whitespace-only name as missing', async () => {
        const steps = createSteps([{ role: 'link', name: '   ' }]);

        const result = await analyzeEmptyAccessibleNames(mockContext([strategyResult('link', steps)]));

        expect(result.violations).toHaveLength(1);
    });

    it('leaves named elements alone', async () => {
        const steps = createSteps([{ role: 'button', name: 'Submit' }]);

        const result = await analyzeEmptyAccessibleNames(mockContext([strategyResult('button', steps)]));

        expect(result.violations).toEqual([]);
        expect(result.summary.totalElementsChecked).toBe(1);
    });

    it('ignores roles that do not require a name', async () => {
        const steps = createSteps([
            { role: 'paragraph', name: '' },
            { role: 'StaticText', name: '' },
            { role: 'generic', name: '' },
        ]);

        const result = await analyzeEmptyAccessibleNames(mockContext([strategyResult('arrow', steps)]));

        expect(result.violations).toEqual([]);
        expect(result.summary.totalElementsChecked).toBe(0);
    });

    it('skips steps with no accessibility node', async () => {
        const steps = createSteps([{ axNode: false }]);

        const result = await analyzeEmptyAccessibleNames(mockContext([strategyResult('tab', steps)]));

        expect(result.violations).toEqual([]);
        expect(result.summary.totalElementsChecked).toBe(0);
    });

    it('counts violations per role and carries the spoken output into tool details', async () => {
        const steps = createSteps([
            { role: 'button', name: '', spokenPhrases: ['button'] },
            { role: 'button', name: '', identifier: 'second-button' },
            { role: 'textbox', name: '' },
            { role: 'link', name: 'Plans' },
        ]);

        const result = await analyzeEmptyAccessibleNames(mockContext([strategyResult('tab', steps)]));

        expect(result.summary).toMatchObject({
            totalElementsChecked: 4,
            violationsFound: 3,
            byRole: { button: 2, textbox: 1 },
        });
        expect(result.violations[0]?.context).toMatchObject({
            step: { spokenPhrase: 'button', strategy: 'tab', index: 0 },
        });
    });

    it('reports the same element once per strategy that reached it', async () => {
        const steps = createSteps([{ role: 'button', name: '' }]);

        const result = await analyzeEmptyAccessibleNames(
            mockContext([strategyResult('button', steps), strategyResult('tab', steps)])
        );

        expect(result.violations).toHaveLength(2);
    });
});
