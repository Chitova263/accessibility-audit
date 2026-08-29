import { describe, it, expect } from 'vitest';
import { analyzeFormLabels } from './form-labels';
import { createSteps, strategyResult } from './test-fixtures';

describe('analyzeFormLabels', () => {
    it('reports a form field with no accessible label', () => {
        const steps = createSteps([
            { role: 'textbox', name: '', itemText: 'edit blank', htmlSnippet: '<input type="text">' },
        ]);

        const result = analyzeFormLabels({ strategyResults: [strategyResult('tab', steps)] });

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toMatchObject({
            ruleId: 'form-field-no-label',
            impact: 'critical',
            wcag: { primary: { criterion: '3.3.2', level: 'A' } },
            element: { htmlSnippet: '<input type="text">' },
        });
        expect(result.violations[0]?.message).toContain('Text input has no accessible label');
        expect(result.violations[0]?.message).toContain('NVDA announced: "edit blank"');
    });

    it('names the field type in plain language', () => {
        const steps = createSteps([
            { role: 'combobox', name: '', identifier: 'a' },
            { role: 'radio', name: '', identifier: 'b' },
            { role: 'switch', name: '', identifier: 'c' },
        ]);

        const result = analyzeFormLabels({ strategyResults: [strategyResult('tab', steps)] });

        expect(result.violations.map((v) => v.message.split(' has ')[0])).toEqual([
            'Dropdown/combo box',
            'Radio button',
            'Toggle switch',
        ]);
    });

    it('says "(nothing)" when NVDA announced nothing for the field', () => {
        const steps = createSteps([{ role: 'checkbox', name: '', itemText: '' }]);

        const result = analyzeFormLabels({ strategyResults: [strategyResult('tab', steps)] });

        expect(result.violations[0]?.message).toContain('NVDA announced: "(nothing)"');
    });

    it('leaves labelled fields alone', () => {
        const steps = createSteps([{ role: 'textbox', name: 'Postcode', itemText: 'Postcode edit' }]);

        const result = analyzeFormLabels({ strategyResults: [strategyResult('tab', steps)] });

        expect(result.violations).toEqual([]);
        expect(result.summary).toMatchObject({ totalFormFields: 1, fieldsWithoutLabels: 0 });
    });

    it('treats a whitespace-only label as missing', () => {
        const steps = createSteps([{ role: 'textbox', name: '  ' }]);

        const result = analyzeFormLabels({ strategyResults: [strategyResult('tab', steps)] });

        expect(result.violations).toHaveLength(1);
    });

    it('ignores elements that are not form fields', () => {
        const steps = createSteps([
            { role: 'button', name: '' },
            { role: 'link', name: '' },
            { role: 'heading', name: '' },
        ]);

        const result = analyzeFormLabels({ strategyResults: [strategyResult('tab', steps)] });

        expect(result.violations).toEqual([]);
        expect(result.summary.totalFormFields).toBe(0);
    });

    it('counts a field once when several strategies reached it', () => {
        const steps = createSteps([{ role: 'textbox', name: '', htmlSnippet: '<input id="q">' }]);

        const result = analyzeFormLabels({
            strategyResults: [strategyResult('tab', steps), strategyResult('arrow', steps)],
        });

        expect(result.summary).toMatchObject({ totalFormFields: 1, fieldsWithoutLabels: 1 });
    });

    it('breaks the summary down by role', () => {
        const steps = createSteps([
            { role: 'textbox', name: 'Email', identifier: 'a' },
            { role: 'textbox', name: '', identifier: 'b' },
            { role: 'checkbox', name: '', identifier: 'c' },
        ]);

        const result = analyzeFormLabels({ strategyResults: [strategyResult('tab', steps)] });

        expect(result.summary.byRole).toEqual({
            textbox: { total: 2, unlabeled: 1 },
            checkbox: { total: 1, unlabeled: 1 },
        });
    });
});
