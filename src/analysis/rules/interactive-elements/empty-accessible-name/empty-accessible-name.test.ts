import { describe, it, expect } from 'vitest';
import { rule } from './empty-accessible-name';
import { mockContext, strategyResult, createSteps } from '../../test-fixtures';

describe('empty-accessible-name rule', () => {
    it('has correct metadata', () => {
        expect(rule.id).toBe('empty-accessible-name');
        expect(rule.meta.impact).toBe('serious');
        expect(rule.meta.wcag.primary.criterion).toBe('4.1.2');
    });

    it('reports an interactive element with no accessible name', async () => {
        const transcript = [strategyResult('tab', createSteps([{ role: 'button', name: '' }]))];

        const result = await rule.run(mockContext(transcript));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]!.rule.id).toBe('empty-accessible-name');
        expect(result.violations[0]!.message).toContain('Button has no accessible name');
        expect(result.stats).toMatchObject({
            totalElementsChecked: 1,
            violationsFound: 1,
            byRole: { button: 1 },
        });
    });

    it('ignores elements with accessible names', async () => {
        const transcript = [strategyResult('tab', createSteps([{ role: 'button', name: 'Submit' }]))];

        const result = await rule.run(mockContext(transcript));

        expect(result.violations).toHaveLength(0);
    });

    it('ignores non-interactive roles', async () => {
        const transcript = [strategyResult('arrow', createSteps([{ role: 'paragraph', name: '' }]))];

        const result = await rule.run(mockContext(transcript));

        expect(result.violations).toHaveLength(0);
    });

    it('treats whitespace-only name as empty', async () => {
        const transcript = [strategyResult('tab', createSteps([{ role: 'link', name: '   ' }]))];

        const result = await rule.run(mockContext(transcript));

        expect(result.violations).toHaveLength(1);
    });
});
