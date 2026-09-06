import { describe, it, expect } from 'vitest';
import { summarizeViolations } from './summarize-violations';
import type { Violation } from '../core/violation';

const violation = (overrides: Partial<Violation> = {}): Violation => ({
    id: 'v1',
    rule: {
        id: 'empty-accessible-name',
        summary: 'Interactive element has no accessible name',
        wcag: { primary: { criterion: '4.1.2', level: 'A' } },
        impact: 'serious',
    },
    message: 'x',
    element: {},
    tool: 'screen-reader-audit',
    timestamp: 0,
    context: {},
    ...overrides,
});

describe('summarizeViolations', () => {
    it('counts by tool, impact and rule', async () => {
        const totals = summarizeViolations([
            violation({
                tool: 'screen-reader-audit',
                rule: {
                    id: 'empty-accessible-name',
                    summary: '',
                    wcag: { primary: { criterion: '4.1.2', level: 'A' } },
                    impact: 'serious',
                },
            }),
            violation({
                tool: 'screen-reader-audit',
                rule: {
                    id: 'focus-trap',
                    summary: '',
                    wcag: { primary: { criterion: '2.1.2', level: 'A' } },
                    impact: 'critical',
                },
            }),
            violation({
                tool: 'external-tool',
                rule: {
                    id: 'color-contrast',
                    summary: '',
                    wcag: { primary: { criterion: '1.4.3', level: 'AA' } },
                    impact: 'serious',
                },
            }),
        ]);

        expect(totals).toEqual({
            total: 3,
            byTool: { 'screen-reader-audit': 2, 'external-tool': 1 },
            byImpact: { serious: 2, critical: 1 },
            byRule: { 'empty-accessible-name': 1, 'focus-trap': 1, 'color-contrast': 1 },
        });
    });

    it('handles an empty run', async () => {
        expect(summarizeViolations([])).toEqual({ total: 0, byTool: {}, byImpact: {}, byRule: {} });
    });
});
