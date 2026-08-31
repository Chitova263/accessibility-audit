import { describe, it, expect } from 'vitest';
import { rule } from './missing-main-landmark';
import { createSteps, strategyResult, mockContext } from '../../test-fixtures';
import type { StepOverrides } from '../../test-fixtures';

const landmark = (role: string, name: string): StepOverrides => ({
    role,
    name,
    itemText: name || role,
    identifier: `${role}-${name || 'unnamed'}`,
    htmlSnippet: `<${role === 'navigation' ? 'nav' : role}>`,
});

describe('missing-main-landmark rule', () => {
    it('has correct metadata', () => {
        expect(rule.id).toBe('missing-main-landmark');
        expect(rule.meta.impact).toBe('serious');
        expect(rule.meta.wcag.primary.criterion).toBe('1.3.1');
    });

    it('reports a page with landmarks but no main', async () => {
        const steps = createSteps([landmark('banner', 'Header'), landmark('navigation', 'Primary')]);

        const result = await rule.run(mockContext([strategyResult('landmark', steps)]));

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]!.rule.id).toBe('missing-main-landmark');
        expect(result.violations[0]!.message).toContain('missing a "main" landmark');
        expect(result.stats).toMatchObject({
            totalLandmarks: 2,
            violationsFound: 1,
        });
    });

    it('stays silent when page has main landmark', async () => {
        const steps = createSteps([
            landmark('banner', 'Header'),
            landmark('main', 'Main content'),
            landmark('navigation', 'Footer'),
        ]);

        const result = await rule.run(mockContext([strategyResult('landmark', steps)]));

        expect(result.violations).toHaveLength(0);
    });

    it('stays silent when no landmarks were found at all', async () => {
        const result = await rule.run(mockContext([strategyResult('landmark', [])]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.totalLandmarks).toBe(0);
    });

    it('ignores landmarks surfaced by non-landmark strategies', async () => {
        const steps = createSteps([landmark('banner', 'Header')]);

        const result = await rule.run(mockContext([strategyResult('arrow', steps), strategyResult('tab', steps)]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.totalLandmarks).toBe(0);
    });

    it('skips steps with no accessibility node', async () => {
        const steps = createSteps([{ axNode: false }]);

        const result = await rule.run(mockContext([strategyResult('landmark', steps)]));

        expect(result.stats!.totalLandmarks).toBe(0);
    });
});
