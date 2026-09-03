import { describe, it, expect } from 'vitest';
import { RULES, RULE_IDS, getRule } from './rule-catalog';

describe('getRule', () => {
    it('supplies the rule id, summary, and WCAG mapping', async () => {
        expect(getRule('focus-trap')).toEqual({
            id: 'focus-trap',
            summary: 'Keyboard focus trap where the user cannot escape using Tab',
            wcag: { primary: { criterion: '2.1.2', level: 'A' } },
        });
    });

    it('includes related criteria when the rule has them', async () => {
        expect(getRule('form-field-no-label').wcag.related).toEqual([
            { criterion: '1.3.1', level: 'A' },
            { criterion: '4.1.2', level: 'A' },
        ]);
    });

    it('omits the related key entirely when the rule has none', async () => {
        const { wcag } = getRule('multiple-h1');

        expect('related' in wcag).toBe(false);
    });

    it('returns copies so a violation cannot mutate the catalog', async () => {
        const first = getRule('empty-accessible-name');
        first.wcag.primary.criterion = 'tampered';
        first.wcag.related![0]!.criterion = 'tampered';

        const second = getRule('empty-accessible-name');

        expect(second.wcag.primary.criterion).toBe('4.1.2');
        expect(second.wcag.related?.[0]?.criterion).toBe('1.1.1');
    });
});

describe('rule catalog contents', () => {
    it.each(RULE_IDS)('%s is well formed', (ruleId) => {
        const rule = RULES[ruleId];

        expect(rule.wcag.primary.criterion).toMatch(/^\d+\.\d+\.\d+$/);
        expect(['A', 'AA', 'AAA']).toContain(rule.wcag.primary.level);
        expect(rule.summary.trim()).not.toBe('');
    });
});
