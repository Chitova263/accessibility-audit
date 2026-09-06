import { describe, it, expect } from 'vitest';
import { buildViolationsData, buildViolationsSection } from './violations-section';
import type { Violation, ScreenReaderViolation } from '../../../analysis/core/violation';
import type { PromptStrategySection } from '../schemas';

interface AxeContext {
    nodes: unknown[];
    tags: string[];
}

const createViolation = (overrides: Partial<Violation<AxeContext>> = {}): Violation<AxeContext> => ({
    id: 'test-violation-1',
    rule: {
        id: 'button-name',
        summary: 'Buttons must have discernible text',
        wcag: {
            primary: { criterion: '4.1.2', level: 'A' },
        },
        impact: 'critical',
    },
    message: 'Buttons must have discernible text',
    element: {
        htmlSnippet: '<button class="submit-btn"></button>',
        selector: 'button.submit-btn',
    },
    tool: 'external-tool',
    timestamp: 1234567890,
    context: {
        nodes: [],
        tags: [],
    },
    ...overrides,
});

const createScreenReaderViolation = (overrides: Partial<ScreenReaderViolation> = {}): ScreenReaderViolation => ({
    id: 'nvda-violation-1',
    rule: {
        id: 'empty-accessible-name',
        summary: 'Button has no accessible name',
        wcag: {
            primary: { criterion: '4.1.2', level: 'A' },
        },
        impact: 'serious',
    },
    message: 'Button has no accessible name',
    element: {
        htmlSnippet: '<button></button>',
        selector: 'button',
    },
    tool: 'screen-reader-audit',
    timestamp: 1234567890,
    context: {
        source: {
            screenReader: 'nvda',
            strategy: 'tab',
            stepIndex: 5,
            stepId: 'step-5',
            spokenPhrase: 'button',
        },
    },
    ...overrides,
});

const createStrategySection = (overrides: Partial<PromptStrategySection> = {}): PromptStrategySection => ({
    strategyName: 'tab',
    description: 'Tab through focusable elements',
    totalSteps: 10,
    completionReason: { kind: 'cycle-complete', detail: 'tab focus cycled through all elements' },
    steps: [
        {
            index: 0,
            identifier: 'step-0',
            spoken: 'Skip to main content, link',
            focusedElementText: 'Skip to main content',
            axNode: {
                role: 'link',
                name: 'Skip to main content',
            },
            htmlSnippet: '<a href="#main">Skip to main content</a>',
        },
        {
            index: 5,
            identifier: 'step-5',
            spoken: 'button',
            focusedElementText: 'button',
            axNode: {
                role: 'button',
                name: '',
            },
            htmlSnippet: '<button></button>',
        },
    ],
    ...overrides,
});

describe('buildViolationsSection', () => {
    it('should build complete section from violations array', () => {
        const violations: Violation[] = [
            createViolation({ id: 'v1' }),
            createViolation({
                id: 'v2',
                rule: {
                    id: 'link-name',
                    summary: 'Links must have text',
                    wcag: { primary: { criterion: '4.1.2', level: 'A' } },
                    impact: 'critical',
                },
                message: 'Links must have text',
            }),
            createScreenReaderViolation({ id: 'v3' }),
        ];

        const strategySections = [createStrategySection()];

        expect(buildViolationsSection(violations, strategySections)).toMatchSnapshot();
    });

    it('should build section with grouping disabled', () => {
        const violations: Violation[] = [
            createViolation({ id: 'v1' }),
            createViolation({ id: 'v2' }), // Same rule
        ];

        expect(buildViolationsSection(violations, [], { groupByRule: false })).toMatchSnapshot();
    });

    it('should filter by impact', () => {
        const violations: Violation[] = [
            createViolation({
                id: 'v1',
                rule: {
                    id: 'button-name',
                    summary: 'Buttons must have discernible text',
                    wcag: { primary: { criterion: '4.1.2', level: 'A' } },
                    impact: 'critical',
                },
            }),
            createViolation({
                id: 'v2',
                rule: {
                    id: 'button-name',
                    summary: 'Buttons must have discernible text',
                    wcag: { primary: { criterion: '4.1.2', level: 'A' } },
                    impact: 'moderate',
                },
            }),
            createViolation({
                id: 'v3',
                rule: {
                    id: 'button-name',
                    summary: 'Buttons must have discernible text',
                    wcag: { primary: { criterion: '4.1.2', level: 'A' } },
                    impact: 'minor',
                },
            }),
        ];

        expect(buildViolationsSection(violations, [], { includeImpacts: ['critical', 'moderate'] })).toMatchSnapshot();
    });

    it('should limit violations per group', () => {
        const violations: Violation[] = [
            createViolation({ id: 'v1' }),
            createViolation({ id: 'v2' }),
            createViolation({ id: 'v3' }),
            createViolation({ id: 'v4' }),
            createViolation({ id: 'v5' }),
        ];

        expect(buildViolationsSection(violations, [], { maxViolationsPerGroup: 2 })).toMatchSnapshot();
    });
});

describe('buildViolationsData', () => {
    it('should build data structure with correlations', () => {
        const violations: Violation[] = [createScreenReaderViolation()];
        const strategySections = [createStrategySection()];

        const data = buildViolationsData(violations, strategySections, { includeCorrelations: true });
        expect(data).toMatchSnapshot();
    });

    it('should build data structure without correlations', () => {
        const violations: Violation[] = [createScreenReaderViolation()];

        const data = buildViolationsData(violations, [], { includeCorrelations: false });
        expect(data).toMatchSnapshot();
    });

    it('should truncate long HTML snippets', () => {
        const violations: Violation[] = [
            createViolation({
                id: 'long-html',
                element: {
                    htmlSnippet: '<div>' + 'x'.repeat(1000) + '</div>',
                    selector: 'div',
                },
            }),
        ];

        const data = buildViolationsData(violations, [], {
            includeHtmlSnippets: true,
            maxHtmlSnippetLength: 100,
        });
        expect(data).toMatchSnapshot();
    });
});
