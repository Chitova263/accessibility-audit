import { describe, it, expect } from 'vitest';
import { buildViolationsData, renderViolationsXml, buildViolationsSection } from './violations-section';
import type { Violation, NvdaViolation } from '../../../analysis/core/violation';
import type { PromptStrategySection, PromptViolationsData } from '../schemas';

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
    tool: 'axe-core',
    timestamp: 1234567890,
    context: {
        nodes: [],
        tags: [],
    },
    ...overrides,
});

const createNvdaViolation = (overrides: Partial<NvdaViolation> = {}): NvdaViolation => ({
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
    tool: 'nvda-audit',
    timestamp: 1234567890,
    context: {
        step: {
            strategy: 'tab',
            index: 5,
            id: 'step-5',
            spokenPhrase: 'button',
        },
    },
    ...overrides,
});

const createStrategySection = (overrides: Partial<PromptStrategySection> = {}): PromptStrategySection => ({
    strategyName: 'tab',
    strategyType: 'tab-navigation',
    description: 'Tab through focusable elements',
    mode: 'focus',
    totalSteps: 10,
    completionReason: { kind: 'cycle-complete', detail: 'tab focus cycled through all elements' },
    steps: [
        {
            index: 0,
            identifier: 'step-0',
            spoken: 'Skip to main content, link',
            itemText: 'Skip to main content',
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
            itemText: 'button',
            axNode: {
                role: 'button',
                name: '',
            },
            htmlSnippet: '<button></button>',
        },
    ],
    ...overrides,
});

describe('renderViolationsXml', () => {
    describe('empty violations', () => {
        it('should render empty violations correctly', () => {
            const data: PromptViolationsData = {
                groups: [],
                totalViolations: 0,
                totalRules: 0,
                byImpact: {},
            };

            expect(renderViolationsXml(data)).toMatchSnapshot();
        });
    });

    describe('single violation', () => {
        it('should render a single violation with all fields', () => {
            const data: PromptViolationsData = {
                groups: [
                    {
                        ruleId: 'button-name',
                        wcag: '4.1.2 A',
                        wcagLevel: 'A',
                        impact: 'critical',
                        count: 1,
                        violations: [
                            {
                                id: 'test-1',
                                ruleId: 'button-name',
                                wcag: '4.1.2 A',
                                wcagLevel: 'A',
                                impact: 'critical',
                                message: 'Buttons must have discernible text',
                                selector: 'button.submit-btn',
                                htmlSnippet: '<button class="submit-btn"></button>',
                            },
                        ],
                    },
                ],
                totalViolations: 1,
                totalRules: 1,
                byImpact: { critical: 1 },
            };

            expect(renderViolationsXml(data)).toMatchSnapshot();
        });

        it('should render a violation without optional fields', () => {
            const data: PromptViolationsData = {
                groups: [
                    {
                        ruleId: 'color-contrast',
                        wcag: '1.4.3 AA',
                        wcagLevel: 'AA',
                        impact: 'serious',
                        count: 1,
                        violations: [
                            {
                                id: 'test-2',
                                ruleId: 'color-contrast',
                                wcag: '1.4.3 AA',
                                wcagLevel: 'AA',
                                impact: 'serious',
                                message: 'Elements must have sufficient color contrast',
                                // No selector, no htmlSnippet, no correlation
                            },
                        ],
                    },
                ],
                totalViolations: 1,
                totalRules: 1,
                byImpact: { serious: 1 },
            };

            expect(renderViolationsXml(data)).toMatchSnapshot();
        });

        it('should render a violation with transcript correlation', () => {
            const data: PromptViolationsData = {
                groups: [
                    {
                        ruleId: 'empty-accessible-name',
                        wcag: '4.1.2 A',
                        wcagLevel: 'A',
                        impact: 'serious',
                        count: 1,
                        violations: [
                            {
                                id: 'nvda-1',
                                ruleId: 'empty-accessible-name',
                                wcag: '4.1.2 A',
                                wcagLevel: 'A',
                                impact: 'serious',
                                message: 'Button has no accessible name',
                                selector: 'button.icon-btn',
                                htmlSnippet: '<button class="icon-btn"><svg>...</svg></button>',
                                correlation: {
                                    strategyName: 'tab',
                                    stepIndex: 5,
                                    spoken: 'button',
                                    confidence: 'high',
                                },
                            },
                        ],
                    },
                ],
                totalViolations: 1,
                totalRules: 1,
                byImpact: { serious: 1 },
            };

            expect(renderViolationsXml(data)).toMatchSnapshot();
        });
    });

    describe('multiple violations', () => {
        it('should render multiple violations grouped by rule', () => {
            const data: PromptViolationsData = {
                groups: [
                    {
                        ruleId: 'button-name',
                        wcag: '4.1.2 A',
                        wcagLevel: 'A',
                        impact: 'critical',
                        count: 2,
                        violations: [
                            {
                                id: 'btn-1',
                                ruleId: 'button-name',
                                wcag: '4.1.2 A',
                                wcagLevel: 'A',
                                impact: 'critical',
                                message: 'Buttons must have discernible text',
                                selector: '#submit',
                            },
                            {
                                id: 'btn-2',
                                ruleId: 'button-name',
                                wcag: '4.1.2 A',
                                wcagLevel: 'A',
                                impact: 'critical',
                                message: 'Buttons must have discernible text',
                                selector: '#cancel',
                            },
                        ],
                    },
                    {
                        ruleId: 'link-name',
                        wcag: '4.1.2 A',
                        wcagLevel: 'A',
                        impact: 'serious',
                        count: 1,
                        violations: [
                            {
                                id: 'link-1',
                                ruleId: 'link-name',
                                wcag: '4.1.2 A',
                                wcagLevel: 'A',
                                impact: 'serious',
                                message: 'Links must have discernible text',
                                selector: 'a.icon-link',
                            },
                        ],
                    },
                ],
                totalViolations: 3,
                totalRules: 2,
                byImpact: { critical: 2, serious: 1 },
            };

            expect(renderViolationsXml(data)).toMatchSnapshot();
        });

        it('should render truncated groups with showing attribute', () => {
            const data: PromptViolationsData = {
                groups: [
                    {
                        ruleId: 'color-contrast',
                        wcag: '1.4.3 AA',
                        wcagLevel: 'AA',
                        impact: 'serious',
                        count: 50, // Total count
                        violations: [
                            // Only showing 3
                            {
                                id: 'cc-1',
                                ruleId: 'color-contrast',
                                wcag: '1.4.3 AA',
                                wcagLevel: 'AA',
                                impact: 'serious',
                                message: 'Elements must have sufficient color contrast',
                                selector: '.text-light',
                            },
                            {
                                id: 'cc-2',
                                ruleId: 'color-contrast',
                                wcag: '1.4.3 AA',
                                wcagLevel: 'AA',
                                impact: 'serious',
                                message: 'Elements must have sufficient color contrast',
                                selector: '.text-muted',
                            },
                            {
                                id: 'cc-3',
                                ruleId: 'color-contrast',
                                wcag: '1.4.3 AA',
                                wcagLevel: 'AA',
                                impact: 'serious',
                                message: 'Elements must have sufficient color contrast',
                                selector: '.placeholder',
                            },
                        ],
                    },
                ],
                totalViolations: 50,
                totalRules: 1,
                byImpact: { serious: 50 },
            };

            expect(renderViolationsXml(data)).toMatchSnapshot();
        });
    });

    describe('XML escaping', () => {
        it('should properly escape special characters in message', () => {
            const data: PromptViolationsData = {
                groups: [
                    {
                        ruleId: 'test-rule',
                        wcag: '1.1.1 A',
                        wcagLevel: 'A',
                        impact: 'moderate',
                        count: 1,
                        violations: [
                            {
                                id: 'escape-test',
                                ruleId: 'test-rule',
                                wcag: '1.1.1 A',
                                wcagLevel: 'A',
                                impact: 'moderate',
                                message: 'Text contains <special> & "characters" that\'s problematic',
                                selector: '[data-attr="value"]',
                            },
                        ],
                    },
                ],
                totalViolations: 1,
                totalRules: 1,
                byImpact: { moderate: 1 },
            };

            expect(renderViolationsXml(data)).toMatchSnapshot();
        });

        it('should handle CDATA for HTML snippets with special content', () => {
            const data: PromptViolationsData = {
                groups: [
                    {
                        ruleId: 'test-rule',
                        wcag: '1.1.1 A',
                        wcagLevel: 'A',
                        impact: 'moderate',
                        count: 1,
                        violations: [
                            {
                                id: 'cdata-test',
                                ruleId: 'test-rule',
                                wcag: '1.1.1 A',
                                wcagLevel: 'A',
                                impact: 'moderate',
                                message: 'Test message',
                                htmlSnippet: '<div class="test" data-value="foo & bar">Content with <b>tags</b></div>',
                            },
                        ],
                    },
                ],
                totalViolations: 1,
                totalRules: 1,
                byImpact: { moderate: 1 },
            };

            expect(renderViolationsXml(data)).toMatchSnapshot();
        });
    });
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
            createNvdaViolation({ id: 'v3' }),
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
        const violations: Violation[] = [createNvdaViolation()];
        const strategySections = [createStrategySection()];

        const data = buildViolationsData(violations, strategySections, { includeCorrelations: true });
        expect(data).toMatchSnapshot();
    });

    it('should build data structure without correlations', () => {
        const violations: Violation[] = [createNvdaViolation()];

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
