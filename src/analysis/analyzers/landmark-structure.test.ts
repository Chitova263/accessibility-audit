import { describe, it, expect } from 'vitest';
import { analyzeLandmarkStructure } from './landmark-structure';
import { createSteps, strategyResult } from './test-fixtures';
import type { StepOverrides } from './test-fixtures';

const landmark = (role: string, name: string): StepOverrides => ({
    role,
    name,
    itemText: name || role,
    identifier: `${role}-${name || 'unnamed'}`,
    htmlSnippet: `<${role === 'navigation' ? 'nav' : role}>`,
});

describe('analyzeLandmarkStructure', () => {
    it('accepts a page with a main landmark and uniquely named regions', () => {
        const steps = createSteps([
            landmark('banner', 'Header'),
            landmark('navigation', 'Primary'),
            landmark('main', 'Main content'),
            landmark('navigation', 'Footer links'),
        ]);

        const result = analyzeLandmarkStructure({ strategyResults: [strategyResult('landmark', steps)] });

        expect(result.violations).toEqual([]);
        expect(result.summary).toMatchObject({
            totalLandmarks: 4,
            landmarkRoles: ['banner', 'navigation', 'main', 'navigation'],
        });
    });

    it('reports a page with landmarks but no main', () => {
        const steps = createSteps([landmark('banner', 'Header'), landmark('navigation', 'Primary')]);

        const result = analyzeLandmarkStructure({ strategyResults: [strategyResult('landmark', steps)] });

        expect(result.violations.map((v) => v.ruleId)).toEqual(['missing-main-landmark']);
        expect(result.violations[0]).toMatchObject({
            impact: 'serious',
            wcag: { primary: { criterion: '1.3.1', level: 'A' } },
        });
        expect(result.summary.byIssue['missing-main-landmark']).toBe(1);
    });

    it('stays silent when no landmarks were found at all', () => {
        const result = analyzeLandmarkStructure({ strategyResults: [strategyResult('landmark', [])] });

        expect(result.violations).toEqual([]);
        expect(result.summary.totalLandmarks).toBe(0);
    });

    it('reports same-role landmarks that share a name', () => {
        const steps = createSteps([
            landmark('main', 'Main content'),
            { ...landmark('navigation', 'Menu'), identifier: 'nav-a' },
            { ...landmark('navigation', 'Menu'), identifier: 'nav-b' },
        ]);

        const result = analyzeLandmarkStructure({ strategyResults: [strategyResult('landmark', steps)] });

        expect(result.violations.map((v) => v.ruleId)).toEqual(['duplicate-landmark', 'duplicate-landmark']);
        expect(result.violations[0]?.message).toContain('same name "Menu"');
        expect(result.summary.byIssue['duplicate-landmark']).toBe(2);
    });

    it('reports same-role landmarks that are all unnamed', () => {
        const steps = createSteps([
            landmark('main', 'Main content'),
            { ...landmark('navigation', ''), identifier: 'nav-a' },
            { ...landmark('navigation', ''), identifier: 'nav-b' },
        ]);

        const result = analyzeLandmarkStructure({ strategyResults: [strategyResult('landmark', steps)] });

        expect(result.violations).toHaveLength(2);
        expect(result.violations[0]?.message).toContain('without unique names');
    });

    it('matches names case- and whitespace-insensitively', () => {
        const steps = createSteps([
            landmark('main', 'Main content'),
            { ...landmark('navigation', 'Menu'), identifier: 'nav-a' },
            { ...landmark('navigation', '  menu  '), identifier: 'nav-b' },
        ]);

        const result = analyzeLandmarkStructure({ strategyResults: [strategyResult('landmark', steps)] });

        expect(result.violations).toHaveLength(2);
    });

    it('ignores landmarks surfaced by other strategies', () => {
        const steps = createSteps([landmark('banner', 'Header')]);

        const result = analyzeLandmarkStructure({
            strategyResults: [strategyResult('arrow', steps), strategyResult('tab', steps)],
        });

        expect(result.violations).toEqual([]);
        expect(result.summary.totalLandmarks).toBe(0);
    });

    it('skips steps with no accessibility node', () => {
        const steps = createSteps([{ axNode: false }]);

        const result = analyzeLandmarkStructure({ strategyResults: [strategyResult('landmark', steps)] });

        expect(result.summary.totalLandmarks).toBe(0);
    });
});
