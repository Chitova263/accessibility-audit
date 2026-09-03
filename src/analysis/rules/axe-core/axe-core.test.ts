import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Page, CDPSession } from 'playwright';
import type { AuditContext } from '../../core/context';
import { rule } from './axe-core';

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
const { axeResult } = vi.hoisted(() => ({ axeResult: { current: null as StubAxeResults | null } }));

vi.mock('@axe-core/playwright', () => ({
    default: class AxeBuilderStub {
        constructor(_page: { page: Page }) {}
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

const context: AuditContext = {
    page: {} as Page,
    transcript: [],
    cdp: {} as CDPSession,
    screenshotsDir: '/tmp/screenshots',
    screenReader: 'nvda',
};

beforeEach(() => {
    givenAxeReports([]);
});

describe('axe-core rule', () => {
    it('has correct metadata', () => {
        expect(rule.id).toBe('axe-core');
        expect(rule.meta.summary).toBe('axe-core static accessibility analysis');
    });

    it('returns an empty result for a clean page', async () => {
        const result = await rule.run(context);

        expect(result.violations).toEqual([]);
        expect(result.stats).toEqual({ totalViolations: 0, byImpact: {}, byRule: {} });
    });

    it('converts an axe violation into the unified shape', async () => {
        givenAxeReports([axeViolation()]);

        const result = await rule.run(context);

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toMatchObject({
            id: 'axe-image-alt-0',
            rule: { id: 'image-alt', impact: 'critical' },
            message: 'Ensures <img> elements have alternate text',
            element: { htmlSnippet: '<img src="/a.png">', selector: '#hero > img' },
            tool: 'axe-core',
        });
        expect(result.violations[0]?.context).toMatchObject({
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

        const result = await rule.run(context);

        expect(result.violations.map((v) => v.id)).toEqual(['axe-image-alt-0', 'axe-image-alt-1']);
        expect(result.violations.map((v) => v.element?.selector)).toEqual(['#a', '#b']);
        expect(result.violations[0]?.context.nodes).toHaveLength(2);
    });

    it('joins multi-part selectors into one string', async () => {
        givenAxeReports([axeViolation({ nodes: [{ html: '<img>', target: ['iframe#promo', 'img.logo'] }] })]);

        const result = await rule.run(context);

        expect(result.violations[0]?.element?.selector).toBe('iframe#promo img.logo');
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

        const result = await rule.run(context);

        expect(result.violations[0]?.rule.wcag.primary).toEqual(expected);
    });

    it('falls back to "moderate" when axe reports no impact', async () => {
        givenAxeReports([axeViolation({ impact: null })]);

        const result = await rule.run(context);

        expect(result.violations[0]?.rule.impact).toBe('moderate');
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

        const result = await rule.run(context);

        expect(result.stats).toEqual({
            totalViolations: 3,
            byImpact: { critical: 1, serious: 2 },
            byRule: { 'image-alt': 1, 'color-contrast': 2 },
        });
    });

    it('returns empty result when page is null', async () => {
        const contextWithoutPage: AuditContext = {
            page: null as never,
            transcript: [],
            cdp: {} as CDPSession,
            screenshotsDir: '/tmp/screenshots',
            screenReader: 'nvda',
        };

        const result = await rule.run(contextWithoutPage);

        expect(result.violations).toEqual([]);
        expect(result.stats!.totalViolations).toBe(0);
    });
});
