import { describe, it, expect } from 'vitest';
import { buildTranscriptData, renderTranscriptXml, buildTranscriptSection } from './transcript-section';
import type {
    StrategyResult,
    StrategyMetadata,
    NavigationStep,
    CompletionReason,
} from '../../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';
import type { PromptTranscript, PromptStrategySection, PromptNavigationStep } from '../schemas';

// Creates a complete NavigationStep with all required fields
const createNavigationStep = (
    index: number,
    overrides: Partial<{
        identifier: string;
        spokenPhrases: string[];
        itemText: string;
        itemTextLog: string[];
        timestamp: number;
        axNode: unknown;
        htmlSnippet: string;
    }> = {}
): NavigationStep => ({
    index,
    identifier: overrides.identifier ?? `step-${index}`,
    spokenPhrases: overrides.spokenPhrases ?? [`Item ${index}`],
    itemText: overrides.itemText ?? `Item ${index}`,
    itemTextLog: overrides.itemTextLog ?? [],
    timestamp: overrides.timestamp ?? Date.now(),
    axNode: overrides.axNode as NavigationStep['axNode'],
    htmlSnippet: overrides.htmlSnippet ?? null,
});

// Helper to add missing itemTextLog and timestamp to inline step objects
const makeStep = (step: Omit<NavigationStep, 'itemTextLog' | 'timestamp'>): NavigationStep => ({
    ...step,
    itemTextLog: [],
    timestamp: Date.now(),
});

const createStrategyResult = (
    overrides: Partial<Omit<StrategyResult, 'meta' | 'completionReason'>> & {
        meta?: Partial<StrategyMetadata>;
        completionReason?: CompletionReason;
    } = {}
): StrategyResult => {
    const name = overrides.meta?.name ?? 'tab';
    const mode = overrides.meta?.mode ?? (name === 'tab' ? 'focus' : 'browse');
    const defaultReason: CompletionReason =
        name === 'tab'
            ? { kind: 'cycle-complete', detail: 'tab focus cycled through all elements' }
            : { kind: 'exhausted', detail: `no more ${name}s found` };
    return {
        meta: {
            name,
            description: overrides.meta?.description ?? 'Tab navigation through focusable elements',
            mode,
        },
        completionReason: overrides.completionReason ?? defaultReason,
        navigationSteps: overrides.navigationSteps ?? [createNavigationStep(0), createNavigationStep(1)],
    };
};

const createAxNode = (role: string, name: string, extraProps: Record<string, unknown> = {}) => ({
    role: { value: role },
    name: { value: name },
    properties: [],
    ...extraProps,
});

const createAxNodeWithProperties = (
    role: string,
    name: string,
    properties: Array<{ name: string; value: { value: unknown } }>
) => ({
    role: { value: role },
    name: { value: name },
    properties,
});

describe('renderTranscriptXml', () => {
    describe('empty transcript', () => {
        it('should render empty transcript correctly', () => {
            const transcript: PromptTranscript = {
                sections: [],
                totalStrategies: 0,
                totalSteps: 0,
            };

            expect(renderTranscriptXml(transcript)).toMatchSnapshot();
        });
    });

    describe('single strategy with minimal steps', () => {
        it('should render a single strategy with basic steps', () => {
            const transcript: PromptTranscript = {
                sections: [
                    {
                        strategyName: 'tab',
                        description: 'Tab navigation',
                        mode: 'focus',
                        completionReason: { kind: 'cycle-complete', detail: 'tab focus cycled through all elements' },
                        totalSteps: 2,
                        steps: [
                            {
                                index: 0,
                                identifier: 'step-0',
                                spoken: 'Skip to main content, link',
                                itemText: 'Skip to main content',
                                axNode: null,
                                htmlSnippet: null,
                            },
                            {
                                index: 1,
                                identifier: 'step-1',
                                spoken: 'Search, edit',
                                itemText: 'Search',
                                axNode: null,
                                htmlSnippet: null,
                            },
                        ],
                    },
                ],
                totalStrategies: 1,
                totalSteps: 2,
            };

            expect(renderTranscriptXml(transcript)).toMatchSnapshot();
        });
    });

    describe('steps with axNode', () => {
        it('should render step with basic axNode (role and name)', () => {
            const transcript: PromptTranscript = {
                sections: [
                    {
                        strategyName: 'heading',
                        description: 'Heading navigation',
                        mode: 'browse',
                        completionReason: { kind: 'exhausted', detail: 'no more headings found on page' },
                        totalSteps: 1,
                        steps: [
                            {
                                index: 0,
                                identifier: 'heading-0',
                                spoken: 'Main Content, heading, level 1',
                                itemText: 'Main Content',
                                axNode: {
                                    role: 'heading',
                                    name: 'Main Content',
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

        it('should render step with axNode description and value', () => {
            const transcript: PromptTranscript = {
                sections: [
                    {
                        strategyName: 'tab',
                        description: 'Tab navigation',
                        mode: 'focus',
                        completionReason: { kind: 'cycle-complete', detail: 'tab focus cycled through all elements' },
                        totalSteps: 1,
                        steps: [
                            {
                                index: 0,
                                identifier: 'input-0',
                                spoken: 'Email address, edit, required',
                                itemText: 'Email address',
                                axNode: {
                                    role: 'textbox',
                                    name: 'Email address',
                                    description: 'Enter your email for notifications',
                                    value: 'user@example.com',
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

        it('should render step with axNode properties', () => {
            const transcript: PromptTranscript = {
                sections: [
                    {
                        strategyName: 'tab',
                        description: 'Tab navigation',
                        mode: 'focus',
                        completionReason: { kind: 'cycle-complete', detail: 'tab focus cycled through all elements' },
                        totalSteps: 1,
                        steps: [
                            {
                                index: 0,
                                identifier: 'checkbox-0',
                                spoken: 'Accept terms, checkbox, not checked, required',
                                itemText: 'Accept terms',
                                axNode: {
                                    role: 'checkbox',
                                    name: 'Accept terms',
                                    properties: {
                                        focusable: true,
                                        checked: false,
                                        required: true,
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

        it('should render step with all axNode properties', () => {
            const transcript: PromptTranscript = {
                sections: [
                    {
                        strategyName: 'tab',
                        description: 'Tab navigation',
                        mode: 'focus',
                        completionReason: { kind: 'cycle-complete', detail: 'tab focus cycled through all elements' },
                        totalSteps: 1,
                        steps: [
                            {
                                index: 0,
                                identifier: 'complex-0',
                                spoken: 'Complex widget',
                                itemText: 'Complex widget',
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
        it('should render step with simple HTML snippet in CDATA', () => {
            const transcript: PromptTranscript = {
                sections: [
                    {
                        strategyName: 'button',
                        description: 'Button navigation',
                        mode: 'browse',
                        completionReason: { kind: 'exhausted', detail: 'no more buttons found on page' },
                        totalSteps: 1,
                        steps: [
                            {
                                index: 0,
                                identifier: 'btn-0',
                                spoken: 'Submit, button',
                                itemText: 'Submit',
                                axNode: null,
                                htmlSnippet: '<button type="submit" class="btn-primary">Submit</button>',
                            },
                        ],
                    },
                ],
                totalStrategies: 1,
                totalSteps: 1,
            };

            expect(renderTranscriptXml(transcript)).toMatchSnapshot();
        });

        it('should render step with complex HTML containing special characters', () => {
            const transcript: PromptTranscript = {
                sections: [
                    {
                        strategyName: 'tab',
                        description: 'Tab navigation',
                        mode: 'focus',
                        completionReason: { kind: 'cycle-complete', detail: 'tab focus cycled through all elements' },
                        totalSteps: 1,
                        steps: [
                            {
                                index: 0,
                                identifier: 'complex-html-0',
                                spoken: 'Product card',
                                itemText: 'Product card',
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
                        mode: 'browse',
                        completionReason: { kind: 'exhausted', detail: 'no more landmarks found on page' },
                        totalSteps: 2,
                        steps: [
                            {
                                index: 0,
                                identifier: 'landmark-0',
                                spoken: 'banner landmark',
                                itemText: 'banner',
                                axNode: { role: 'banner', name: '' },
                                htmlSnippet: '<header role="banner">...</header>',
                            },
                            {
                                index: 1,
                                identifier: 'landmark-1',
                                spoken: 'main landmark',
                                itemText: 'main',
                                axNode: { role: 'main', name: '' },
                                htmlSnippet: '<main>...</main>',
                            },
                        ],
                    },
                    {
                        strategyName: 'heading',
                        description: 'Heading navigation',
                        mode: 'browse',
                        completionReason: { kind: 'exhausted', detail: 'no more headings found on page' },
                        totalSteps: 3,
                        steps: [
                            {
                                index: 0,
                                identifier: 'h1-0',
                                spoken: 'Welcome, heading, level 1',
                                itemText: 'Welcome',
                                axNode: { role: 'heading', name: 'Welcome', properties: { level: 1 } },
                                htmlSnippet: '<h1>Welcome</h1>',
                            },
                            {
                                index: 1,
                                identifier: 'h2-0',
                                spoken: 'Features, heading, level 2',
                                itemText: 'Features',
                                axNode: { role: 'heading', name: 'Features', properties: { level: 2 } },
                                htmlSnippet: '<h2>Features</h2>',
                            },
                            {
                                index: 2,
                                identifier: 'h2-1',
                                spoken: 'Pricing, heading, level 2',
                                itemText: 'Pricing',
                                axNode: { role: 'heading', name: 'Pricing', properties: { level: 2 } },
                                htmlSnippet: '<h2>Pricing</h2>',
                            },
                        ],
                    },
                    {
                        strategyName: 'tab',
                        description: 'Tab navigation',
                        mode: 'focus',
                        completionReason: { kind: 'cycle-complete', detail: 'tab focus cycled through all elements' },
                        totalSteps: 1,
                        steps: [
                            {
                                index: 0,
                                identifier: 'tab-0',
                                spoken: 'Get Started, button',
                                itemText: 'Get Started',
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
                        mode: 'focus',
                        completionReason: { kind: 'cycle-complete', detail: 'tab focus cycled through all elements' },
                        totalSteps: 1,
                        steps: [
                            {
                                index: 0,
                                identifier: 'escape-test',
                                spoken: 'Price: $10 < $20 & "best" deal\'s here',
                                itemText: 'Price comparison <special>',
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

        it('should escape special characters in axNode fields', () => {
            const transcript: PromptTranscript = {
                sections: [
                    {
                        strategyName: 'tab',
                        description: 'Tab <navigation> & more',
                        mode: 'focus',
                        completionReason: { kind: 'limit-reached', detail: 'stopped at safety limit' },
                        totalSteps: 1,
                        steps: [
                            {
                                index: 0,
                                identifier: 'ax-escape-test',
                                spoken: 'Test',
                                itemText: 'Test',
                                axNode: {
                                    role: 'link',
                                    name: 'Terms & Conditions',
                                    description: 'Read our <legal> terms',
                                    value: '"Important" info',
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

        it('should escape special characters in strategy name and identifier', () => {
            const transcript: PromptTranscript = {
                sections: [
                    {
                        strategyName: 'custom-strategy<test>',
                        description: 'Description with "quotes"',
                        mode: 'browse',
                        completionReason: { kind: 'exhausted', detail: 'reason with <angle> brackets' },
                        totalSteps: 1,
                        steps: [
                            {
                                index: 0,
                                identifier: 'id-with-"quotes"-&-<brackets>',
                                spoken: 'Test',
                                itemText: 'Test',
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

    describe('config options', () => {
        it('should exclude axNodes when includeAxNodes is false', () => {
            const transcript: PromptTranscript = {
                sections: [
                    {
                        strategyName: 'tab',
                        description: 'Tab navigation',
                        mode: 'focus',
                        completionReason: { kind: 'cycle-complete', detail: 'tab focus cycled through all elements' },
                        totalSteps: 1,
                        steps: [
                            {
                                index: 0,
                                identifier: 'step-0',
                                spoken: 'Button, button',
                                itemText: 'Button',
                                axNode: { role: 'button', name: 'Submit' },
                                htmlSnippet: '<button>Submit</button>',
                            },
                        ],
                    },
                ],
                totalStrategies: 1,
                totalSteps: 1,
            };

            expect(renderTranscriptXml(transcript, { includeAxNodes: false })).toMatchSnapshot();
        });

        it('should exclude HTML snippets when includeHtmlSnippets is false', () => {
            const transcript: PromptTranscript = {
                sections: [
                    {
                        strategyName: 'tab',
                        description: 'Tab navigation',
                        mode: 'focus',
                        completionReason: { kind: 'cycle-complete', detail: 'tab focus cycled through all elements' },
                        totalSteps: 1,
                        steps: [
                            {
                                index: 0,
                                identifier: 'step-0',
                                spoken: 'Button, button',
                                itemText: 'Button',
                                axNode: { role: 'button', name: 'Submit' },
                                htmlSnippet: '<button>Submit</button>',
                            },
                        ],
                    },
                ],
                totalStrategies: 1,
                totalSteps: 1,
            };

            expect(renderTranscriptXml(transcript, { includeHtmlSnippets: false })).toMatchSnapshot();
        });

        it('should exclude both axNodes and HTML when both are disabled', () => {
            const transcript: PromptTranscript = {
                sections: [
                    {
                        strategyName: 'tab',
                        description: 'Tab navigation',
                        mode: 'focus',
                        completionReason: { kind: 'cycle-complete', detail: 'tab focus cycled through all elements' },
                        totalSteps: 2,
                        steps: [
                            {
                                index: 0,
                                identifier: 'step-0',
                                spoken: 'Button, button',
                                itemText: 'Button',
                                axNode: { role: 'button', name: 'Submit' },
                                htmlSnippet: '<button>Submit</button>',
                            },
                            {
                                index: 1,
                                identifier: 'step-1',
                                spoken: 'Link, link',
                                itemText: 'Link',
                                axNode: { role: 'link', name: 'More info' },
                                htmlSnippet: '<a href="#">More info</a>',
                            },
                        ],
                    },
                ],
                totalStrategies: 1,
                totalSteps: 2,
            };

            expect(
                renderTranscriptXml(transcript, { includeAxNodes: false, includeHtmlSnippets: false })
            ).toMatchSnapshot();
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
                        itemText: 'Welcome',
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

    it('should handle strategy results with complex axNodes', () => {
        const transcript: StrategyResult[] = [
            createStrategyResult({
                meta: { name: 'tab', description: 'Tab navigation' },
                navigationSteps: [
                    makeStep({
                        index: 0,
                        identifier: 'checkbox-0',
                        spokenPhrases: ['Accept terms', 'checkbox', 'not checked'],
                        itemText: 'Accept terms',
                        axNode: createAxNodeWithProperties('checkbox', 'Accept terms', [
                            { name: 'focusable', value: { value: true } },
                            { name: 'checked', value: { value: false } },
                            { name: 'required', value: { value: true } },
                        ]),
                        htmlSnippet: '<input type="checkbox" required>',
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
                        itemText: 'Long content',
                        axNode: null,
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
                        itemText: 'Button',
                        axNode: null,
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
                        itemText: 'Button',
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
    it('should build complete XML section from strategy results', () => {
        const transcript: StrategyResult[] = [
            createStrategyResult({
                meta: { name: 'tab', description: 'Tab navigation through focusable elements' },
                completionReason: { kind: 'cycle-complete', detail: 'tab focus cycled through all elements' },
                navigationSteps: [
                    makeStep({
                        index: 0,
                        identifier: 'skip-link',
                        spokenPhrases: ['Skip to main content', 'link'],
                        itemText: 'Skip to main content',
                        axNode: createAxNode('link', 'Skip to main content'),
                        htmlSnippet: '<a href="#main">Skip to main content</a>',
                    }),
                    makeStep({
                        index: 1,
                        identifier: 'search-input',
                        spokenPhrases: ['Search', 'edit', 'blank'],
                        itemText: 'Search',
                        axNode: createAxNodeWithProperties('textbox', 'Search', [
                            { name: 'focusable', value: { value: true } },
                        ]),
                        htmlSnippet: '<input type="search" placeholder="Search...">',
                    }),
                ],
            }),
            createStrategyResult({
                meta: { name: 'heading', description: 'Navigate through headings' },
                completionReason: { kind: 'exhausted', detail: 'no more headings found on page' },
                navigationSteps: [
                    makeStep({
                        index: 0,
                        identifier: 'main-heading',
                        spokenPhrases: ['Welcome to Our Site', 'heading', 'level 1'],
                        itemText: 'Welcome to Our Site',
                        axNode: createAxNodeWithProperties('heading', 'Welcome to Our Site', [
                            { name: 'level', value: { value: 1 } },
                        ]),
                        htmlSnippet: '<h1>Welcome to Our Site</h1>',
                    }),
                ],
            }),
        ];

        expect(buildTranscriptSection(transcript)).toMatchSnapshot();
    });

    it('should build section with all config options', () => {
        const transcript: StrategyResult[] = [
            createStrategyResult({
                meta: { name: 'tab', description: 'Tab navigation' },
                navigationSteps: [
                    makeStep({
                        index: 0,
                        identifier: 'btn-0',
                        spokenPhrases: ['Submit', 'button'],
                        itemText: 'Submit',
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
                        itemText: 'Title',
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
                        itemText: 'banner',
                        axNode: createAxNode('banner', ''),
                        htmlSnippet: '<header role="banner">...</header>',
                    }),
                    makeStep({
                        index: 1,
                        identifier: 'nav-0',
                        spokenPhrases: ['navigation landmark', 'Main Navigation'],
                        itemText: 'Main Navigation',
                        axNode: createAxNode('navigation', 'Main Navigation'),
                        htmlSnippet: '<nav aria-label="Main Navigation">...</nav>',
                    }),
                    makeStep({
                        index: 2,
                        identifier: 'main-0',
                        spokenPhrases: ['main landmark'],
                        itemText: 'main',
                        axNode: createAxNode('main', ''),
                        htmlSnippet: '<main>...</main>',
                    }),
                    makeStep({
                        index: 3,
                        identifier: 'contentinfo-0',
                        spokenPhrases: ['content info landmark'],
                        itemText: 'contentinfo',
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
                        itemText: 'Homepage',
                        axNode: createAxNode('link', 'Homepage'),
                        htmlSnippet: '<a href="/">Homepage</a>',
                    }),
                    makeStep({
                        index: 1,
                        identifier: 'arrow-1',
                        spokenPhrases: ['heading', 'level 1', 'Welcome'],
                        itemText: 'Welcome',
                        axNode: createAxNodeWithProperties('heading', 'Welcome', [
                            { name: 'level', value: { value: 1 } },
                        ]),
                        htmlSnippet: '<h1>Welcome</h1>',
                    }),
                    makeStep({
                        index: 2,
                        identifier: 'arrow-2',
                        spokenPhrases: ['This is the introduction paragraph.'],
                        itemText: 'This is the introduction paragraph.',
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
    it('should handle steps with empty spoken phrases', () => {
        const transcript: PromptTranscript = {
            sections: [
                {
                    strategyName: 'tab',
                    description: 'Tab navigation',
                    mode: 'focus',
                    completionReason: { kind: 'cycle-complete', detail: 'tab focus cycled through all elements' },
                    totalSteps: 1,
                    steps: [
                        {
                            index: 0,
                            identifier: 'empty-spoken',
                            spoken: '',
                            itemText: '',
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

    it('should handle axNode with empty properties object', () => {
        const transcript: PromptTranscript = {
            sections: [
                {
                    strategyName: 'tab',
                    description: 'Tab navigation',
                    mode: 'focus',
                    completionReason: { kind: 'cycle-complete', detail: 'tab focus cycled through all elements' },
                    totalSteps: 1,
                    steps: [
                        {
                            index: 0,
                            identifier: 'empty-props',
                            spoken: 'Button',
                            itemText: 'Button',
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

    it('should handle unicode and emoji in content', () => {
        const transcript: PromptTranscript = {
            sections: [
                {
                    strategyName: 'tab',
                    description: 'Tab navigation',
                    mode: 'focus',
                    completionReason: { kind: 'cycle-complete', detail: 'tab focus cycled through all elements' },
                    totalSteps: 1,
                    steps: [
                        {
                            index: 0,
                            identifier: 'unicode-test',
                            spoken: '🔍 Search • Búsqueda • 搜索',
                            itemText: '🔍 Search',
                            axNode: {
                                role: 'button',
                                name: '🔍 Search • Búsqueda',
                            },
                            htmlSnippet: '<button>🔍 Search</button>',
                        },
                    ],
                },
            ],
            totalStrategies: 1,
            totalSteps: 1,
        };

        expect(renderTranscriptXml(transcript)).toMatchSnapshot();
    });

    it('should handle very long identifiers', () => {
        const longId = 'a'.repeat(200);
        const transcript: PromptTranscript = {
            sections: [
                {
                    strategyName: 'tab',
                    description: 'Tab navigation',
                    mode: 'focus',
                    completionReason: { kind: 'cycle-complete', detail: 'tab focus cycled through all elements' },
                    totalSteps: 1,
                    steps: [
                        {
                            index: 0,
                            identifier: longId,
                            spoken: 'Test',
                            itemText: 'Test',
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

    it('should handle CDATA end sequence in HTML snippet', () => {
        const transcript: PromptTranscript = {
            sections: [
                {
                    strategyName: 'tab',
                    description: 'Tab navigation',
                    mode: 'focus',
                    completionReason: { kind: 'cycle-complete', detail: 'tab focus cycled through all elements' },
                    totalSteps: 1,
                    steps: [
                        {
                            index: 0,
                            identifier: 'cdata-edge',
                            spoken: 'Script content',
                            itemText: 'Script',
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
