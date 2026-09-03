import { describe, it, expect, vi, beforeEach } from 'vitest';
import { attachScreenshots } from './screenshot-capture';
import type { Violation, ScreenReaderViolation } from '../core/violation';

// Mock fs/promises
vi.mock('fs/promises', () => ({
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
}));

describe('attachScreenshots', () => {
    const mockPage = {
        viewportSize: () => ({ width: 1280, height: 720 }),
        screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-png')),
        waitForTimeout: vi.fn().mockResolvedValue(undefined),
        evaluate: vi.fn().mockResolvedValue(undefined),
    };

    const mockCdp = {
        send: vi.fn().mockImplementation((method: string) => {
            if (method === 'DOM.getBoxModel') {
                return { model: { content: [10, 10, 110, 10, 110, 60, 10, 60] } };
            }
            if (method === 'DOM.resolveNode') {
                return { object: { objectId: 'obj-1' } };
            }
            return {};
        }),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const createViolation = (id: string, ruleId: string, backendDOMNodeId?: number): ScreenReaderViolation => ({
        id,
        rule: {
            id: ruleId,
            summary: `Test rule ${ruleId}`,
            wcag: { primary: { criterion: '1.1.1', level: 'A' } },
            impact: 'serious',
        },
        message: 'Test violation',
        tool: 'screen-reader-audit',
        timestamp: Date.now(),
        context: {
            source: {
                screenReader: 'nvda',
                strategy: 'tab',
                stepIndex: 0,
                stepId: id,
                spokenPhrase: 'test',
            },
            axNode:
                backendDOMNodeId !== undefined
                    ? { nodeId: '1', role: 'button', backendDOMNodeId }
                    : { nodeId: '1', role: 'button' },
        },
    });

    it('returns violations unchanged when they have no backendDOMNodeId', async () => {
        const violations = [createViolation('v1', 'rule-a'), createViolation('v2', 'rule-b')];

        const result = await attachScreenshots(violations, mockPage as never, mockCdp as never, '/tmp/output');

        expect(result).toHaveLength(2);
        expect(result[0]!.context.screenshot).toBeUndefined();
        expect(result[1]!.context.screenshot).toBeUndefined();
        expect(mockPage.screenshot).not.toHaveBeenCalled();
    });

    it('attaches screenshots to violations with backendDOMNodeId', async () => {
        const violations = [createViolation('v1', 'empty-button', 42)];

        const result = await attachScreenshots(violations, mockPage as never, mockCdp as never, '/tmp/output');

        expect(result).toHaveLength(1);
        expect(result[0]!.context.screenshot).toBeDefined();
        expect((result[0]!.context.screenshot as { path: string }).path).toBe('screenshots/empty-button-v1.png');
        expect(mockPage.screenshot).toHaveBeenCalledTimes(1);
    });

    it('returns a new array (immutable)', async () => {
        const violations = [createViolation('v1', 'rule-a', 42)];
        const result = await attachScreenshots(violations, mockPage as never, mockCdp as never, '/tmp/output');

        expect(result).not.toBe(violations);
        expect(result[0]!).not.toBe(violations[0]!);
    });

    it('processes mixed violations - some with backendDOMNodeId, some without', async () => {
        const violations = [
            createViolation('v1', 'rule-a'), // no backendDOMNodeId
            createViolation('v2', 'rule-b', 100), // has backendDOMNodeId
            createViolation('v3', 'rule-c'), // no backendDOMNodeId
        ];

        const result = await attachScreenshots(violations, mockPage as never, mockCdp as never, '/tmp/output');

        expect(result).toHaveLength(3);
        expect(result[0]!.context.screenshot).toBeUndefined();
        expect(result[1]!.context.screenshot).toBeDefined();
        expect(result[2]!.context.screenshot).toBeUndefined();
        expect(mockPage.screenshot).toHaveBeenCalledTimes(1);
    });

    it('passes non-ScreenReaderViolation through unchanged', async () => {
        // An axe-core violation has a different context shape
        const axeViolation: Violation<{ nodes: unknown[]; tags: string[] }> = {
            id: 'axe-1',
            rule: {
                id: 'color-contrast',
                summary: 'Elements must have sufficient color contrast',
                wcag: { primary: { criterion: '1.4.3', level: 'AA' } },
                impact: 'serious',
            },
            message: 'Element has insufficient color contrast',
            tool: 'axe-core',
            timestamp: Date.now(),
            context: {
                nodes: [],
                tags: ['wcag2aa'],
            },
        };

        const result = await attachScreenshots([axeViolation], mockPage as never, mockCdp as never, '/tmp/output');

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(axeViolation);
        expect(mockPage.screenshot).not.toHaveBeenCalled();
    });

    it('uses rule.id and violation.id for filename', async () => {
        const violations = [createViolation('step-123', 'empty-accessible-name', 42)];

        await attachScreenshots(violations, mockPage as never, mockCdp as never, '/tmp/output');

        // The screenshot path should contain rule.id-violation.id
        const result = await attachScreenshots(violations, mockPage as never, mockCdp as never, '/tmp/output');
        expect((result[0]!.context.screenshot as { path: string }).path).toBe(
            'screenshots/empty-accessible-name-step-123.png'
        );
    });
});
