import { describe, it, expect } from 'vitest';
import { rule } from './empty-accessible-name';
import { mockContext, strategyResult, createSteps } from '../../test-fixtures';

describe('empty-accessible-name rule', () => {
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

    describe('clickable generic elements', () => {
        it('reports a clickable generic element with no accessible name', async () => {
            const transcript = [
                strategyResult('arrow', createSteps([{ role: 'generic', name: '', focusedElementText: 'clickable' }])),
            ];

            const result = await rule.run(mockContext(transcript));

            expect(result.violations).toHaveLength(1);
            expect(result.violations[0]!.rule.id).toBe('empty-accessible-name');
            expect(result.violations[0]!.message).toContain('Clickable element has no accessible name');
            expect(result.violations[0]!.message).toContain('announce only "clickable"');
            expect(result.stats).toMatchObject({
                totalElementsChecked: 1,
                violationsFound: 1,
                byRole: { generic: 1 },
            });
        });

        it('reports clickable group elements with no accessible name', async () => {
            const transcript = [
                strategyResult(
                    'arrow',
                    createSteps([
                        { role: 'group', name: '', focusedElementText: 'Product 1 of 4, grouping, clickable' },
                    ])
                ),
            ];

            const result = await rule.run(mockContext(transcript));

            expect(result.violations).toHaveLength(1);
            expect(result.violations[0]!.message).toContain('Clickable element has no accessible name');
        });

        it('ignores generic elements that are not clickable', async () => {
            const transcript = [
                strategyResult('arrow', createSteps([{ role: 'generic', name: '', focusedElementText: 'some text' }])),
            ];

            const result = await rule.run(mockContext(transcript));

            expect(result.violations).toHaveLength(0);
        });

        it('ignores clickable generic elements with an accessible name', async () => {
            const transcript = [
                strategyResult(
                    'arrow',
                    createSteps([{ role: 'generic', name: 'Product Card', focusedElementText: 'clickable' }])
                ),
            ];

            const result = await rule.run(mockContext(transcript));

            expect(result.violations).toHaveLength(0);
        });

        it('deduplicates violations for the same element across strategies', async () => {
            const transcript = [
                strategyResult(
                    'arrow',
                    createSteps([{ role: 'generic', name: '', focusedElementText: 'clickable', backendDOMNodeId: 123 }])
                ),
                strategyResult(
                    'tab',
                    createSteps([{ role: 'generic', name: '', focusedElementText: 'clickable', backendDOMNodeId: 123 }])
                ),
            ];

            const result = await rule.run(mockContext(transcript));

            expect(result.violations).toHaveLength(1);
        });

        it('reports multiple distinct clickable elements with no name', async () => {
            const transcript = [
                strategyResult(
                    'arrow',
                    createSteps([
                        { role: 'generic', name: '', focusedElementText: 'clickable', backendDOMNodeId: 100 },
                        { role: 'generic', name: '', focusedElementText: 'clickable', backendDOMNodeId: 101 },
                        { role: 'group', name: '', focusedElementText: 'grouping, clickable', backendDOMNodeId: 102 },
                    ])
                ),
            ];

            const result = await rule.run(mockContext(transcript));

            expect(result.violations).toHaveLength(3);
            expect(result.stats!.byRole).toMatchObject({ generic: 2, group: 1 });
        });

        it('handles case-insensitive clickable detection', async () => {
            const transcript = [
                strategyResult(
                    'arrow',
                    createSteps([{ role: 'generic', name: '', focusedElementText: 'CLICKABLE element' }])
                ),
            ];

            const result = await rule.run(mockContext(transcript));

            expect(result.violations).toHaveLength(1);
        });
    });
});
