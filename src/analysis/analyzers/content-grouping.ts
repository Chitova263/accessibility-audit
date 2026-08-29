/**
 * Analyzer: Content Grouping
 *
 * Detects potential missing section headings by analyzing:
 * - Large gaps between headings in linear navigation
 * - Landmarks containing many items but no heading
 * - Repeated similar content patterns without grouping headings
 *
 * These are flagged as "needs-review" since determining whether content
 * truly needs a heading requires semantic judgment (LLM analysis).
 *
 * Maps to WCAG 1.3.1 (Info and Relationships), 2.4.6 (Headings and Labels).
 */

import type {
    StrategyResult,
    NavigationStep,
} from '../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';
import type { NvdaViolation, NvdaToolDetails } from '../violation';

type ContentGroupingIssue = 'large-content-gap' | 'landmark-without-heading' | 'repeated-pattern-without-heading';

export interface ContentGroupingAnalyzerResult {
    violations: NvdaViolation[];
    summary: {
        totalGapsAnalyzed: number;
        landmarksAnalyzed: number;
        patternsAnalyzed: number;
        violationsFound: number;
        byIssue: Record<ContentGroupingIssue, number>;
    };
}

interface ContentGap {
    startStep: NavigationStep;
    endStep: NavigationStep;
    stepCount: number;
    startStepIndex: number;
    endStepIndex: number;
}

interface LandmarkContent {
    landmark: NavigationStep;
    stepIndex: number;
    contentSteps: NavigationStep[];
    hasHeading: boolean;
}

interface RepeatedPattern {
    pattern: string;
    occurrences: NavigationStep[];
    startIndex: number;
}

export interface ContentGroupingOptions {
    /** Minimum steps between headings to flag as a gap. Default: 15 */
    gapThreshold?: number;
    /** Minimum items in a landmark without heading to flag. Default: 5 */
    landmarkItemThreshold?: number;
    /** Minimum repetitions of similar content to flag. Default: 3 */
    repetitionThreshold?: number;
}

const DEFAULT_OPTIONS: Required<ContentGroupingOptions> = {
    gapThreshold: 15,
    landmarkItemThreshold: 5,
    repetitionThreshold: 3,
};

export function analyzeContentGrouping(
    strategyResults: StrategyResult[],
    options: ContentGroupingOptions = {}
): ContentGroupingAnalyzerResult {
    const config = { ...DEFAULT_OPTIONS, ...options };
    const violations: NvdaViolation[] = [];
    const byIssue: Record<ContentGroupingIssue, number> = {
        'large-content-gap': 0,
        'landmark-without-heading': 0,
        'repeated-pattern-without-heading': 0,
    };

    const arrowResult = getArrowStrategyResult(strategyResults);
    const headingResult = getHeadingStrategyResult(strategyResults);
    const landmarkResult = getLandmarkStrategyResult(strategyResults);

    // Analysis 1: Large gaps between headings in linear navigation
    if (arrowResult && headingResult) {
        const gaps = findLargeContentGaps(arrowResult, headingResult, config.gapThreshold);
        for (const gap of gaps) {
            byIssue['large-content-gap']++;
            violations.push(createLargeGapViolation(gap, config.gapThreshold));
        }
    }

    // Analysis 2: Landmarks with many items but no heading
    if (arrowResult && landmarkResult) {
        const landmarksWithoutHeadings = findLandmarksWithoutHeadings(
            arrowResult,
            landmarkResult,
            config.landmarkItemThreshold
        );
        for (const landmark of landmarksWithoutHeadings) {
            byIssue['landmark-without-heading']++;
            violations.push(createLandmarkWithoutHeadingViolation(landmark));
        }
    }

    // Analysis 3: Repeated content patterns without grouping heading
    if (arrowResult) {
        const patterns = findRepeatedPatternsWithoutHeading(arrowResult, headingResult, config.repetitionThreshold);
        for (const pattern of patterns) {
            byIssue['repeated-pattern-without-heading']++;
            violations.push(createRepeatedPatternViolation(pattern));
        }
    }

    return {
        violations,
        summary: {
            totalGapsAnalyzed: arrowResult?.navigationSteps.length ?? 0,
            landmarksAnalyzed: landmarkResult?.navigationSteps.length ?? 0,
            patternsAnalyzed: arrowResult?.navigationSteps.length ?? 0,
            violationsFound: violations.length,
            byIssue,
        },
    };
}

// =============================================================================
// Strategy Result Helpers
// =============================================================================

function getArrowStrategyResult(strategyResults: StrategyResult[]): StrategyResult | undefined {
    return strategyResults.find((r) => r.meta.type === 'arrow' || r.meta.name === 'ArrowNavigation');
}

function getHeadingStrategyResult(strategyResults: StrategyResult[]): StrategyResult | undefined {
    return strategyResults.find((r) => r.meta.type === 'heading' || r.meta.name === 'heading');
}

function getLandmarkStrategyResult(strategyResults: StrategyResult[]): StrategyResult | undefined {
    return strategyResults.find((r) => r.meta.type === 'landmark' || r.meta.name === 'landmark');
}

// =============================================================================
// Analysis 1: Large Content Gaps
// =============================================================================

function findLargeContentGaps(
    arrowResult: StrategyResult,
    headingResult: StrategyResult,
    threshold: number
): ContentGap[] {
    const gaps: ContentGap[] = [];
    const steps = arrowResult.navigationSteps;

    // Find indices where headings appear in arrow navigation
    const headingIndices = findHeadingIndicesInArrowNav(steps);

    if (headingIndices.length === 0) {
        // No headings at all - flag entire content if substantial
        if (steps.length >= threshold) {
            gaps.push({
                startStep: steps[0]!,
                endStep: steps[steps.length - 1]!,
                stepCount: steps.length,
                startStepIndex: 0,
                endStepIndex: steps.length - 1,
            });
        }
        return gaps;
    }

    // Check gap before first heading
    if (headingIndices[0]! >= threshold) {
        gaps.push({
            startStep: steps[0]!,
            endStep: steps[headingIndices[0]! - 1]!,
            stepCount: headingIndices[0]!,
            startStepIndex: 0,
            endStepIndex: headingIndices[0]! - 1,
        });
    }

    // Check gaps between headings
    for (let i = 0; i < headingIndices.length - 1; i++) {
        const gapSize = headingIndices[i + 1]! - headingIndices[i]! - 1;
        if (gapSize >= threshold) {
            gaps.push({
                startStep: steps[headingIndices[i]! + 1]!,
                endStep: steps[headingIndices[i + 1]! - 1]!,
                stepCount: gapSize,
                startStepIndex: headingIndices[i]! + 1,
                endStepIndex: headingIndices[i + 1]! - 1,
            });
        }
    }

    return gaps;
}

function findHeadingIndicesInArrowNav(steps: NavigationStep[]): number[] {
    const indices: number[] = [];
    for (let i = 0; i < steps.length; i++) {
        const step = steps[i]!;
        const spoken = step.spokenPhrases.join(' ').toLowerCase();
        // Check if this step announces a heading
        if (spoken.includes('heading, level') || spoken.includes('heading level')) {
            indices.push(i);
        }
    }
    return indices;
}

// =============================================================================
// Analysis 2: Landmarks Without Headings
// =============================================================================

function findLandmarksWithoutHeadings(
    arrowResult: StrategyResult,
    landmarkResult: StrategyResult,
    itemThreshold: number
): LandmarkContent[] {
    const results: LandmarkContent[] = [];
    const steps = arrowResult.navigationSteps;

    // Find landmark boundaries in arrow navigation
    const landmarkBoundaries = findLandmarkBoundaries(steps);

    for (const boundary of landmarkBoundaries) {
        // Skip small landmarks
        if (boundary.contentSteps.length < itemThreshold) continue;

        // Check if any content step contains a heading
        const hasHeading = boundary.contentSteps.some((step) => {
            const spoken = step.spokenPhrases.join(' ').toLowerCase();
            return spoken.includes('heading, level') || spoken.includes('heading level');
        });

        if (!hasHeading) {
            results.push(boundary);
        }
    }

    return results;
}

function findLandmarkBoundaries(steps: NavigationStep[]): LandmarkContent[] {
    const landmarks: LandmarkContent[] = [];
    let currentLandmark: LandmarkContent | null = null;

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i]!;
        const spoken = step.spokenPhrases.join(' ').toLowerCase();

        // Check if entering a new landmark
        if (spoken.includes('landmark')) {
            // Save previous landmark if exists
            if (currentLandmark) {
                landmarks.push(currentLandmark);
            }
            // Start new landmark
            currentLandmark = {
                landmark: step,
                stepIndex: i,
                contentSteps: [],
                hasHeading: false,
            };
        } else if (currentLandmark) {
            // Add step to current landmark's content
            currentLandmark.contentSteps.push(step);
        }
    }

    // Don't forget the last landmark
    if (currentLandmark) {
        landmarks.push(currentLandmark);
    }

    return landmarks;
}

// =============================================================================
// Analysis 3: Repeated Patterns Without Heading
// =============================================================================

function findRepeatedPatternsWithoutHeading(
    arrowResult: StrategyResult,
    headingResult: StrategyResult | undefined,
    repetitionThreshold: number
): RepeatedPattern[] {
    const patterns: RepeatedPattern[] = [];
    const steps = arrowResult.navigationSteps;

    // Look for repeated structural patterns (e.g., "graphic, heading, price, button" repeated)
    const structuralPatterns = findStructuralPatterns(steps, repetitionThreshold);

    for (const pattern of structuralPatterns) {
        // Check if there's a heading before this pattern group
        const hasHeadingBefore = checkHeadingBefore(steps, pattern.startIndex);

        if (!hasHeadingBefore) {
            patterns.push(pattern);
        }
    }

    return patterns;
}

function findStructuralPatterns(steps: NavigationStep[], minRepetitions: number): RepeatedPattern[] {
    const patterns: RepeatedPattern[] = [];

    // Extract role sequences for pattern detection
    const roleSequences: { role: string; step: NavigationStep; index: number }[] = [];

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i]!;
        const spoken = step.spokenPhrases.join(' ').toLowerCase();

        // Extract key structural elements from spoken text
        const role = extractStructuralRole(spoken);
        if (role) {
            roleSequences.push({ role, step, index: i });
        }
    }

    // Look for repeated role patterns (simplified: look for repeated "clickable" items)
    const clickableGroups = findConsecutiveGroups(roleSequences, 'clickable', minRepetitions);

    for (const group of clickableGroups) {
        patterns.push({
            pattern: 'clickable items',
            occurrences: group.map((g) => g.step),
            startIndex: group[0]!.index,
        });
    }

    return patterns;
}

function extractStructuralRole(spoken: string): string | null {
    // Extract the primary structural indicator
    if (spoken.includes('clickable')) return 'clickable';
    if (spoken.includes('button')) return 'button';
    if (spoken.includes('link')) return 'link';
    if (spoken.includes('graphic')) return 'graphic';
    return null;
}

function findConsecutiveGroups<T extends { role: string }>(items: T[], targetRole: string, minSize: number): T[][] {
    const groups: T[][] = [];
    let currentGroup: T[] = [];

    for (const item of items) {
        if (item.role === targetRole) {
            currentGroup.push(item);
        } else {
            if (currentGroup.length >= minSize) {
                groups.push(currentGroup);
            }
            currentGroup = [];
        }
    }

    // Check final group
    if (currentGroup.length >= minSize) {
        groups.push(currentGroup);
    }

    return groups;
}

function checkHeadingBefore(steps: NavigationStep[], beforeIndex: number): boolean {
    // Look back up to 5 steps for a heading
    const lookbackRange = Math.min(beforeIndex, 5);

    for (let i = beforeIndex - 1; i >= beforeIndex - lookbackRange; i--) {
        const step = steps[i];
        if (!step) continue;

        const spoken = step.spokenPhrases.join(' ').toLowerCase();
        if (spoken.includes('heading, level') || spoken.includes('heading level')) {
            return true;
        }
    }

    return false;
}

// =============================================================================
// Violation Creators
// =============================================================================

function createToolDetails(step: NavigationStep, strategyName: string, stepIndex: number): NvdaToolDetails {
    return {
        spokenPhrases: step.spokenPhrases,
        itemText: step.itemText,
        navigationStrategy: strategyName,
        stepIndex,
        axNode: step.axNode
            ? {
                  nodeId: step.axNode.nodeId,
                  role: (step.axNode.role as any)?.value,
                  name: (step.axNode.name as any)?.value,
                  properties: step.axNode.properties,
              }
            : undefined,
    };
}

function createLargeGapViolation(gap: ContentGap, threshold: number): NvdaViolation {
    return {
        id: `large-content-gap-${gap.startStep.identifier}`,
        ruleId: 'large-content-gap',
        wcag: {
            primary: { criterion: '1.3.1', level: 'A' },
            related: [{ criterion: '2.4.6', level: 'AA' }],
        },
        impact: 'moderate',
        message: `Large content section (${gap.stepCount} items) without a heading. Content between steps ${gap.startStepIndex} and ${gap.endStepIndex} may need a section heading for screen reader navigation. Threshold: ${threshold} items.`,
        element: {
            htmlSnippet: gap.startStep.htmlSnippet ?? undefined,
        },
        tool: 'nvda-audit',
        timestamp: Date.now(),
        toolDetails: createToolDetails(gap.startStep, 'ArrowNavigation', gap.startStepIndex),
    };
}

function createLandmarkWithoutHeadingViolation(landmark: LandmarkContent): NvdaViolation {
    const landmarkSpoken = landmark.landmark.spokenPhrases.join(' ');

    return {
        id: `landmark-without-heading-${landmark.landmark.identifier}`,
        ruleId: 'landmark-without-heading',
        wcag: {
            primary: { criterion: '1.3.1', level: 'A' },
            related: [{ criterion: '2.4.6', level: 'AA' }],
        },
        impact: 'moderate',
        message: `Landmark "${landmarkSpoken}" contains ${landmark.contentSteps.length} items but no heading. Consider adding a heading to help screen reader users understand the section's purpose.`,
        element: {
            htmlSnippet: landmark.landmark.htmlSnippet ?? undefined,
        },
        tool: 'nvda-audit',
        timestamp: Date.now(),
        toolDetails: createToolDetails(landmark.landmark, 'ArrowNavigation', landmark.stepIndex),
    };
}

function createRepeatedPatternViolation(pattern: RepeatedPattern): NvdaViolation {
    const firstOccurrence = pattern.occurrences[0]!;

    return {
        id: `repeated-pattern-${firstOccurrence.identifier}`,
        ruleId: 'repeated-pattern-without-heading',
        wcag: {
            primary: { criterion: '1.3.1', level: 'A' },
            related: [{ criterion: '2.4.6', level: 'AA' }],
        },
        impact: 'minor',
        message: `Repeated content pattern detected: ${pattern.occurrences.length} similar "${pattern.pattern}" without a preceding section heading. Consider adding a heading to group this content (e.g., "Products", "Results", "Items").`,
        element: {
            htmlSnippet: firstOccurrence.htmlSnippet ?? undefined,
        },
        tool: 'nvda-audit',
        timestamp: Date.now(),
        toolDetails: createToolDetails(firstOccurrence, 'ArrowNavigation', pattern.startIndex),
    };
}
