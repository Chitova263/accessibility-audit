import { describe, it, expect } from 'vitest';
import { buildTranscriptData, renderTranscriptXml, buildTranscriptSection } from './transcript-section';
import type {
    StrategyResult,
    NavigationStrategyMetadata,
    NavigationStep,
    CompletionReason,
} from '../../../screen-reader/strategies/navigation-strategy';
import type { PromptTranscript } from '../schemas';
import type { AXNode } from '../../../types/cdp';

// Creates a complete NavigationStep with all required fields
const createNavigationStep = (
    index: number,
    overrides: Partial<{
        identifier: string;
        spokenPhrases: string[];
        focusedElementText: string;
        focusedElementTextLog: string[];
        timestamp: number;
        axNode: unknown;
        htmlSnippet: string;
    }> = {}
): NavigationStep => ({
    index,
    identifier: overrides.identifier ?? `step-${index}`,
    spokenPhrases: overrides.spokenPhrases ?? [`Item ${index}`],
    focusedElementText: overrides.focusedElementText ?? `Item ${index}`,
    focusedElementTextLog: overrides.focusedElementTextLog ?? [],
    timestamp: overrides.timestamp ?? Date.now(),
    axNode: overrides.axNode as NavigationStep['axNode'],
    htmlSnippet: overrides.htmlSnippet ?? null,
});

// Helper to add missing focusedElementTextLog and timestamp to inline step objects
const makeStep = (step: Omit<NavigationStep, 'focusedElementTextLog' | 'timestamp'>): NavigationStep => ({
    ...step,
    focusedElementTextLog: [],
    timestamp: Date.now(),
});

const createStrategyResult = (
    overrides: Partial<Omit<StrategyResult, 'meta' | 'completionReason'>> & {
        meta?: Partial<NavigationStrategyMetadata>;
        completionReason?: CompletionReason;
    } = {}
): StrategyResult => {
    const name = overrides.meta?.name ?? 'tab';
    const defaultReason: CompletionReason =
        name === 'tab'
            ? { kind: 'cycle-complete', detail: 'tab focus cycled through all elements' }
            : { kind: 'exhausted', detail: `no more ${name}s found` };
    return {
        meta: {
            name,
            description: overrides.meta?.description ?? 'Tab navigation through focusable elements',
        },
        completionReason: overrides.completionReason ?? defaultReason,
        navigationSteps: overrides.navigationSteps ?? [createNavigationStep(0), createNavigationStep(1)],
    };
};

const createAxNode = (role: string, name: string, extraProps: Record<string, unknown> = {}): AXNode => ({
    nodeId: `node-${Math.random().toString(36).slice(2, 8)}`,
    ignored: false,
    role: { type: 'role' as const, value: role },
    name: { type: 'string' as const, value: name },
    properties: [],
    ...extraProps,
});

const createAxNodeWithProperties = (
    role: string,
    name: string,
    properties: Array<{ name: string; value: { value: unknown } }>
): AXNode =>
    ({
        nodeId: `node-${Math.random().toString(36).slice(2, 8)}`,
        ignored: false,
        role: { type: 'role' as const, value: role },
        name: { type: 'string' as const, value: name },
        properties,
    }) as AXNode;

describe('renderTranscriptXml', () => {
    describe('steps with axNode', () => {
        it('should render step with all axNode properties', () => {
            const transcript: PromptTranscript = {
                sections: [
                    {
                        strategyName: 'tab',
                        description: 'Tab navigation',
                        completionReason: { kind: 'cycle-complete', detail: 'tab focus cycled through all elements' },
                        totalSteps: 1,
                        steps: [
                            {
                                index: 0,
                                identifier: 'complex-0',
                                spoken: 'Complex widget',
                                focusedElementText: 'Complex widget',
                                axNode: {
                                    role: 'treeitem',
                                    name: 'Documents',
                                    description: 'Expandable folder',
                                    value: '5 items',
                                    properties: {
                                        focusable: true,
                                        focused: true,
                                        disabled: false,
                                        expanded: true,
                                        selected: true,
                                        checked: 'mixed',
                                        level: 2,
                                        required: false,
                                        invalid: false,
                                    },
                                },
                                htmlSnippet: null,
                            },
                        ],
                    },
                ],
                totalStrategies: 1,
                totalSteps: 1,
            };

            expect(renderTranscriptXml(transcript)).toMatchSnapshot();
        });
    });

    describe('steps with HTML snippets', () => {
        it('should render step with complex HTML containing special characters', () => {
            const transcript: PromptTranscript = {
                sections: [
                    {
                        strategyName: 'tab',
                        description: 'Tab navigation',
                        completionReason: { kind: 'cycle-complete', detail: 'tab focus cycled through all elements' },
                        totalSteps: 1,
                        steps: [
                            {
                                index: 0,
                                identifier: 'complex-html-0',
                                spoken: 'Product card',
                                focusedElementText: 'Product card',
                                axNode: null,
                                htmlSnippet:
                                    '<div class="card" data-price="$19.99" data-attrs=\'{"sale": true}\'><img src="product.jpg" alt="Widget & Gadget"><span>Price: $19.99</span></div>',
                            },
                        ],
                    },
                ],
                totalStrategies: 1,
                totalSteps: 1,
            };

            expect(renderTranscriptXml(transcript)).toMatchSnapshot();
        });
    });

    describe('multiple strategies', () => {
        it('should render multiple strategies with mixed content', () => {
            const transcript: PromptTranscript = {
                sections: [
                    {
                        strategyName: 'landmark',
                        description: 'Landmark navigation',
                        completionReason: { kind: 'exhausted', detail: 'no more landmarks found on page' },
                        totalSteps: 2,
                        steps: [
                            {
                                index: 0,
                                identifier: 'landmark-0',
                                spoken: 'banner landmark',
                                focusedElementText: 'banner',
                                axNode: { role: 'banner', name: '' },
                                htmlSnippet: '<header role="banner">...</header>',
                            },
                            {
                                index: 1,
                                identifier: 'landmark-1',
                                spoken: 'main landmark',
                                focusedElementText: 'main',
                                axNode: { role: 'main', name: '' },
                                htmlSnippet: '<main>...</main>',
                            },
                        ],
                    },
                    {
                        strategyName: 'heading',
                        description: 'Heading navigation',
                        completionReason: { kind: 'exhausted', detail: 'no more headings found on page' },
                        totalSteps: 3,
                        steps: [
                            {
                                index: 0,
                                identifier: 'h1-0',
                                spoken: 'Welcome, heading, level 1',
                                focusedElementText: 'Welcome',
                                axNode: { role: 'heading', name: 'Welcome', properties: { level: 1 } },
                                htmlSnippet: '<h1>Welcome</h1>',
                            },
                            {
                                index: 1,
                                identifier: 'h2-0',
                                spoken: 'Features, heading, level 2',
                                focusedElementText: 'Features',
                                axNode: { role: 'heading', name: 'Features', properties: { level: 2 } },
                                htmlSnippet: '<h2>Features</h2>',
                            },
                            {
                                index: 2,
                                identifier: 'h2-1',
                                spoken: 'Pricing, heading, level 2',
                                focusedElementText: 'Pricing',
                                axNode: { role: 'heading', name: 'Pricing', properties: { level: 2 } },
                                htmlSnippet: '<h2>Pricing</h2>',
                            },
                        ],
                    },
                    {
                        strategyName: 'tab',
                        description: 'Tab navigation',
                        completionReason: { kind: 'cycle-complete', detail: 'tab focus cycled through all elements' },
                        totalSteps: 1,
                        steps: [
                            {
                                index: 0,
                                identifier: 'tab-0',
                                spoken: 'Get Started, button',
                                focusedElementText: 'Get Started',
                                axNode: { role: 'button', name: 'Get Started', properties: { focusable: true } },
                                htmlSnippet: '<button>Get Started</button>',
                            },
                        ],
                    },
                ],
                totalStrategies: 3,
                totalSteps: 6,
            };

            expect(renderTranscriptXml(transcript)).toMatchSnapshot();
        });
    });

    describe('XML escaping', () => {
        it('should escape special characters in spoken text', () => {
            const transcript: PromptTranscript = {
                sections: [
                    {
                        strategyName: 'tab',
                        description: 'Tab navigation',
                        completionReason: { kind: 'cycle-complete', detail: 'tab focus cycled through all elements' },
                        totalSteps: 1,
                        steps: [
                            {
                                index: 0,
                                identifier: 'escape-test',
                                spoken: 'Price: $10 < $20 & "best" deal\'s here',
                                focusedElementText: 'Price comparison <special>',
                                axNode: null,
                                htmlSnippet: null,
                            },
                        ],
                    },
                ],
                totalStrategies: 1,
                totalSteps: 1,
            };

            expect(renderTranscriptXml(transcript)).toMatchSnapshot();
        });
    });
});

describe('buildTranscriptData', () => {
    it('should transform strategy results into transcript data', () => {
        const transcript: StrategyResult[] = [
            createStrategyResult({
                meta: { name: 'heading', description: 'Heading navigation' },
                completionReason: { kind: 'exhausted', detail: 'no more headings found on page' },
                navigationSteps: [
                    makeStep({
                        index: 0,
                        identifier: 'h1-0',
                        spokenPhrases: ['Welcome', 'heading', 'level 1'],
                        focusedElementText: 'Welcome',
                        axNode: createAxNodeWithProperties('heading', 'Welcome', [
                            { name: 'level', value: { value: 1 } },
                        ]),
                        htmlSnippet: '<h1>Welcome</h1>',
                    }),
                ],
            }),
        ];

        const data = buildTranscriptData(transcript);
        expect(data).toMatchSnapshot();
    });

    it('should filter strategies based on includeStrategies config', () => {
        const transcript: StrategyResult[] = [
            createStrategyResult({
                meta: { name: 'tab', description: 'Tab navigation' },
                navigationSteps: [createNavigationStep(0, { spokenPhrases: ['Tab step'] })],
            }),
            createStrategyResult({
                meta: { name: 'heading', description: 'Heading navigation' },
                navigationSteps: [createNavigationStep(0, { spokenPhrases: ['Heading step'] })],
            }),
            createStrategyResult({
                meta: { name: 'landmark', description: 'Landmark navigation' },
                navigationSteps: [createNavigationStep(0, { spokenPhrases: ['Landmark step'] })],
            }),
        ];

        const data = buildTranscriptData(transcript, { includeStrategies: ['tab', 'heading'] });
        expect(data).toMatchSnapshot();
    });

    it('should filter strategies based on excludeStrategies config', () => {
        const transcript: StrategyResult[] = [
            createStrategyResult({
                meta: { name: 'tab', description: 'Tab navigation' },
                navigationSteps: [createNavigationStep(0, { spokenPhrases: ['Tab step'] })],
            }),
            createStrategyResult({
                meta: { name: 'heading', description: 'Heading navigation' },
                navigationSteps: [createNavigationStep(0, { spokenPhrases: ['Heading step'] })],
            }),
            createStrategyResult({
                meta: { name: 'landmark', description: 'Landmark navigation' },
                navigationSteps: [createNavigationStep(0, { spokenPhrases: ['Landmark step'] })],
            }),
        ];

        const data = buildTranscriptData(transcript, { excludeStrategies: ['landmark'] });
        expect(data).toMatchSnapshot();
    });

    it('should truncate HTML snippets based on maxHtmlSnippetLength', () => {
        const longHtml = '<div class="container">' + 'x'.repeat(600) + '</div>';

        const transcript: StrategyResult[] = [
            createStrategyResult({
                navigationSteps: [
                    makeStep({
                        index: 0,
                        identifier: 'long-html',
                        spokenPhrases: ['Long content'],
                        focusedElementText: 'Long content',
                        axNode: undefined,
                        htmlSnippet: longHtml,
                    }),
                ],
            }),
        ];

        const data = buildTranscriptData(transcript, { maxHtmlSnippetLength: 100 });
        expect(data).toMatchSnapshot();
    });

    it('should exclude HTML snippets when includeHtmlSnippets is false', () => {
        const transcript: StrategyResult[] = [
            createStrategyResult({
                navigationSteps: [
                    makeStep({
                        index: 0,
                        identifier: 'step-0',
                        spokenPhrases: ['Button'],
                        focusedElementText: 'Button',
                        axNode: undefined,
                        htmlSnippet: '<button>Submit</button>',
                    }),
                ],
            }),
        ];

        const data = buildTranscriptData(transcript, { includeHtmlSnippets: false });
        expect(data).toMatchSnapshot();
    });

    it('should exclude axNodes when includeAxNodes is false', () => {
        const transcript: StrategyResult[] = [
            createStrategyResult({
                navigationSteps: [
                    makeStep({
                        index: 0,
                        identifier: 'step-0',
                        spokenPhrases: ['Button'],
                        focusedElementText: 'Button',
                        axNode: createAxNode('button', 'Submit'),
                        htmlSnippet: null,
                    }),
                ],
            }),
        ];

        const data = buildTranscriptData(transcript, { includeAxNodes: false });
        expect(data).toMatchSnapshot();
    });
});

describe('buildTranscriptSection', () => {
    it('should build section with all config options', () => {
        const transcript: StrategyResult[] = [
            createStrategyResult({
                meta: { name: 'tab', description: 'Tab navigation' },
                navigationSteps: [
                    makeStep({
                        index: 0,
                        identifier: 'btn-0',
                        spokenPhrases: ['Submit', 'button'],
                        focusedElementText: 'Submit',
                        axNode: createAxNode('button', 'Submit'),
                        htmlSnippet: '<button>Submit</button>',
                    }),
                ],
            }),
            createStrategyResult({
                meta: { name: 'heading', description: 'Heading navigation' },
                navigationSteps: [
                    makeStep({
                        index: 0,
                        identifier: 'h1-0',
                        spokenPhrases: ['Title', 'heading', 'level 1'],
                        focusedElementText: 'Title',
                        axNode: createAxNode('heading', 'Title'),
                        htmlSnippet: '<h1>Title</h1>',
                    }),
                ],
            }),
        ];

        // Only include tab strategy, exclude HTML and axNodes
        expect(
            buildTranscriptSection(transcript, {
                includeStrategies: ['tab'],
                includeHtmlSnippets: false,
                includeAxNodes: false,
            })
        ).toMatchSnapshot();
    });

    it('should handle real-world navigation transcript structure', () => {
        const transcript: StrategyResult[] = [
            createStrategyResult({
                meta: {
                    name: 'landmark',
                    description: "Navigates through ARIA landmarks using NVDA's landmark navigation (D key)",
                },
                completionReason: { kind: 'exhausted', detail: 'no more landmarks found on page' },
                navigationSteps: [
                    makeStep({
                        index: 0,
                        identifier: 'banner-0',
                        spokenPhrases: ['banner landmark'],
                        focusedElementText: 'banner',
                        axNode: createAxNode('banner', ''),
                        htmlSnippet: '<header role="banner">...</header>',
                    }),
                    makeStep({
                        index: 1,
                        identifier: 'nav-0',
                        spokenPhrases: ['navigation landmark', 'Main Navigation'],
                        focusedElementText: 'Main Navigation',
                        axNode: createAxNode('navigation', 'Main Navigation'),
                        htmlSnippet: '<nav aria-label="Main Navigation">...</nav>',
                    }),
                    makeStep({
                        index: 2,
                        identifier: 'main-0',
                        spokenPhrases: ['main landmark'],
                        focusedElementText: 'main',
                        axNode: createAxNode('main', ''),
                        htmlSnippet: '<main>...</main>',
                    }),
                    makeStep({
                        index: 3,
                        identifier: 'contentinfo-0',
                        spokenPhrases: ['content info landmark'],
                        focusedElementText: 'contentinfo',
                        axNode: createAxNode('contentinfo', ''),
                        htmlSnippet: '<footer>...</footer>',
                    }),
                ],
            }),
            createStrategyResult({
                meta: {
                    name: 'arrow',
                    description: 'Linear reading through page content using Down Arrow (browse mode)',
                },
                completionReason: { kind: 'exhausted', detail: 'reached end of document' },
                navigationSteps: [
                    makeStep({
                        index: 0,
                        identifier: 'arrow-0',
                        spokenPhrases: ['link', 'Homepage'],
                        focusedElementText: 'Homepage',
                        axNode: createAxNode('link', 'Homepage'),
                        htmlSnippet: '<a href="/">Homepage</a>',
                    }),
                    makeStep({
                        index: 1,
                        identifier: 'arrow-1',
                        spokenPhrases: ['heading', 'level 1', 'Welcome'],
                        focusedElementText: 'Welcome',
                        axNode: createAxNodeWithProperties('heading', 'Welcome', [
                            { name: 'level', value: { value: 1 } },
                        ]),
                        htmlSnippet: '<h1>Welcome</h1>',
                    }),
                    makeStep({
                        index: 2,
                        identifier: 'arrow-2',
                        spokenPhrases: ['This is the introduction paragraph.'],
                        focusedElementText: 'This is the introduction paragraph.',
                        axNode: createAxNode('StaticText', 'This is the introduction paragraph.'),
                        htmlSnippet: '<p>This is the introduction paragraph.</p>',
                    }),
                ],
            }),
        ];

        expect(buildTranscriptSection(transcript)).toMatchSnapshot();
    });

    it('should handle empty strategy results', () => {
        expect(buildTranscriptSection([])).toMatchSnapshot();
    });

    it('should handle strategy with empty navigation steps', () => {
        const transcript: StrategyResult[] = [
            createStrategyResult({
                meta: { name: 'heading-level-6', description: 'Navigate through H6 headings' },
                completionReason: { kind: 'exhausted', detail: 'no more h6 headings found' },
                navigationSteps: [],
            }),
        ];

        expect(buildTranscriptSection(transcript)).toMatchSnapshot();
    });
});

describe('edge cases', () => {
    it('should handle axNode with empty properties object', () => {
        const transcript: PromptTranscript = {
            sections: [
                {
                    strategyName: 'tab',
                    description: 'Tab navigation',
                    completionReason: { kind: 'cycle-complete', detail: 'tab focus cycled through all elements' },
                    totalSteps: 1,
                    steps: [
                        {
                            index: 0,
                            identifier: 'empty-props',
                            spoken: 'Button',
                            focusedElementText: 'Button',
                            axNode: {
                                role: 'button',
                                name: 'Submit',
                                properties: {},
                            },
                            htmlSnippet: null,
                        },
                    ],
                },
            ],
            totalStrategies: 1,
            totalSteps: 1,
        };

        expect(renderTranscriptXml(transcript)).toMatchSnapshot();
    });

    it('should handle CDATA end sequence in HTML snippet', () => {
        const transcript: PromptTranscript = {
            sections: [
                {
                    strategyName: 'tab',
                    description: 'Tab navigation',
                    completionReason: { kind: 'cycle-complete', detail: 'tab focus cycled through all elements' },
                    totalSteps: 1,
                    steps: [
                        {
                            index: 0,
                            identifier: 'cdata-edge',
                            spoken: 'Script content',
                            focusedElementText: 'Script',
                            axNode: null,
                            // This contains ]]> which would break CDATA if not handled
                            htmlSnippet: '<script>if (arr[i]]>0) {}</script>',
                        },
                    ],
                },
            ],
            totalStrategies: 1,
            totalSteps: 1,
        };

        expect(renderTranscriptXml(transcript)).toMatchSnapshot();
    });
});
