import { describe, it, expect } from 'vitest';
import { analyzeEmptyAccessibleNames } from './empty-accessible-name';
import { createSteps, strategyResult } from './test-fixtures';

describe('analyzeEmptyAccessibleNames', () => {
    it('reports an interactive element with no accessible name', () => {
        const steps = createSteps([{ role: 'button', name: '' }]);

        const result = analyzeEmptyAccessibleNames({ strategyResults: [strategyResult('button', steps)] });

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toMatchObject({
            ruleId: 'empty-accessible-name',
            impact: 'serious',
            tool: 'nvda-audit',
            wcag: { primary: { criterion: '4.1.2', level: 'A' } },
        });
        expect(result.violations[0]?.message).toContain('Button has no accessible name');
    });

    it('treats a whitespace-only name as missing', () => {
        const steps = createSteps([{ role: 'link', name: '   ' }]);

        const result = analyzeEmptyAccessibleNames({ strategyResults: [strategyResult('link', steps)] });

        expect(result.violations).toHaveLength(1);
    });

    it('leaves named elements alone', () => {
        const steps = createSteps([{ role: 'button', name: 'Submit' }]);

        const result = analyzeEmptyAccessibleNames({ strategyResults: [strategyResult('button', steps)] });

        expect(result.violations).toEqual([]);
        expect(result.summary.totalElementsChecked).toBe(1);
    });

    it('ignores roles that do not require a name', () => {
        const steps = createSteps([
            { role: 'paragraph', name: '' },
            { role: 'StaticText', name: '' },
            { role: 'generic', name: '' },
        ]);

        const result = analyzeEmptyAccessibleNames({ strategyResults: [strategyResult('arrow', steps)] });

        expect(result.violations).toEqual([]);
        expect(result.summary.totalElementsChecked).toBe(0);
    });

    it('skips steps with no accessibility node', () => {
        const steps = createSteps([{ axNode: false }]);

        const result = analyzeEmptyAccessibleNames({ strategyResults: [strategyResult('tab', steps)] });

        expect(result.violations).toEqual([]);
        expect(result.summary.totalElementsChecked).toBe(0);
    });

    it('counts violations per role and carries the spoken output into tool details', () => {
        const steps = createSteps([
            { role: 'button', name: '', spokenPhrases: ['button'] },
            { role: 'button', name: '', identifier: 'second-button' },
            { role: 'textbox', name: '' },
            { role: 'link', name: 'Plans' },
        ]);

        const result = analyzeEmptyAccessibleNames({ strategyResults: [strategyResult('tab', steps)] });

        expect(result.summary).toMatchObject({
            totalElementsChecked: 4,
            violationsFound: 3,
            byRole: { button: 2, textbox: 1 },
        });
        expect(result.violations[0]?.toolDetails).toMatchObject({
            spokenPhrases: ['button'],
            navigationStrategy: 'tab',
            stepIndex: 0,
        });
    });

    it('reports the same element once per strategy that reached it', () => {
        const steps = createSteps([{ role: 'button', name: '' }]);

        const result = analyzeEmptyAccessibleNames({
            strategyResults: [strategyResult('button', steps), strategyResult('tab', steps)],
        });

        expect(result.violations).toHaveLength(2);
    });
});
