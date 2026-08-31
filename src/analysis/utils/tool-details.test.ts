import { describe, it, expect } from 'vitest';
import { createNvdaContext } from './tool-details';
import { runRules, RULES } from '../rules/runner';
import { broadTranscript, mockContext } from '../rules/test-fixtures';
import type { NvdaViolation } from '../core/violation';

describe('createNvdaContext', () => {
    const source = {
        identifier: 'step-0',
        spokenPhrases: ['button', 'Submit'],
        itemText: 'Submit',
        axNode: undefined as unknown,
    };

    it('flattens the AX node role and name off their AXValue wrappers', async () => {
        const axNode = { nodeId: '7', role: { value: 'button' }, name: { value: 'Submit' } };

        const context = createNvdaContext({ ...source, axNode }, 'tab', 3);

        expect(context.axNode).toEqual({ nodeId: '7', role: 'button', name: 'Submit', properties: undefined });
    });

    it('keeps AX properties as-is', async () => {
        const properties = [{ name: 'level', value: { value: 2 } }];
        const axNode = { nodeId: '1', role: { value: 'heading' }, name: { value: 'About' }, properties };

        expect(createNvdaContext({ ...source, axNode }, 'heading', 0).axNode?.properties).toEqual(properties);
    });

    it('drops backendDOMNodeId and childIds from the axNode', async () => {
        const axNode = { nodeId: '1', role: { value: 'link' }, childIds: ['2', '3'], backendDOMNodeId: 44 };

        expect(Object.keys(createNvdaContext({ ...source, axNode }, 'link', 0).axNode!)).toEqual(['nodeId', 'role']);
    });

    it('carries source info through', async () => {
        const context = createNvdaContext(source, 'tab', 3);

        expect(context.source).toEqual({
            strategy: 'tab',
            stepIndex: 3,
            stepId: 'step-0',
            spokenPhrase: 'button Submit',
        });
    });

    it('reports no node when the step had none', async () => {
        expect(createNvdaContext(source, 'tab', 0).axNode).toBeUndefined();
    });

    it('survives a node missing its role and name', async () => {
        expect(createNvdaContext({ ...source, axNode: { nodeId: '9' } }, 'tab', 0).axNode).toEqual({
            nodeId: '9',
        });
    });
});

describe('context shape across all rules', () => {
    const transcript = broadTranscript();

    const nvdaRules = RULES.filter((rule) => rule.id !== 'axe-core');

    it('reports axNode.role as a string, never a raw AXValue', async () => {
        const { violations } = await runRules(mockContext(transcript), nvdaRules);

        const withNodes = (violations as NvdaViolation[]).filter(
            (violation) => violation.context?.axNode !== undefined
        );

        expect(withNodes.length).toBeGreaterThan(0);

        const wrongShape = withNodes.filter((violation) => typeof violation.context.axNode?.role !== 'string');

        expect(wrongShape).toEqual([]);
    });

    it('produces the same violations on repeated runs', async () => {
        const context = mockContext(transcript);

        const first = await runRules(context, nvdaRules);
        const second = await runRules(context, nvdaRules);

        expect(JSON.stringify(second.violations)).toBe(JSON.stringify(first.violations));
    });
});
