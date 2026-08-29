import { describe, it, expect } from 'vitest';
import type { Page } from 'playwright';
import { CHECKS, collectViolations, runChecks, summarizeViolations } from './registry';
import type { Check } from './registry';
import { RULE_IDS } from './rule-catalog';
import { broadTranscript, createSteps, strategyResult } from './analyzers/test-fixtures';
import type { Violation } from './violation';
import type { StrategyResult } from '../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';
import type { SkipLinkAnalyzerResult } from './analyzers/skip-link';
import type { EmptyAccessibleNameAnalyzerResult } from './analyzers/empty-accessible-name';
import type { ContentDensityPerRegionResult } from './analyzers/arrow-navigation';

const violation = (overrides: Partial<Violation> = {}): Violation => ({
    id: 'v1',
    ruleId: 'empty-accessible-name',
    wcag: { primary: { criterion: '4.1.2', level: 'A' } },
    impact: 'serious',
    message: 'x',
    element: {},
    tool: 'nvda-audit',
    timestamp: 0,
    toolDetails: {},
    ...overrides,
});

const stubCheck = (id: string, violations: Violation[], summary: unknown = {}): Check => ({
    id,
    name: id,
    rules: [],
    run: () => ({ violations, summary }),
});

const context = { strategyResults: [], page: {} as Page };

describe('CHECKS registry', () => {
    it('gives every check a unique id', () => {
        const ids = CHECKS.map((check) => check.id);

        expect(new Set(ids).size).toBe(ids.length);
    });

    it('claims every rule in the catalog', () => {
        const claimed = new Set(CHECKS.flatMap((check) => check.rules));

        expect([...RULE_IDS].filter((ruleId) => !claimed.has(ruleId))).toEqual([]);
    });

    it('leaves axe-core without catalog rules, since it brings its own', () => {
        expect(CHECKS.find((check) => check.id === 'axe-core')?.rules).toEqual([]);
    });

    it('lists each rule at most once per check', () => {
        const withDuplicates = CHECKS.filter((check) => new Set(check.rules).size !== check.rules.length);

        expect(withDuplicates.map((check) => check.id)).toEqual([]);
    });

    it('emits only rules it declared', async () => {
        const nvdaChecks = CHECKS.filter((check) => check.id !== 'axe-core');
        const results = await runChecks({ strategyResults: broadTranscript(), page: {} as Page }, nvdaChecks);

        const undeclared = results.flatMap(({ check, violations }) =>
            violations
                .filter((violation) => !(check.rules as readonly string[]).includes(violation.ruleId))
                .map((violation) => `${check.id} emitted undeclared rule ${violation.ruleId}`)
        );

        expect(undeclared).toEqual([]);
    });

    it('exercises enough of the registry for that guard to mean something', async () => {
        const nvdaChecks = CHECKS.filter((check) => check.id !== 'axe-core');
        const results = await runChecks({ strategyResults: broadTranscript(), page: {} as Page }, nvdaChecks);

        // Guards the guard: if the fixture stops provoking checks, "emits only
        // rules it declared" passes vacuously and stops protecting anything.
        expect(results.filter((result) => result.violations.length > 0).length).toBeGreaterThanOrEqual(10);
    });
});

describe('runChecks', () => {
    it('returns one result per check, in registration order', async () => {
        const checks = [stubCheck('a', [violation({ id: 'a1' })]), stubCheck('b', [])];

        const results = await runChecks(context, checks);

        expect(results.map((r) => r.check.id)).toEqual(['a', 'b']);
        expect(results[0]?.violations).toHaveLength(1);
        expect(results[1]?.violations).toEqual([]);
    });

    it('awaits checks that return a promise', async () => {
        const asyncCheck: Check = {
            id: 'async',
            name: 'async',
            rules: [],
            run: async () => ({ violations: [violation()], summary: { ran: true } }),
        };

        const results = await runChecks(context, [asyncCheck]);

        expect(results[0]?.violations).toHaveLength(1);
        expect(results[0]?.summary).toEqual({ ran: true });
    });

    it('passes the analyzer summary through untouched', async () => {
        const results = await runChecks(context, [stubCheck('a', [], { totalHeadings: 3 })]);

        expect(results[0]?.summary).toEqual({ totalHeadings: 3 });
    });

    it('hands every check the whole context, whichever slice it declares', async () => {
        const seen: unknown[] = [];
        const spy: Check = {
            id: 'spy',
            name: 'spy',
            rules: [],
            run: (ctx) => (seen.push(ctx), { violations: [], summary: {} }),
        };
        const strategyResults = [strategyResult('tab', createSteps([{}]))];

        await runChecks({ strategyResults, page: {} as Page }, [spy]);

        expect(seen[0]).toEqual({ strategyResults, page: {} });
    });

    it('runs the real NVDA checks over a transcript without special-casing any of them', async () => {
        const nvdaChecks = CHECKS.filter((check) => check.id !== 'axe-core');
        const strategyResults = [
            strategyResult('tab', createSteps([{ role: 'button', name: '' }])),
            strategyResult('heading', createSteps([{ role: 'heading', level: 2, name: 'About' }])),
        ];

        const results = await runChecks({ strategyResults, page: {} as Page }, nvdaChecks);
        const violations = collectViolations(results);

        expect(results).toHaveLength(nvdaChecks.length);
        expect(violations.map((v) => v.ruleId)).toContain('empty-accessible-name');
        expect(violations.map((v) => v.ruleId)).toContain('missing-h1');
    });
});

describe('check summaries', () => {
    const runCheck = async (id: string, strategyResults: StrategyResult[]) => {
        const check = CHECKS.find((candidate) => candidate.id === id)!;
        const [result] = await runChecks({ strategyResults, page: {} as Page }, [check]);
        return result!;
    };

    it('records a check that ran and passed, which raises no violation to record it', async () => {
        const steps = createSteps([
            { role: 'link', name: 'Skip to main content', htmlSnippet: '<a href="#main">Skip to main content</a>' },
        ]);

        const result = await runCheck('skip-link', [strategyResult('tab', steps)]);
        const summary = result.summary as SkipLinkAnalyzerResult['summary'];

        expect(result.violations).toEqual([]);
        expect(summary).toMatchObject({ skipLinkFound: true, skipLinkPosition: 1 });
    });

    it('records how much was examined, not only what failed', async () => {
        const steps = createSteps([
            { role: 'button', name: 'Search' },
            { role: 'button', name: 'Basket' },
            { role: 'button', name: 'Menu' },
            { role: 'button', name: '' },
        ]);

        const result = await runCheck('empty-accessible-name', [strategyResult('tab', steps)]);
        const summary = result.summary as EmptyAccessibleNameAnalyzerResult['summary'];

        expect(result.violations).toHaveLength(1);
        expect(summary.totalElementsChecked).toBe(4);
    });

    it('records a finding the analyzer suppressed to avoid double-reporting', async () => {
        const steps = createSteps([
            { spokenPhrases: ['navigation landmark'] },
            ...Array.from({ length: 60 }, () => ({})),
        ]);

        const result = await runCheck('content-density-per-region', [strategyResult('arrow', steps)]);
        const summary = result.summary as ContentDensityPerRegionResult['summary'];

        expect(result.violations).toEqual([]);
        expect(summary.regions[0]).toMatchObject({ landmark: 'navigation', exceedsThreshold: true });
    });
});

describe('collectViolations', () => {
    it('flattens violations across checks in order', async () => {
        const results = await runChecks(context, [
            stubCheck('a', [violation({ id: 'a1' }), violation({ id: 'a2' })]),
            stubCheck('b', [violation({ id: 'b1' })]),
        ]);

        expect(collectViolations(results).map((v) => v.id)).toEqual(['a1', 'a2', 'b1']);
    });
});

describe('summarizeViolations', () => {
    it('counts by tool, impact and rule', () => {
        const totals = summarizeViolations([
            violation({ tool: 'nvda-audit', impact: 'serious', ruleId: 'empty-accessible-name' }),
            violation({ tool: 'nvda-audit', impact: 'critical', ruleId: 'focus-trap' }),
            violation({ tool: 'axe-core', impact: 'serious', ruleId: 'color-contrast' }),
        ]);

        expect(totals).toEqual({
            total: 3,
            byTool: { 'nvda-audit': 2, 'axe-core': 1 },
            byImpact: { serious: 2, critical: 1 },
            byRule: { 'empty-accessible-name': 1, 'focus-trap': 1, 'color-contrast': 1 },
        });
    });

    it('handles an empty run', () => {
        expect(summarizeViolations([])).toEqual({ total: 0, byTool: {}, byImpact: {}, byRule: {} });
    });
});
