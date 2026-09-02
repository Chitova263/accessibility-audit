import { describe, it, expect } from 'vitest';
import { createScreenReaderContext } from './tool-details';
import { runRules, RULES } from '../rules/runner';
import { broadTranscript, mockContext } from '../rules/test-fixtures';
import type { ScreenReaderViolation } from '../core/violation';

describe('createScreenReaderContext', () => {
    const source = {
        identifier: 'step-0',
        spokenPhrases: ['button', 'Submit'],
        itemText: 'Submit',
        axNode: undefined as unknown,
    };

    it('flattens the AX node role and name off their AXValue wrappers', async () => {
        const axNode = { nodeId: '7', role: { value: 'button' }, name: { value: 'Submit' } };

        const context = createScreenReaderContext({ ...source, axNode }, 'tab', 3, 'nvda');

        expect(context.axNode).toEqual({ nodeId: '7', role: 'button', name: 'Submit', properties: undefined });
    });

    it('keeps AX properties as-is', async () => {
        const properties = [{ name: 'level', value: { value: 2 } }];
        const axNode = { nodeId: '1', role: { value: 'heading' }, name: { value: 'About' }, properties };

        expect(createScreenReaderContext({ ...source, axNode }, 'heading', 0, 'nvda').axNode?.properties).toEqual(
            properties
        );
    });

    it('drops backendDOMNodeId and childIds from the axNode', async () => {
        const axNode = { nodeId: '1', role: { value: 'link' }, childIds: ['2', '3'], backendDOMNodeId: 44 };

        expect(Object.keys(createScreenReaderContext({ ...source, axNode }, 'link', 0, 'nvda').axNode!)).toEqual([
            'nodeId',
            'role',
        ]);
    });

    it('carries source info through', async () => {
        const context = createScreenReaderContext(source, 'tab', 3, 'nvda');

        expect(context.source).toEqual({
            screenReader: 'nvda',
            strategy: 'tab',
            stepIndex: 3,
            stepId: 'step-0',
            spokenPhrase: 'button Submit',
        });
    });

    it('reports no node when the step had none', async () => {
        expect(createScreenReaderContext(source, 'tab', 0, 'nvda').axNode).toBeUndefined();
    });

    it('survives a node missing its role and name', async () => {
        expect(createScreenReaderContext({ ...source, axNode: { nodeId: '9' } }, 'tab', 0, 'nvda').axNode).toEqual({
            nodeId: '9',
        });
    });
});

describe('context shape across all rules', () => {
    const transcript = broadTranscript();

    const screenReaderRules = RULES.filter((rule) => rule.id !== 'axe-core');

    it('reports axNode.role as a string, never a raw AXValue', async () => {
        const { violations } = await runRules(mockContext(transcript), screenReaderRules);

        const withNodes = (violations as ScreenReaderViolation[]).filter(
            (violation) => violation.context?.axNode !== undefined
        );

        expect(withNodes.length).toBeGreaterThan(0);

        const wrongShape = withNodes.filter((violation) => typeof violation.context.axNode?.role !== 'string');

        expect(wrongShape).toEqual([]);
    });

    it('produces the same violations on repeated runs', async () => {
        const context = mockContext(transcript);

        const first = await runRules(context, screenReaderRules);
        const second = await runRules(context, screenReaderRules);

        expect(JSON.stringify(second.violations)).toBe(JSON.stringify(first.violations));
    });
});
