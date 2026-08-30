import { describe, it, expect } from 'vitest';
import { analyzeSkipLink } from './skip-link';
import { createSteps, strategyResult, mockContext } from '../test-fixtures';
import type { StepOverrides } from '../test-fixtures';

const tabStop = (name: string, href = '/x'): StepOverrides => ({
    role: 'link',
    name,
    itemText: name,
    identifier: `stop-${name}`,
    htmlSnippet: `<a href="${href}">${name}</a>`,
});

describe('analyzeSkipLink', () => {
    it('finds a skip link at the first tab stop', async () => {
        const steps = createSteps([tabStop('Skip to main content', '#main'), tabStop('Home')]);

        const result = await analyzeSkipLink(mockContext([strategyResult('tab', steps)]));

        expect(result.violations).toEqual([]);
        expect(result.summary).toMatchObject({ skipLinkFound: true, skipLinkPosition: 1 });
    });

    it('finds a skip link a few stops in', async () => {
        const steps = createSteps([tabStop('Logo'), tabStop('Search'), tabStop('Jump to content', '#content')]);

        const result = await analyzeSkipLink(mockContext([strategyResult('tab', steps)]));

        expect(result.violations).toEqual([]);
        expect(result.summary.skipLinkPosition).toBe(3);
    });

    it('recognises a skip link by its href when the name does not say so', async () => {
        const steps = createSteps([tabStop('Content', '#main-content')]);

        const result = await analyzeSkipLink(mockContext([strategyResult('tab', steps)]));

        expect(result.summary.skipLinkFound).toBe(true);
    });

    it.each(['Direkt zum Inhalt', 'Zum Hauptinhalt springen', 'Passer au contenu principal'])(
        'recognises the localised skip link "%s"',
        async (name) => {
            const result = await analyzeSkipLink(mockContext([strategyResult('tab', createSteps([tabStop(name)]))]));

            expect(result.summary.skipLinkFound).toBe(true);
        }
    );

    it('reports a page with no skip link and lists what it found instead', async () => {
        const steps = createSteps([tabStop('Logo'), tabStop('Search'), tabStop('Basket')]);

        const result = await analyzeSkipLink(mockContext([strategyResult('tab', steps)]));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toMatchObject({
            rule: { id: 'missing-skip-link', impact: 'serious', wcag: { primary: { criterion: '2.4.1', level: 'A' } } },
        });
        expect(result.violations[0]?.message).toContain('Logo, Search, Basket');
        expect(result.summary).toMatchObject({ skipLinkFound: false, skipLinkPosition: null });
    });

    it('only looks at the first five tab stops', async () => {
        const steps = createSteps([
            tabStop('One'),
            tabStop('Two'),
            tabStop('Three'),
            tabStop('Four'),
            tabStop('Five'),
            tabStop('Skip to main content', '#main'),
        ]);

        const result = await analyzeSkipLink(mockContext([strategyResult('tab', steps)]));

        expect(result.violations).toHaveLength(1);
        expect(result.summary.skipLinkFound).toBe(false);
        expect(result.summary.firstFewTabStops).toEqual(['One', 'Two', 'Three', 'Four', 'Five']);
    });

    it('falls back to the role when a tab stop has no name', async () => {
        const steps = createSteps([{ role: 'button', name: '', itemText: '' }]);

        const result = await analyzeSkipLink(mockContext([strategyResult('tab', steps)]));

        expect(result.summary.firstFewTabStops).toEqual(['(button)']);
    });

    it('has nothing to check when no tab strategy ran', async () => {
        const result = await analyzeSkipLink(mockContext([strategyResult('arrow', createSteps([tabStop('Logo')]))]));

        expect(result.violations).toEqual([]);
        expect(result.summary.firstFewTabStops).toEqual([]);
    });

    it('has nothing to check when the tab walk recorded no steps', async () => {
        const result = await analyzeSkipLink(mockContext([strategyResult('tab', [])]));

        expect(result.violations).toEqual([]);
        expect(result.summary.skipLinkFound).toBe(false);
    });
});
