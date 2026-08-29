import { describe, it, expect } from 'vitest';
import type { Page } from 'playwright';
import { createToolDetails } from './tool-details';
import { CHECKS, runChecks } from './registry';
import { broadTranscript } from './analyzers/test-fixtures';
import type { NvdaViolation } from './violation';

describe('createToolDetails', () => {
    const source = { spokenPhrases: ['button', 'Submit'], itemText: 'Submit', axNode: undefined as unknown };

    it('flattens the AX node role and name off their AXValue wrappers', () => {
        const axNode = { nodeId: '7', role: { value: 'button' }, name: { value: 'Submit' } };

        const details = createToolDetails({ ...source, axNode }, 'tab', 3);

        expect(details.axNode).toEqual({ nodeId: '7', role: 'button', name: 'Submit', properties: undefined });
    });

    it('keeps AX properties as-is', () => {
        const properties = [{ name: 'level', value: { value: 2 } }];
        const axNode = { nodeId: '1', role: { value: 'heading' }, name: { value: 'About' }, properties };

        expect(createToolDetails({ ...source, axNode }, 'heading', 0).axNode?.properties).toEqual(properties);
    });

    it('drops the fields a violation has no use for', () => {
        const axNode = { nodeId: '1', role: { value: 'link' }, childIds: ['2', '3'], backendDOMNodeId: 44 };

        expect(Object.keys(createToolDetails({ ...source, axNode }, 'link', 0).axNode!)).toEqual([
            'nodeId',
            'role',
            'name',
            'properties',
        ]);
    });

    it('carries the spoken output, strategy and step index through', () => {
        const details = createToolDetails(source, 'tab', 3);

        expect(details).toMatchObject({
            spokenPhrases: ['button', 'Submit'],
            itemText: 'Submit',
            navigationStrategy: 'tab',
            stepIndex: 3,
        });
    });

    it('reports no node when the step had none', () => {
        expect(createToolDetails(source, 'tab', 0).axNode).toBeUndefined();
    });

    it('survives a node missing its role and name', () => {
        expect(createToolDetails({ ...source, axNode: { nodeId: '9' } }, 'tab', 0).axNode).toEqual({
            nodeId: '9',
            role: undefined,
            name: undefined,
            properties: undefined,
        });
    });
});

describe('toolDetails shape across every analyzer', () => {
    const strategyResults = broadTranscript();

    it('reports axNode.role as a string, never a raw AXValue', async () => {
        const nvdaChecks = CHECKS.filter((check) => check.id !== 'axe-core');
        const results = await runChecks({ strategyResults, page: {} as Page }, nvdaChecks);

        const withNodes = results
            .flatMap(({ check, violations }) =>
                (violations as NvdaViolation[]).map((violation) => ({ check: check.id, violation }))
            )
            .filter(({ violation }) => violation.toolDetails.axNode !== undefined);

        expect(withNodes.length).toBeGreaterThan(0);

        const wrongShape = withNodes
            .filter(({ violation }) => typeof violation.toolDetails.axNode?.role !== 'string')
            .map(({ check }) => check);

        expect(wrongShape).toEqual([]);
    });

    it('produces the same violations on repeated runs', async () => {
        const context = { strategyResults, page: {} as Page };
        const nvdaChecks = CHECKS.filter((check) => check.id !== 'axe-core');

        const first = await runChecks(context, nvdaChecks);
        const second = await runChecks(context, nvdaChecks);

        expect(JSON.stringify(second.map((r) => r.violations))).toBe(JSON.stringify(first.map((r) => r.violations)));
    });
});
