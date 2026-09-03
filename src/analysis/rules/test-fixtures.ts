import type {
    NavigationStep,
    NavigationStrategyName,
    StrategyResult,
} from '../../screen-reader/strategies/navigation-strategy';

export interface StepOverrides {
    identifier?: string;
    focusedElementText?: string;
    /** Defaults to `[focusedElementText]`, matching how NVDA announces a single item. */
    spokenPhrases?: string[];
    role?: string;
    /** Accessible name. Defaults to `focusedElementText`; pass '' for an unnamed element. */
    name?: string;
    /** Adds a `level` AX property, as headings carry. */
    level?: number;
    htmlSnippet?: string;
    backendDOMNodeId?: number;
    /** Pass false for a step the accessibility tree had no node for. */
    axNode?: false;
}

export const createStep = (index: number, overrides: StepOverrides = {}): NavigationStep => {
    const focusedElementText = overrides.focusedElementText ?? `Item ${index}`;
    const properties =
        overrides.level === undefined ? undefined : [{ name: 'level', value: { value: overrides.level } }];

    return {
        index,
        identifier: overrides.identifier ?? `step-${index}`,
        spokenPhrases: overrides.spokenPhrases ?? [focusedElementText],
        focusedElementText,
        focusedElementTextLog: [],
        timestamp: 1_700_000_000_000 + index,
        axNode:
            overrides.axNode === false
                ? undefined
                : ({
                      nodeId: `${index}`,
                      role: { value: overrides.role ?? 'link' },
                      name: { value: overrides.name ?? focusedElementText },
                      backendDOMNodeId: overrides.backendDOMNodeId,
                      properties,
                  } as never),
        htmlSnippet: overrides.htmlSnippet ?? null,
    };
};

/** Build steps from a shorthand list of overrides. */
export const createSteps = (overrides: StepOverrides[]): NavigationStep[] =>
    overrides.map((override, index) => createStep(index, override));

export const strategyResult = (
    name: NavigationStrategyName,
    navigationSteps: NavigationStep[],
    completionReason: StrategyResult['completionReason'] = { kind: 'exhausted', detail: `no more ${name}s found` }
): StrategyResult => ({
    meta: {
        name,
        description: `${name} navigation`,
    },
    navigationSteps,
    completionReason,
});

/**
 * A transcript broad enough to make most checks fire at least once.
 *
 * Used by the suite-wide guards that assert a property of *every* rule
 * rather than one rule's logic. Those guards are only as good as the number
 * of checks this provokes, so each strategy below is deliberately faulty.
 */
export const broadTranscript = (): StrategyResult[] => [
    strategyResult(
        'tab',
        createSteps([
            { role: 'button', name: '', htmlSnippet: '<button></button>' },
            { role: 'link', name: 'Promo', htmlSnippet: '<a href="/p" aria-hidden="true">Promo</a>' },
            { role: 'link', name: 'Plans', htmlSnippet: '<a href="/a" tabindex="3">Plans</a>' },
            { role: 'textbox', name: '', htmlSnippet: '<input type="text">' },
        ])
    ),
    strategyResult(
        'heading',
        createSteps([
            { role: 'heading', level: 2, name: 'About', htmlSnippet: '<h2>About</h2>' },
            { role: 'heading', level: 4, name: '', htmlSnippet: '<h4></h4>' },
        ])
    ),
    strategyResult(
        'landmark',
        createSteps([
            { role: 'banner', name: 'Header' },
            { role: 'navigation', name: 'Menu', identifier: 'n1' },
            { role: 'navigation', name: 'Menu', identifier: 'n2' },
        ])
    ),
    strategyResult(
        'link',
        createSteps([
            { role: 'link', name: 'Read more', htmlSnippet: '<a href="/x">Read more</a>' },
            { role: 'link', name: 'IMG_1.jpg', htmlSnippet: '<img src="/a.jpg" alt="IMG_1.jpg">' },
            { role: 'button', name: 'Ghost', htmlSnippet: '<div role="button">Ghost</div>' },
        ])
    ),
    strategyResult('button', createSteps([{ role: 'button', name: 'Unreachable' }])),
    strategyResult(
        'arrow',
        createSteps([
            { spokenPhrases: ['content info landmark'] },
            ...Array.from({ length: 20 }, () => ({})),
            { spokenPhrases: ['main landmark'] },
            { spokenPhrases: ['Plan A clickable'] },
            { spokenPhrases: ['Plan B clickable'] },
            { spokenPhrases: ['Plan C clickable'] },
        ])
    ),
];

export const mockContext = (transcript: StrategyResult[]): import('../core/context').AuditContext => ({
    transcript,
    screenReader: 'nvda',
});
