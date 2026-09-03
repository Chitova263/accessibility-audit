import { describe, it, expect } from 'vitest';
import { rule } from './duplicate-landmark';
import { createSteps, strategyResult, mockContext } from '../../test-fixtures';
import type { StepOverrides } from '../../test-fixtures';

const landmark = (role: string, name: string, identifier?: string): StepOverrides => ({
    role,
    name,
    focusedElementText: name || role,
    identifier: identifier ?? `${role}-${name || 'unnamed'}`,
    htmlSnippet: `<${role === 'navigation' ? 'nav' : role}>`,
});

describe('duplicate-landmark rule', () => {
    it('has correct metadata', () => {
        expect(rule.id).toBe('duplicate-landmark');
        expect(rule.meta.impact).toBe('moderate');
        expect(rule.meta.wcag.primary.criterion).toBe('1.3.1');
    });

    it('reports same-role landmarks that share a name', async () => {
        const steps = createSteps([
            landmark('main', 'Main content'),
            landmark('navigation', 'Menu', 'nav-a'),
            landmark('navigation', 'Menu', 'nav-b'),
        ]);

        const result = await rule.run(mockContext([strategyResult('landmark', steps)]));

        expect(result.violations).toHaveLength(2);
        expect(result.violations[0]!.rule.id).toBe('duplicate-landmark');
        expect(result.violations[0]!.message).toContain('same name "Menu"');
        expect(result.stats).toMatchObject({
            totalLandmarks: 3,
            violationsFound: 2,
        });
    });

    it('reports same-role landmarks that are all unnamed', async () => {
        const steps = createSteps([
            landmark('main', 'Main content'),
            landmark('navigation', '', 'nav-a'),
            landmark('navigation', '', 'nav-b'),
        ]);

        const result = await rule.run(mockContext([strategyResult('landmark', steps)]));

        expect(result.violations).toHaveLength(2);
        expect(result.violations[0]!.message).toContain('without unique names');
    });

    it('matches names case- and whitespace-insensitively', async () => {
        const steps = createSteps([
            landmark('main', 'Main content'),
            landmark('navigation', 'Menu', 'nav-a'),
            landmark('navigation', '  menu  ', 'nav-b'),
        ]);

        const result = await rule.run(mockContext([strategyResult('landmark', steps)]));

        expect(result.violations).toHaveLength(2);
    });

    it('stays silent when landmarks have unique names', async () => {
        const steps = createSteps([
            landmark('banner', 'Header'),
            landmark('navigation', 'Primary'),
            landmark('main', 'Main content'),
            landmark('navigation', 'Footer links'),
        ]);

        const result = await rule.run(mockContext([strategyResult('landmark', steps)]));

        expect(result.violations).toHaveLength(0);
    });

    it('stays silent when only one landmark of each type', async () => {
        const steps = createSteps([
            landmark('banner', 'Header'),
            landmark('navigation', 'Nav'),
            landmark('main', 'Main'),
        ]);

        const result = await rule.run(mockContext([strategyResult('landmark', steps)]));

        expect(result.violations).toHaveLength(0);
    });

    it('ignores landmarks surfaced by non-landmark strategies', async () => {
        const steps = createSteps([landmark('navigation', 'Menu', 'nav-a'), landmark('navigation', 'Menu', 'nav-b')]);

        const result = await rule.run(mockContext([strategyResult('tab', steps)]));

        expect(result.violations).toHaveLength(0);
        expect(result.stats!.totalLandmarks).toBe(0);
    });
});
