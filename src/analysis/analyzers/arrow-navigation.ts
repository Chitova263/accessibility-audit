/**
 * Arrow Navigation Analyzers
 *
 * These analyzers are designed to work with Arrow Navigation Strategy results,
 * which capture linear reading through the page content.
 *
 * Rules implemented:
 * - steps-to-main-content: Count steps to reach main landmark (WCAG 2.4.1 A)
 * - reading-order-landmark-sequence: Footer/aside before main in DOM (WCAG 1.3.2 A)
 * - excessive-repetition: Same phrase announced N+ times consecutively (WCAG 1.3.1 A)
 * - content-density-per-region: Items per landmark exceed threshold (WCAG 2.4.1 A)
 * - isolated-interactive-element: Button/link with no surrounding context (WCAG 2.4.4 A)
 */

import type {
    StrategyResult,
    NavigationStep,
} from '../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';
import type { NvdaViolation, NvdaToolDetails } from '../violation';

// =============================================================================
// Helper Functions
// =============================================================================

function createViolation(
    ruleId: string,
    wcagCriterion: string,
    wcagLevel: 'A' | 'AA' | 'AAA',
    impact: string,
    message: string,
    step: NavigationStep,
    strategyName: string
): NvdaViolation {
    return {
        id: `${ruleId}-${step.identifier}`,
        ruleId,
        wcag: {
            primary: { criterion: wcagCriterion, level: wcagLevel },
        },
        impact,
        message,
        element: {
            htmlSnippet: step.htmlSnippet ?? undefined,
            selector: undefined,
        },
        tool: 'nvda-audit',
        timestamp: Date.now(),
        toolDetails: {
            spokenPhrases: step.spokenPhrases,
            itemText: step.itemText,
            navigationStrategy: strategyName,
            stepIndex: step.index,
            axNode: step.axNode
                ? {
                      nodeId: step.axNode.nodeId,
                      role: (step.axNode.role as any)?.value,
                      name: (step.axNode.name as any)?.value,
                      properties: step.axNode.properties,
                  }
                : undefined,
        },
    };
}

function getArrowStrategyResult(strategyResults: StrategyResult[]): StrategyResult | undefined {
    return strategyResults.find((r) => r.meta.type === 'arrow' || r.meta.name === 'ArrowNavigation');
}

function getSpokenText(step: NavigationStep): string {
    return step.spokenPhrases.join(' ').toLowerCase().trim();
}

function getRole(step: NavigationStep): string | undefined {
    return (step.axNode?.role as any)?.value;
}

// =============================================================================
// Rule: steps-to-main-content (WCAG 2.4.1 A)
// =============================================================================

export interface StepsToMainContentSummary {
    stepsToMain: number | null;
    mainFoundAtStep: number | null;
    totalSteps: number;
    threshold: number;
    exceedsThreshold: boolean;
}

export interface StepsToMainContentResult {
    violations: NvdaViolation[];
    summary: StepsToMainContentSummary;
}

/**
 * Analyzes how many steps it takes to reach the main content landmark.
 * Excessive steps before main content indicate poor bypass block implementation.
 *
 * WCAG 2.4.1: Bypass Blocks (Level A)
 */
export function analyzeStepsToMainContent(
    strategyResults: StrategyResult[],
    options: { threshold?: number } = {}
): StepsToMainContentResult {
    const threshold = options.threshold ?? 30; // Default: 30 steps is too many
    const violations: NvdaViolation[] = [];

    const arrowResult = getArrowStrategyResult(strategyResults);
    if (!arrowResult) {
        return {
            violations: [],
            summary: {
                stepsToMain: null,
                mainFoundAtStep: null,
                totalSteps: 0,
                threshold,
                exceedsThreshold: false,
            },
        };
    }

    const steps = arrowResult.navigationSteps;
    let mainFoundAtStep: number | null = null;

    // Find the first step that reaches main landmark
    for (let i = 0; i < steps.length; i++) {
        const step = steps[i]!;
        const spoken = getSpokenText(step);
        const role = getRole(step);

        // Check for main landmark announcement
        if (role === 'main' || spoken.includes('main landmark') || spoken.includes('main region')) {
            mainFoundAtStep = i;
            break;
        }
    }

    const stepsToMain = mainFoundAtStep !== null ? mainFoundAtStep : null;
    const exceedsThreshold = stepsToMain !== null && stepsToMain > threshold;

    if (exceedsThreshold && mainFoundAtStep !== null) {
        const step = steps[mainFoundAtStep]!;
        violations.push(
            createViolation(
                'steps-to-main-content',
                '2.4.1',
                'A',
                'moderate',
                `Main content reached after ${stepsToMain} steps (threshold: ${threshold}). Users must navigate through excessive content before reaching main content. Consider adding or improving skip links.`,
                step,
                arrowResult.meta.name
            )
        );
    }

    return {
        violations,
        summary: {
            stepsToMain,
            mainFoundAtStep,
            totalSteps: steps.length,
            threshold,
            exceedsThreshold,
        },
    };
}

// =============================================================================
// Rule: reading-order-landmark-sequence (WCAG 1.3.2 A)
// =============================================================================

export interface LandmarkSequenceInfo {
    landmark: string;
    stepIndex: number;
    spokenPhrase: string;
}

export interface ReadingOrderLandmarkSequenceSummary {
    landmarkSequence: LandmarkSequenceInfo[];
    hasMainBeforeFooter: boolean;
    hasMainBeforeAside: boolean;
    violations: string[];
}

export interface ReadingOrderLandmarkSequenceResult {
    violations: NvdaViolation[];
    summary: ReadingOrderLandmarkSequenceSummary;
}

const LANDMARK_PATTERNS: Record<string, RegExp> = {
    banner: /banner\s*(landmark|region)?/i,
    navigation: /navigation\s*(landmark|region)?/i,
    main: /main\s*(landmark|region)?/i,
    complementary: /complementary\s*(landmark|region)?/i,
    contentinfo: /(content\s*info|contentinfo)\s*(landmark|region)?/i,
    aside: /aside|complementary/i,
    footer: /(footer|content\s*info)/i,
};

/**
 * Analyzes if landmarks appear in a logical reading order.
 * Footer/aside appearing before main content indicates DOM order issues.
 *
 * WCAG 1.3.2: Meaningful Sequence (Level A)
 */
export function analyzeReadingOrderLandmarkSequence(
    strategyResults: StrategyResult[]
): ReadingOrderLandmarkSequenceResult {
    const violations: NvdaViolation[] = [];
    const landmarkSequence: LandmarkSequenceInfo[] = [];

    const arrowResult = getArrowStrategyResult(strategyResults);
    if (!arrowResult) {
        return {
            violations: [],
            summary: {
                landmarkSequence: [],
                hasMainBeforeFooter: true,
                hasMainBeforeAside: true,
                violations: [],
            },
        };
    }

    const steps = arrowResult.navigationSteps;

    // Extract landmark sequence
    for (let i = 0; i < steps.length; i++) {
        const step = steps[i]!;
        const spoken = getSpokenText(step);
        const role = getRole(step);

        // Check for landmark by role or spoken phrase
        for (const [landmark, pattern] of Object.entries(LANDMARK_PATTERNS)) {
            if (role === landmark || pattern.test(spoken)) {
                landmarkSequence.push({
                    landmark,
                    stepIndex: i,
                    spokenPhrase: step.spokenPhrases.join(' '),
                });
                break; // Only record first match per step
            }
        }
    }

    // Find positions
    const mainIndex = landmarkSequence.findIndex((l) => l.landmark === 'main');
    const footerIndex = landmarkSequence.findIndex((l) => l.landmark === 'contentinfo' || l.landmark === 'footer');
    const asideIndex = landmarkSequence.findIndex((l) => l.landmark === 'complementary' || l.landmark === 'aside');

    const hasMainBeforeFooter = mainIndex === -1 || footerIndex === -1 || mainIndex < footerIndex;
    const hasMainBeforeAside = mainIndex === -1 || asideIndex === -1 || mainIndex < asideIndex;

    const violationMessages: string[] = [];

    // Check for footer before main
    if (!hasMainBeforeFooter && footerIndex !== -1 && mainIndex !== -1) {
        const footerStep = steps[landmarkSequence[footerIndex]!.stepIndex]!;
        violations.push(
            createViolation(
                'reading-order-landmark-sequence',
                '1.3.2',
                'A',
                'serious',
                `Footer/contentinfo landmark (step ${landmarkSequence[footerIndex]!.stepIndex}) appears before main landmark (step ${landmarkSequence[mainIndex]!.stepIndex}). Screen reader users will hear footer content before main content.`,
                footerStep,
                arrowResult.meta.name
            )
        );
        violationMessages.push('Footer before main');
    }

    // Check for aside/complementary before main
    if (!hasMainBeforeAside && asideIndex !== -1 && mainIndex !== -1) {
        const asideStep = steps[landmarkSequence[asideIndex]!.stepIndex]!;
        violations.push(
            createViolation(
                'reading-order-landmark-sequence',
                '1.3.2',
                'A',
                'moderate',
                `Complementary/aside landmark (step ${landmarkSequence[asideIndex]!.stepIndex}) appears before main landmark (step ${landmarkSequence[mainIndex]!.stepIndex}). Consider if sidebar content should come after main content.`,
                asideStep,
                arrowResult.meta.name
            )
        );
        violationMessages.push('Aside before main');
    }

    return {
        violations,
        summary: {
            landmarkSequence,
            hasMainBeforeFooter,
            hasMainBeforeAside,
            violations: violationMessages,
        },
    };
}

// =============================================================================
// Rule: excessive-repetition (WCAG 1.3.1 A)
// =============================================================================

export interface RepetitionInfo {
    phrase: string;
    count: number;
    startStep: number;
    endStep: number;
}

export interface ExcessiveRepetitionSummary {
    repetitions: RepetitionInfo[];
    totalExcessiveRepetitions: number;
    threshold: number;
}

export interface ExcessiveRepetitionResult {
    violations: NvdaViolation[];
    summary: ExcessiveRepetitionSummary;
}

/**
 * Analyzes for phrases that are announced repeatedly in sequence.
 * Excessive repetition indicates poor accessible naming or redundant content.
 *
 * WCAG 1.3.1: Info and Relationships (Level A)
 */
export function analyzeExcessiveRepetition(
    strategyResults: StrategyResult[],
    options: { threshold?: number; minPhraseLength?: number } = {}
): ExcessiveRepetitionResult {
    const threshold = options.threshold ?? 3; // Default: 3+ repetitions is excessive
    const minPhraseLength = options.minPhraseLength ?? 3; // Ignore very short phrases
    const violations: NvdaViolation[] = [];
    const repetitions: RepetitionInfo[] = [];

    const arrowResult = getArrowStrategyResult(strategyResults);
    if (!arrowResult) {
        return {
            violations: [],
            summary: {
                repetitions: [],
                totalExcessiveRepetitions: 0,
                threshold,
            },
        };
    }

    const steps = arrowResult.navigationSteps;

    // Track consecutive repetitions
    let currentPhrase = '';
    let count = 0;
    let startStep = 0;

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i]!;
        const phrase = step.itemText.toLowerCase().trim();

        // Skip empty or very short phrases
        if (phrase.length < minPhraseLength) {
            // End current sequence if any
            if (count >= threshold) {
                repetitions.push({
                    phrase: currentPhrase,
                    count,
                    startStep,
                    endStep: i - 1,
                });
            }
            currentPhrase = '';
            count = 0;
            continue;
        }

        if (phrase === currentPhrase) {
            count++;
        } else {
            // Check if previous sequence was excessive
            if (count >= threshold) {
                repetitions.push({
                    phrase: currentPhrase,
                    count,
                    startStep,
                    endStep: i - 1,
                });
            }
            // Start new sequence
            currentPhrase = phrase;
            count = 1;
            startStep = i;
        }
    }

    // Check final sequence
    if (count >= threshold) {
        repetitions.push({
            phrase: currentPhrase,
            count,
            startStep,
            endStep: steps.length - 1,
        });
    }

    // Create violations for each excessive repetition
    for (const rep of repetitions) {
        const step = steps[rep.startStep]!;
        violations.push(
            createViolation(
                'excessive-repetition',
                '1.3.1',
                'A',
                'minor',
                `"${rep.phrase}" is announced ${rep.count} times consecutively (steps ${rep.startStep}-${rep.endStep}). This repetition may confuse screen reader users or indicate redundant content.`,
                step,
                arrowResult.meta.name
            )
        );
    }

    return {
        violations,
        summary: {
            repetitions,
            totalExcessiveRepetitions: repetitions.length,
            threshold,
        },
    };
}

// =============================================================================
// Rule: content-density-per-region (WCAG 2.4.1 A)
// =============================================================================

export interface RegionDensity {
    landmark: string;
    startStep: number;
    endStep: number;
    itemCount: number;
    exceedsThreshold: boolean;
}

export interface ContentDensityPerRegionSummary {
    regions: RegionDensity[];
    totalRegionsOverThreshold: number;
    threshold: number;
}

export interface ContentDensityPerRegionResult {
    violations: NvdaViolation[];
    summary: ContentDensityPerRegionSummary;
}

/**
 * Analyzes content density within each landmark region.
 * Regions with too many items may overwhelm screen reader users.
 *
 * WCAG 2.4.1: Bypass Blocks (Level A)
 */
export function analyzeContentDensityPerRegion(
    strategyResults: StrategyResult[],
    options: { threshold?: number } = {}
): ContentDensityPerRegionResult {
    const threshold = options.threshold ?? 50; // Default: 50 items per region is excessive
    const violations: NvdaViolation[] = [];
    const regions: RegionDensity[] = [];

    const arrowResult = getArrowStrategyResult(strategyResults);
    if (!arrowResult) {
        return {
            violations: [],
            summary: {
                regions: [],
                totalRegionsOverThreshold: 0,
                threshold,
            },
        };
    }

    const steps = arrowResult.navigationSteps;

    // Find landmark boundaries
    const landmarkSteps: { landmark: string; stepIndex: number }[] = [];

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i]!;
        const spoken = getSpokenText(step);
        const role = getRole(step);

        for (const [landmark, pattern] of Object.entries(LANDMARK_PATTERNS)) {
            if (role === landmark || pattern.test(spoken)) {
                landmarkSteps.push({ landmark, stepIndex: i });
                break;
            }
        }
    }

    // Calculate items per region
    for (let i = 0; i < landmarkSteps.length; i++) {
        const current = landmarkSteps[i]!;
        const next = landmarkSteps[i + 1];

        const startStep = current.stepIndex;
        const endStep = next ? next.stepIndex - 1 : steps.length - 1;
        const itemCount = endStep - startStep;

        const exceedsThreshold = itemCount > threshold;

        regions.push({
            landmark: current.landmark,
            startStep,
            endStep,
            itemCount,
            exceedsThreshold,
        });

        if (exceedsThreshold) {
            const step = steps[startStep]!;
            violations.push(
                createViolation(
                    'content-density-per-region',
                    '2.4.1',
                    'A',
                    'moderate',
                    `${current.landmark} region contains ${itemCount} items (threshold: ${threshold}). This high density may overwhelm screen reader users. Consider breaking into smaller sections or adding sub-headings.`,
                    step,
                    arrowResult.meta.name
                )
            );
        }
    }

    return {
        violations,
        summary: {
            regions,
            totalRegionsOverThreshold: regions.filter((r) => r.exceedsThreshold).length,
            threshold,
        },
    };
}

// =============================================================================
// Rule: isolated-interactive-element (WCAG 2.4.4 A)
// =============================================================================

export interface IsolatedElement {
    stepIndex: number;
    element: string;
    role: string;
    contextBefore: string[];
    contextAfter: string[];
}

export interface IsolatedInteractiveElementSummary {
    isolatedElements: IsolatedElement[];
    totalIsolated: number;
    contextWindow: number;
}

export interface IsolatedInteractiveElementResult {
    violations: NvdaViolation[];
    summary: IsolatedInteractiveElementSummary;
}

const INTERACTIVE_ROLES = ['button', 'link', 'menuitem', 'tab', 'checkbox', 'radio', 'switch', 'textbox', 'combobox'];

/**
 * Analyzes for interactive elements (buttons, links) that have no surrounding
 * text context to explain their purpose.
 *
 * WCAG 2.4.4: Link Purpose (In Context) (Level A)
 */
export function analyzeIsolatedInteractiveElements(
    strategyResults: StrategyResult[],
    options: { contextWindow?: number } = {}
): IsolatedInteractiveElementResult {
    const contextWindow = options.contextWindow ?? 2; // Check 2 steps before/after
    const violations: NvdaViolation[] = [];
    const isolatedElements: IsolatedElement[] = [];

    const arrowResult = getArrowStrategyResult(strategyResults);
    if (!arrowResult) {
        return {
            violations: [],
            summary: {
                isolatedElements: [],
                totalIsolated: 0,
                contextWindow,
            },
        };
    }

    const steps = arrowResult.navigationSteps;

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i]!;
        const role = getRole(step);

        // Check if this is an interactive element
        if (!role || !INTERACTIVE_ROLES.includes(role)) {
            continue;
        }

        // Check if the element has a generic/ambiguous name
        const name = step.itemText.toLowerCase().trim();
        const genericNames = [
            'click',
            'click here',
            'here',
            'more',
            'read more',
            'learn more',
            'submit',
            'go',
            'ok',
            'button',
            'link',
        ];

        if (!genericNames.includes(name) && name.length > 3) {
            // Has a specific name, not isolated
            continue;
        }

        // Get context before and after
        const contextBefore: string[] = [];
        const contextAfter: string[] = [];

        for (let j = Math.max(0, i - contextWindow); j < i; j++) {
            const contextStep = steps[j]!;
            const contextRole = getRole(contextStep);
            // Only count non-interactive text as context
            if (!contextRole || !INTERACTIVE_ROLES.includes(contextRole)) {
                const text = contextStep.itemText.trim();
                if (text.length > 3) {
                    contextBefore.push(text);
                }
            }
        }

        for (let j = i + 1; j <= Math.min(steps.length - 1, i + contextWindow); j++) {
            const contextStep = steps[j]!;
            const contextRole = getRole(contextStep);
            if (!contextRole || !INTERACTIVE_ROLES.includes(contextRole)) {
                const text = contextStep.itemText.trim();
                if (text.length > 3) {
                    contextAfter.push(text);
                }
            }
        }

        // Check if there's meaningful context
        const hasContext = contextBefore.length > 0 || contextAfter.length > 0;

        if (!hasContext) {
            isolatedElements.push({
                stepIndex: i,
                element: step.itemText,
                role,
                contextBefore,
                contextAfter,
            });

            violations.push(
                createViolation(
                    'isolated-interactive-element',
                    '2.4.4',
                    'A',
                    'moderate',
                    `${role} "${step.itemText}" at step ${i} has no surrounding text context to explain its purpose. Screen reader users may not understand what this ${role} does.`,
                    step,
                    arrowResult.meta.name
                )
            );
        }
    }

    return {
        violations,
        summary: {
            isolatedElements,
            totalIsolated: isolatedElements.length,
            contextWindow,
        },
    };
}

// =============================================================================
// Combined Analysis
// =============================================================================

export interface ArrowNavigationAnalysisResult {
    stepsToMainContent: StepsToMainContentResult;
    readingOrderLandmarkSequence: ReadingOrderLandmarkSequenceResult;
    excessiveRepetition: ExcessiveRepetitionResult;
    contentDensityPerRegion: ContentDensityPerRegionResult;
    isolatedInteractiveElements: IsolatedInteractiveElementResult;
    totalViolations: number;
    allViolations: NvdaViolation[];
}

/**
 * Run all arrow navigation specific analyzers.
 */
export function analyzeArrowNavigation(
    strategyResults: StrategyResult[],
    options: {
        stepsToMainThreshold?: number;
        repetitionThreshold?: number;
        densityThreshold?: number;
        contextWindow?: number;
    } = {}
): ArrowNavigationAnalysisResult {
    const stepsToMainContent = analyzeStepsToMainContent(
        strategyResults,
        options.stepsToMainThreshold !== undefined ? { threshold: options.stepsToMainThreshold } : {}
    );

    const readingOrderLandmarkSequence = analyzeReadingOrderLandmarkSequence(strategyResults);

    const excessiveRepetition = analyzeExcessiveRepetition(
        strategyResults,
        options.repetitionThreshold !== undefined ? { threshold: options.repetitionThreshold } : {}
    );

    const contentDensityPerRegion = analyzeContentDensityPerRegion(
        strategyResults,
        options.densityThreshold !== undefined ? { threshold: options.densityThreshold } : {}
    );

    const isolatedInteractiveElements = analyzeIsolatedInteractiveElements(
        strategyResults,
        options.contextWindow !== undefined ? { contextWindow: options.contextWindow } : {}
    );

    const allViolations = [
        ...stepsToMainContent.violations,
        ...readingOrderLandmarkSequence.violations,
        ...excessiveRepetition.violations,
        ...contentDensityPerRegion.violations,
        ...isolatedInteractiveElements.violations,
    ];

    return {
        stepsToMainContent,
        readingOrderLandmarkSequence,
        excessiveRepetition,
        contentDensityPerRegion,
        isolatedInteractiveElements,
        totalViolations: allViolations.length,
        allViolations,
    };
}
