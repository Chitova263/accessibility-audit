import { describe, it, expect } from 'vitest';
import { rule } from './form-field-no-label';
import { createSteps, strategyResult, mockContext } from '../../test-fixtures';

describe('form-field-no-label rule', () => {
    it('has correct metadata', () => {
        expect(rule.id).toBe('form-field-no-label');
        expect(rule.meta.impact).toBe('critical');
        expect(rule.meta.wcag.primary.criterion).toBe('3.3.2');
    });

    it('reports a form field with no accessible label', async () => {
        const steps = createSteps([
            { role: 'textbox', name: '', itemText: 'edit blank', htmlSnippet: '<input type="text">' },
        ]);

        const result = await rule.run(mockContext([strategyResult('tab', steps)]));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]!.rule.id).toBe('form-field-no-label');
        expect(result.violations[0]!.element).toMatchObject({ htmlSnippet: '<input type="text">' });
        expect(result.violations[0]!.message).toContain('Text input has no accessible label');
        expect(result.violations[0]!.message).toContain('NVDA announced: "edit blank"');
    });

    it('names the field type in plain language', async () => {
        const steps = createSteps([
            { role: 'combobox', name: '', identifier: 'a' },
            { role: 'radio', name: '', identifier: 'b' },
            { role: 'switch', name: '', identifier: 'c' },
        ]);

        const result = await rule.run(mockContext([strategyResult('tab', steps)]));

        expect(result.violations.map((v) => v.message.split(' has ')[0])).toEqual([
            'Dropdown/combo box',
            'Radio button',
            'Toggle switch',
        ]);
    });

    it('says "(nothing)" when NVDA announced nothing for the field', async () => {
        const steps = createSteps([{ role: 'checkbox', name: '', itemText: '' }]);

        const result = await rule.run(mockContext([strategyResult('tab', steps)]));

        expect(result.violations[0]!.message).toContain('NVDA announced: "(nothing)"');
    });

    it('leaves labelled fields alone', async () => {
        const steps = createSteps([{ role: 'textbox', name: 'Postcode', itemText: 'Postcode edit' }]);

        const result = await rule.run(mockContext([strategyResult('tab', steps)]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats).toMatchObject({ totalFormFields: 1, fieldsWithoutLabels: 0 });
    });

    it('treats a whitespace-only label as missing', async () => {
        const steps = createSteps([{ role: 'textbox', name: '  ' }]);

        const result = await rule.run(mockContext([strategyResult('tab', steps)]));

        expect(result.violations).toHaveLength(1);
    });

    it('ignores elements that are not form fields', async () => {
        const steps = createSteps([
            { role: 'button', name: '' },
            { role: 'link', name: '' },
            { role: 'heading', name: '' },
        ]);

        const result = await rule.run(mockContext([strategyResult('tab', steps)]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.totalFormFields).toBe(0);
    });

    it('counts a field once when several strategies reached it', async () => {
        const steps = createSteps([{ role: 'textbox', name: '', htmlSnippet: '<input id="q">' }]);

        const result = await rule.run(mockContext([strategyResult('tab', steps), strategyResult('arrow', steps)]));

        expect(result.stats).toMatchObject({ totalFormFields: 1, fieldsWithoutLabels: 1 });
    });

    it('breaks the summary down by role', async () => {
        const steps = createSteps([
            { role: 'textbox', name: 'Email', identifier: 'a' },
            { role: 'textbox', name: '', identifier: 'b' },
            { role: 'checkbox', name: '', identifier: 'c' },
        ]);

        const result = await rule.run(mockContext([strategyResult('tab', steps)]));

        expect(result.stats!.byRole).toEqual({
            textbox: { total: 2, unlabeled: 1 },
            checkbox: { total: 1, unlabeled: 1 },
        });
    });
});


