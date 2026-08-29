import { describe, it, expect } from 'vitest';
import { analyzeImageAltText } from './image-alt-text';
import { createSteps, strategyResult } from './test-fixtures';
import type { StepOverrides } from './test-fixtures';

const image = (name: string): StepOverrides => ({
    role: 'img',
    name,
    itemText: name,
    identifier: `image-${name}`,
    htmlSnippet: `<img src="/media/${name}" alt="${name}">`,
});

describe('analyzeImageAltText', () => {
    it.each([
        ['IMG_1234.jpg', 'camera filename'],
        ['DSC-0042.png', 'camera filename'],
        ['screenshot2.png', 'screenshot filename'],
        ['a3f9c1b28e.webp', 'hash filename'],
        ['hero-banner.jpg', 'generic filename'],
        ['shutterstock_884213', 'stock photo id'],
        ['unsplash-photo', 'stock photo id'],
    ])('reports "%s" as %s used for alt text', (alt) => {
        const result = analyzeImageAltText({ strategyResults: [strategyResult('arrow', createSteps([image(alt)]))] });

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toMatchObject({
            ruleId: 'filename-as-alt',
            impact: 'serious',
            wcag: { primary: { criterion: '1.1.1', level: 'A' } },
        });
        expect(result.violations[0]?.message).toContain(alt);
    });

    it.each(['Fibre router on a desk', 'Swisscom logo', 'Two people looking at a phone. Photo taken outdoors.'])(
        'leaves descriptive alt text alone: "%s"',
        (alt) => {
            const result = analyzeImageAltText({
                strategyResults: [strategyResult('arrow', createSteps([image(alt)]))],
            });

            expect(result.violations).toEqual([]);
            expect(result.summary.totalImages).toBe(1);
        }
    );

    it('does not report a decorative image with an empty alt', () => {
        const result = analyzeImageAltText({ strategyResults: [strategyResult('arrow', createSteps([image('')]))] });

        expect(result.violations).toEqual([]);
    });

    it('recognises an image from its HTML even when the role says otherwise', () => {
        const steps = createSteps([
            {
                role: 'link',
                name: 'IMG_9.png',
                itemText: 'IMG_9.png',
                htmlSnippet: '<img src="/a.png" alt="IMG_9.png">',
            },
        ]);

        const result = analyzeImageAltText({ strategyResults: [strategyResult('link', steps)] });

        expect(result.violations).toHaveLength(1);
    });

    it('ignores non-image elements', () => {
        const steps = createSteps([{ role: 'link', name: 'photo.jpg', itemText: 'photo.jpg' }]);

        const result = analyzeImageAltText({ strategyResults: [strategyResult('link', steps)] });

        expect(result.violations).toEqual([]);
        expect(result.summary.totalImages).toBe(0);
    });

    it('counts an image once when several strategies reached it', () => {
        const steps = createSteps([image('IMG_1234.jpg')]);

        const result = analyzeImageAltText({
            strategyResults: [strategyResult('arrow', steps), strategyResult('link', steps)],
        });

        expect(result.summary).toMatchObject({ totalImages: 1, violationsFound: 1 });
    });

    it('reports each offending image separately', () => {
        const steps = createSteps([image('IMG_1.jpg'), image('Fibre router'), image('DSC_2.jpg')]);

        const result = analyzeImageAltText({ strategyResults: [strategyResult('arrow', steps)] });

        expect(result.summary).toMatchObject({ totalImages: 3, violationsFound: 2 });
        expect(result.summary.byIssue['filename-as-alt']).toBe(2);
    });
});
