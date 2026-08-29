import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Page } from 'playwright';
import type { AuditContext } from '../context';
import { analyzeWithAxeCore } from './axe-core';

interface StubAxeResults {
    violations: Array<{
        id: string;
        impact: string | null;
        description: string;
        help: string;
        helpUrl: string;
        tags: string[];
        nodes: Array<{ html: string; target: string[]; failureSummary?: string }>;
    }>;
    testEngine: { name: string; version: string };
}

/** The builder is replaced wholesale; `axeResult.current` is what `analyze()` returns. */
const { axeResult } = vi.hoisted(() => ({ axeResult: { current: null as unknown } }));

vi.mock('@axe-core/playwright', () => ({
    default: class AxeBuilderStub {
        constructor(_options: { page: Page }) {}
        analyze() {
            return Promise.resolve(axeResult.current);
        }
    },
}));

const axeViolation = (
    overrides: Partial<StubAxeResults['violations'][number]> = {}
): StubAxeResults['violations'][number] => ({
    id: 'image-alt',
    impact: 'critical',
    description: 'Ensures <img> elements have alternate text',
    help: 'Images must have alternate text',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.13/image-alt',
    tags: ['cat.text-alternatives', 'wcag2a', 'wcag111'],
    nodes: [{ html: '<img src="/a.png">', target: ['#hero > img'], failureSummary: 'Fix this: add alt' }],
    ...overrides,
});

const givenAxeReports = (violations: StubAxeResults['violations']): void => {
    axeResult.current = { violations, testEngine: { name: 'axe-core', version: '4.13.0' } } satisfies StubAxeResults;
};

const context: AuditContext = { page: {} as Page, strategyResults: [] };

beforeEach(() => {
    givenAxeReports([]);
});

describe('analyzeWithAxeCore', () => {
    it('returns an empty result for a clean page', async () => {
        const result = await analyzeWithAxeCore(context);

        expect(result.violations).toEqual([]);
        expect(result.summary).toEqual({ totalViolations: 0, byImpact: {}, byRule: {} });
    });

    it('converts an axe violation into the unified shape', async () => {
        givenAxeReports([axeViolation()]);

        const result = await analyzeWithAxeCore(context);

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toMatchObject({
            id: 'axe-image-alt-0',
            ruleId: 'image-alt',
            impact: 'critical',
            message: 'Ensures <img> elements have alternate text',
            element: { htmlSnippet: '<img src="/a.png">', selector: '#hero > img' },
            tool: 'axe-core',
            toolVersion: '4.13.0',
        });
        expect(result.violations[0]?.toolDetails).toMatchObject({
            help: 'Images must have alternate text',
            helpUrl: 'https://dequeuniversity.com/rules/axe/4.13/image-alt',
            tags: ['cat.text-alternatives', 'wcag2a', 'wcag111'],
            nodes: [{ html: '<img src="/a.png">', target: ['#hero > img'], failureSummary: 'Fix this: add alt' }],
        });
    });

    it('emits one violation per failing node', async () => {
        givenAxeReports([
            axeViolation({
                nodes: [
                    { html: '<img src="/a.png">', target: ['#a'] },
                    { html: '<img src="/b.png">', target: ['#b'] },
                ],
            }),
        ]);

        const result = await analyzeWithAxeCore(context);

        expect(result.violations.map((v) => v.id)).toEqual(['axe-image-alt-0', 'axe-image-alt-1']);
        expect(result.violations.map((v) => v.element.selector)).toEqual(['#a', '#b']);
        expect(result.violations[0]?.toolDetails.nodes).toHaveLength(2);
    });

    it('joins multi-part selectors into one string', async () => {
        givenAxeReports([axeViolation({ nodes: [{ html: '<img>', target: ['iframe#promo', 'img.logo'] }] })]);

        const result = await analyzeWithAxeCore(context);

        expect(result.violations[0]?.element.selector).toBe('iframe#promo img.logo');
    });

    it.each<[string[], { criterion: string; level: 'A' | 'AA' | 'AAA' }]>([
        [['wcag2a', 'wcag111'], { criterion: '1.1.1', level: 'A' }],
        [['wcag2aa', 'wcag143'], { criterion: '1.4.3', level: 'AA' }],
        [['wcag2aaa', 'wcag1410'], { criterion: '1.4.10', level: 'AAA' }],
        [['wcag2aa'], { criterion: 'WCAG 2', level: 'AA' }],
        [['wcag21a'], { criterion: 'WCAG 21', level: 'A' }],
        [['cat.aria', 'best-practice'], { criterion: 'best-practice', level: 'A' }],
    ])('maps the tags %j to WCAG %j', async (tags, expected) => {
        givenAxeReports([axeViolation({ tags })]);

        const result = await analyzeWithAxeCore(context);

        expect(result.violations[0]?.wcag.primary).toEqual(expected);
    });

    it('falls back to "unknown" when axe reports no impact', async () => {
        givenAxeReports([axeViolation({ impact: null })]);

        const result = await analyzeWithAxeCore(context);

        expect(result.violations[0]?.impact).toBe('unknown');
    });

    it('summarises violations by impact and by rule', async () => {
        givenAxeReports([
            axeViolation({ id: 'image-alt', impact: 'critical' }),
            axeViolation({
                id: 'color-contrast',
                impact: 'serious',
                nodes: [
                    { html: '<p>a</p>', target: ['#a'] },
                    { html: '<p>b</p>', target: ['#b'] },
                ],
            }),
        ]);

        const result = await analyzeWithAxeCore(context);

        expect(result.summary).toEqual({
            totalViolations: 3,
            byImpact: { critical: 1, serious: 2 },
            byRule: { 'image-alt': 1, 'color-contrast': 2 },
        });
    });
});
