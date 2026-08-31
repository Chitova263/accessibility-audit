import { describe, it, expect } from 'vitest';
import { rule } from './filename-as-alt';
import { createSteps, strategyResult, mockContext } from '../../test-fixtures';
import type { StepOverrides } from '../../test-fixtures';

const image = (name: string): StepOverrides => ({
    role: 'img',
    name,
    itemText: name,
    identifier: `image-${name}`,
    htmlSnippet: `<img src="/media/${name}" alt="${name}">`,
});

describe('filename-as-alt rule', () => {
    it('has correct metadata', () => {
        expect(rule.id).toBe('filename-as-alt');
        expect(rule.meta.impact).toBe('serious');
        expect(rule.meta.wcag.primary.criterion).toBe('1.1.1');
    });

    it.each([
        ['IMG_1234.jpg', 'camera filename'],
        ['DSC-0042.png', 'camera filename'],
        ['screenshot2.png', 'screenshot filename'],
        ['a3f9c1b28e.webp', 'hash filename'],
        ['hero-banner.jpg', 'generic filename'],
        ['shutterstock_884213', 'stock photo id'],
        ['unsplash-photo', 'stock photo id'],
    ])('reports "%s" as %s used for alt text', async (alt) => {
        const result = await rule.run(mockContext([strategyResult('arrow', createSteps([image(alt)]))]));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]!.rule.id).toBe('filename-as-alt');
        expect(result.violations[0]!.message).toContain(alt);
    });

    it.each(['Fibre router on a desk', 'Swisscom logo', 'Two people looking at a phone. Photo taken outdoors.'])(
        'leaves descriptive alt text alone: "%s"',
        async (alt) => {
            const result = await rule.run(mockContext([strategyResult('arrow', createSteps([image(alt)]))]));

            expect(result.violations).toHaveLength(0);
            expect(result.stats!.totalImages).toBe(1);
        }
    );

    it('does not report a decorative image with empty alt', async () => {
        const result = await rule.run(mockContext([strategyResult('arrow', createSteps([image('')]))]));

        expect(result.violations).toHaveLength(0);
    });

    it('recognises an image from its HTML even when the role says otherwise', async () => {
        const steps = createSteps([
            {
                role: 'link',
                name: 'IMG_9.png',
                itemText: 'IMG_9.png',
                htmlSnippet: '<img src="/a.png" alt="IMG_9.png">',
            },
        ]);

        const result = await rule.run(mockContext([strategyResult('link', steps)]));

        expect(result.violations).toHaveLength(1);
    });

    it('ignores non-image elements', async () => {
        const steps = createSteps([{ role: 'link', name: 'photo.jpg', itemText: 'photo.jpg' }]);

        const result = await rule.run(mockContext([strategyResult('link', steps)]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.totalImages).toBe(0);
    });

    it('counts an image once when several strategies reached it', async () => {
        const steps = createSteps([image('IMG_1234.jpg')]);

        const result = await rule.run(mockContext([strategyResult('arrow', steps), strategyResult('link', steps)]));

        expect(result.stats).toMatchObject({ totalImages: 1, violationsFound: 1 });
    });

    it('reports each offending image separately', async () => {
        const steps = createSteps([image('IMG_1.jpg'), image('Fibre router'), image('DSC_2.jpg')]);

        const result = await rule.run(mockContext([strategyResult('arrow', steps)]));

        expect(result.stats).toMatchObject({ totalImages: 3, violationsFound: 2 });
    });
});
