import { describe, it, expect } from 'vitest';
import { RULES, RULE_IDS, ruleMetadata } from './rule-catalog';

describe('ruleMetadata', () => {
    it('supplies the rule id, WCAG mapping and default impact', () => {
        expect(ruleMetadata('focus-trap')).toEqual({
            ruleId: 'focus-trap',
            wcag: { primary: { criterion: '2.1.2', level: 'A' } },
            impact: 'critical',
        });
    });

    it('includes related criteria when the rule has them', () => {
        expect(ruleMetadata('form-field-no-label').wcag.related).toEqual([
            { criterion: '1.3.1', level: 'A' },
            { criterion: '4.1.2', level: 'A' },
        ]);
    });

    it('omits the related key entirely when the rule has none', () => {
        const { wcag } = ruleMetadata('multiple-h1');

        expect('related' in wcag).toBe(false);
    });

    it('applies an impact override for rules whose severity varies by context', () => {
        expect(ruleMetadata('generic-link-text').impact).toBe('serious');
        expect(ruleMetadata('generic-link-text', 'moderate').impact).toBe('moderate');
    });

    it('returns copies so a violation cannot mutate the catalog', () => {
        const first = ruleMetadata('empty-accessible-name');
        first.wcag.primary.criterion = 'tampered';
        first.wcag.related![0]!.criterion = 'tampered';

        const second = ruleMetadata('empty-accessible-name');

        expect(second.wcag.primary.criterion).toBe('4.1.2');
        expect(second.wcag.related?.[0]?.criterion).toBe('1.1.1');
    });
});

describe('rule catalog contents', () => {
    it('exposes every rule id', () => {
        expect(RULE_IDS).toHaveLength(Object.keys(RULES).length);
        expect(new Set(RULE_IDS).size).toBe(RULE_IDS.length);
    });

    it.each(RULE_IDS)('%s is well formed', (ruleId) => {
        const rule = RULES[ruleId];

        expect(rule.wcag.primary.criterion).toMatch(/^\d+\.\d+\.\d+$/);
        expect(['A', 'AA', 'AAA']).toContain(rule.wcag.primary.level);
        expect(['critical', 'serious', 'moderate', 'minor']).toContain(rule.impact);
        expect(rule.summary.trim()).not.toBe('');
    });
});
