import { describe, it, expect } from 'vitest';
import { rule } from './missing-skip-link';
import { createSteps, strategyResult, mockContext } from '../../test-fixtures';
import type { StepOverrides } from '../../test-fixtures';

const tabStop = (name: string, href = '/x'): StepOverrides => ({
    role: 'link',
    name,
    focusedElementText: name,
    identifier: `stop-${name}`,
    htmlSnippet: `<a href="${href}">${name}</a>`,
});

describe('missing-skip-link rule', () => {
    it('finds a skip link at the first tab stop', async () => {
        const steps = createSteps([tabStop('Skip to main content', '#main'), tabStop('Home')]);

        const result = await rule.run(mockContext([strategyResult('tab', steps)]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats).toMatchObject({ skipLinkFound: true, skipLinkPosition: 1 });
    });

    it('finds a skip link a few stops in', async () => {
        const steps = createSteps([tabStop('Logo'), tabStop('Search'), tabStop('Jump to content', '#content')]);

        const result = await rule.run(mockContext([strategyResult('tab', steps)]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.skipLinkPosition).toBe(3);
    });

    it('recognises a skip link by its href when the name does not say so', async () => {
        const steps = createSteps([tabStop('Content', '#main-content')]);

        const result = await rule.run(mockContext([strategyResult('tab', steps)]));

        expect(result.stats!.skipLinkFound).toBe(true);
    });

    it.each(['Direkt zum Inhalt', 'Zum Hauptinhalt springen', 'Passer au contenu principal'])(
        'recognises the localised skip link "%s"',
        async (name) => {
            const result = await rule.run(mockContext([strategyResult('tab', createSteps([tabStop(name)]))]));

            expect(result.stats!.skipLinkFound).toBe(true);
        }
    );

    it('reports a page with no skip link and lists what it found instead', async () => {
        const steps = createSteps([tabStop('Logo'), tabStop('Search'), tabStop('Basket')]);

        const result = await rule.run(mockContext([strategyResult('tab', steps)]));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]!.rule.id).toBe('missing-skip-link');
        expect(result.violations[0]!.message).toContain('Logo, Search, Basket');
        expect(result.stats).toMatchObject({ skipLinkFound: false, skipLinkPosition: null });
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

        const result = await rule.run(mockContext([strategyResult('tab', steps)]));

        expect(result.violations).toHaveLength(1);
        expect(result.stats!.skipLinkFound).toBe(false);
        expect(result.stats!.firstFewTabStops).toEqual(['One', 'Two', 'Three', 'Four', 'Five']);
    });

    it('falls back to the role when a tab stop has no name', async () => {
        const steps = createSteps([{ role: 'button', name: '', focusedElementText: '' }]);

        const result = await rule.run(mockContext([strategyResult('tab', steps)]));

        expect(result.stats!.firstFewTabStops).toEqual(['(button)']);
    });

    it('has nothing to check when no tab strategy ran', async () => {
        const result = await rule.run(mockContext([strategyResult('arrow', createSteps([tabStop('Logo')]))]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.firstFewTabStops).toEqual([]);
    });

    it('has nothing to check when the tab walk recorded no steps', async () => {
        const result = await rule.run(mockContext([strategyResult('tab', [])]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.skipLinkFound).toBe(false);
    });
});
