/**
 * Arrow Navigation Analyzers
 *
 * These analyzers are designed to work with Arrow Navigation Strategy results,
 * which capture linear reading through the page content.
 *
 * Rules implemented (WCAG mappings live in the rule catalog):
 * - steps-to-main-content: Count steps to reach main landmark
 * - reading-order-landmark-sequence: Footer/aside before main in DOM
 * - excessive-repetition: Same phrase announced N+ times consecutively
 * - content-density-per-region: Items per landmark exceed threshold
 *
 * Linear reading is also the context signal for two rules that live elsewhere:
 * link-text judges generic link text against its surrounding announcements, and
 * focus-order compares tab order against reading order.
 */

import type {
    StrategyResult,
    NavigationStep,
} from '../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';
import type { NvdaViolation, NvdaToolDetails } from '../violation';
import type { TranscriptContext } from '../context';
import { createToolDetails } from '../tool-details';
import { ruleMetadata } from '../rule-catalog';
import type { Impact, RuleId } from '../rule-catalog';

// =============================================================================
// Helper Functions
// =============================================================================

function createViolation(
    ruleId: RuleId,
    message: string,
    step: NavigationStep,
    strategyName: string,
    impactOverride?: Impact
): NvdaViolation {
    return {
        id: `${ruleId}-${step.identifier}`,
        ...ruleMetadata(ruleId, impactOverride),
        message,
        element: {
            htmlSnippet: step.htmlSnippet ?? undefined,
            selector: undefined,
        },
        tool: 'nvda-audit',
        timestamp: step.timestamp,
        toolDetails: createToolDetails(step, strategyName, step.index),
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
    mainFound: boolean;
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
    { strategyResults }: TranscriptContext,
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
                mainFound: false,
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
                `Main content reached after ${stepsToMain} steps (threshold: ${threshold}). Users must navigate through excessive content before reaching main content. Consider adding or improving skip links.`,
                step,
                arrowResult.meta.name
            )
        );
    }

    // Never reaching a main landmark is worse than reaching it late: there is no
    // target for skip links and no way to bypass repeated content at all.
    if (mainFoundAtStep === null && steps.length > 0) {
        violations.push(
            createViolation(
                'missing-main-landmark',
                `No main landmark was announced across ${steps.length} steps of linear reading. Without a main landmark, screen reader users cannot jump past repeated header and navigation content. Wrap the primary content in a <main> element.`,
                steps[0]!,
                arrowResult.meta.name
            )
        );
    }

    return {
        violations,
        summary: {
            stepsToMain,
            mainFoundAtStep,
            mainFound: mainFoundAtStep !== null,
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

/**
 * Landmark announcements as NVDA speaks them, e.g. "banner landmark".
 *
 * The "landmark"/"region" qualifier is required: without it these patterns
 * collapse to bare word matches and fire on ordinary content ("domain" matching
 * main, "beside" matching aside), which corrupts every landmark boundary.
 *
 * Keys must be valid ARIA roles — they are also compared against the AX node
 * role, which is the more reliable of the two signals.
 */
const LANDMARK_PATTERNS: Record<string, RegExp> = {
    banner: /\bbanner\s+(landmark|region)\b/i,
    navigation: /\bnavigation\s+(landmark|region)\b/i,
    main: /\bmain\s+(landmark|region)\b/i,
    complementary: /\b(complementary|aside)\s+(landmark|region)\b/i,
    contentinfo: /\b(content\s*info|footer)\s+(landmark|region)\b/i,
};

/**
 * Analyzes if landmarks appear in a logical reading order.
 * Footer/aside appearing before main content indicates DOM order issues.
 *
 * WCAG 1.3.2: Meaningful Sequence (Level A)
 */
export function analyzeReadingOrderLandmarkSequence({
    strategyResults,
}: TranscriptContext): ReadingOrderLandmarkSequenceResult {
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
    const footerIndex = landmarkSequence.findIndex((l) => l.landmark === 'contentinfo');
    const asideIndex = landmarkSequence.findIndex((l) => l.landmark === 'complementary');

    const hasMainBeforeFooter = mainIndex === -1 || footerIndex === -1 || mainIndex < footerIndex;
    const hasMainBeforeAside = mainIndex === -1 || asideIndex === -1 || mainIndex < asideIndex;

    const violationMessages: string[] = [];

    // Check for footer before main
    if (!hasMainBeforeFooter && footerIndex !== -1 && mainIndex !== -1) {
        const footerStep = steps[landmarkSequence[footerIndex]!.stepIndex]!;
        violations.push(
            createViolation(
                'reading-order-landmark-sequence',
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
                `Complementary/aside landmark (step ${landmarkSequence[asideIndex]!.stepIndex}) appears before main landmark (step ${landmarkSequence[mainIndex]!.stepIndex}). Consider if sidebar content should come after main content.`,
                asideStep,
                arrowResult.meta.name,
                'moderate'
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
    { strategyResults }: TranscriptContext,
    options: { threshold?: number; minPhraseLength?: number } = {}
): ExcessiveRepetitionResult {
    // 5+ rather than 3+: a linear arrow walk crosses product grids and card lists
    // where 3 identical announcements in a row are normal rather than a defect.
    const threshold = options.threshold ?? 5;
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
    { strategyResults }: TranscriptContext,
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

        // Oversized navigation regions are already reported by the navigation-size
        // analyzer, which counts links rather than steps. Recording the region in the
        // summary but skipping the violation keeps the two from double-reporting.
        if (exceedsThreshold && current.landmark !== 'navigation') {
            const step = steps[startStep]!;
            violations.push(
                createViolation(
                    'content-density-per-region',
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
// Combined Analysis
// =============================================================================

export interface ArrowNavigationAnalysisResult {
    stepsToMainContent: StepsToMainContentResult;
    readingOrderLandmarkSequence: ReadingOrderLandmarkSequenceResult;
    excessiveRepetition: ExcessiveRepetitionResult;
    contentDensityPerRegion: ContentDensityPerRegionResult;
    totalViolations: number;
    allViolations: NvdaViolation[];
}

/**
 * Run all arrow navigation specific analyzers.
 */
export function analyzeArrowNavigation(
    context: TranscriptContext,
    options: {
        stepsToMainThreshold?: number;
        repetitionThreshold?: number;
        densityThreshold?: number;
    } = {}
): ArrowNavigationAnalysisResult {
    const stepsToMainContent = analyzeStepsToMainContent(
        context,
        options.stepsToMainThreshold !== undefined ? { threshold: options.stepsToMainThreshold } : {}
    );

    const readingOrderLandmarkSequence = analyzeReadingOrderLandmarkSequence(context);

    const excessiveRepetition = analyzeExcessiveRepetition(
        context,
        options.repetitionThreshold !== undefined ? { threshold: options.repetitionThreshold } : {}
    );

    const contentDensityPerRegion = analyzeContentDensityPerRegion(
        context,
        options.densityThreshold !== undefined ? { threshold: options.densityThreshold } : {}
    );

    const allViolations = [
        ...stepsToMainContent.violations,
        ...readingOrderLandmarkSequence.violations,
        ...excessiveRepetition.violations,
        ...contentDensityPerRegion.violations,
    ];

    return {
        stepsToMainContent,
        readingOrderLandmarkSequence,
        excessiveRepetition,
        contentDensityPerRegion,
        totalViolations: allViolations.length,
        allViolations,
    };
}
