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
} from '../../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';
import type { NvdaViolation } from '../../core/violation';
import type { AuditContext } from '../../core/context';
import { createNvdaContext } from '../../utils/tool-details';
import { getRule } from '../../registry/rule-catalog';

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
    { transcript }: AuditContext,
    options: ContentGroupingOptions = {}
): ContentGroupingAnalyzerResult {
    const config = { ...DEFAULT_OPTIONS, ...options };
    const violations: NvdaViolation[] = [];
    const byIssue: Record<ContentGroupingIssue, number> = {
        'large-content-gap': 0,
        'landmark-without-heading': 0,
        'repeated-pattern-without-heading': 0,
    };

    const arrowResult = getArrowStrategyResult(transcript);
    const headingResult = getHeadingStrategyResult(transcript);
    const landmarkResult = getLandmarkStrategyResult(transcript);

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

function getArrowStrategyResult(transcript: StrategyResult[]): StrategyResult | undefined {
    return transcript.find((r) => r.meta.type === 'arrow' || r.meta.name === 'ArrowNavigation');
}

function getHeadingStrategyResult(transcript: StrategyResult[]): StrategyResult | undefined {
    return transcript.find((r) => r.meta.type === 'heading' || r.meta.name === 'heading');
}

function getLandmarkStrategyResult(transcript: StrategyResult[]): StrategyResult | undefined {
    return transcript.find((r) => r.meta.type === 'landmark' || r.meta.name === 'landmark');
}

function findLargeContentGaps(
    arrowResult: StrategyResult,
    headingResult: StrategyResult,
    threshold: number
): ContentGap[] {
    const gaps: ContentGap[] = [];
    const steps = arrowResult.navigationSteps;

    const headingIndices = findHeadingIndicesInArrowNav(steps);

    if (headingIndices.length === 0) {
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

    if (headingIndices[0]! >= threshold) {
        gaps.push({
            startStep: steps[0]!,
            endStep: steps[headingIndices[0]! - 1]!,
            stepCount: headingIndices[0]!,
            startStepIndex: 0,
            endStepIndex: headingIndices[0]! - 1,
        });
    }

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
        if (spoken.includes('heading, level') || spoken.includes('heading level')) {
            indices.push(i);
        }
    }
    return indices;
}

function findLandmarksWithoutHeadings(
    arrowResult: StrategyResult,
    landmarkResult: StrategyResult,
    itemThreshold: number
): LandmarkContent[] {
    const results: LandmarkContent[] = [];
    const steps = arrowResult.navigationSteps;

    const landmarkBoundaries = findLandmarkBoundaries(steps);

    for (const boundary of landmarkBoundaries) {
        if (boundary.contentSteps.length < itemThreshold) continue;

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

        if (spoken.includes('landmark')) {
            if (currentLandmark) {
                landmarks.push(currentLandmark);
            }
            currentLandmark = {
                landmark: step,
                stepIndex: i,
                contentSteps: [],
                hasHeading: false,
            };
        } else if (currentLandmark) {
            currentLandmark.contentSteps.push(step);
        }
    }

    if (currentLandmark) {
        landmarks.push(currentLandmark);
    }

    return landmarks;
}

function findRepeatedPatternsWithoutHeading(
    arrowResult: StrategyResult,
    headingResult: StrategyResult | undefined,
    repetitionThreshold: number
): RepeatedPattern[] {
    const patterns: RepeatedPattern[] = [];
    const steps = arrowResult.navigationSteps;

    const structuralPatterns = findStructuralPatterns(steps, repetitionThreshold);

    for (const pattern of structuralPatterns) {
        const hasHeadingBefore = checkHeadingBefore(steps, pattern.startIndex);

        if (!hasHeadingBefore) {
            patterns.push(pattern);
        }
    }

    return patterns;
}

function findStructuralPatterns(steps: NavigationStep[], minRepetitions: number): RepeatedPattern[] {
    const patterns: RepeatedPattern[] = [];

    const roleSequences: { role: string; step: NavigationStep; index: number }[] = [];

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i]!;
        const spoken = step.spokenPhrases.join(' ').toLowerCase();

        const role = extractStructuralRole(spoken);
        if (role) {
            roleSequences.push({ role, step, index: i });
        }
    }

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

    if (currentGroup.length >= minSize) {
        groups.push(currentGroup);
    }

    return groups;
}

function checkHeadingBefore(steps: NavigationStep[], beforeIndex: number): boolean {
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

function createLargeGapViolation(gap: ContentGap, threshold: number): NvdaViolation {
    return {
        id: `large-content-gap-${gap.startStep.identifier}`,
        rule: getRule('large-content-gap'),
        message: `Large content section (${gap.stepCount} items) without a heading. Content between steps ${gap.startStepIndex} and ${gap.endStepIndex} may need a section heading for screen reader navigation. Threshold: ${threshold} items.`,
        ...(gap.startStep.htmlSnippet != null ? { element: { htmlSnippet: gap.startStep.htmlSnippet } } : {}),
        tool: 'nvda-audit',
        timestamp: gap.startStep.timestamp,
        context: createNvdaContext(gap.startStep, 'ArrowNavigation', gap.startStepIndex),
    };
}

function createLandmarkWithoutHeadingViolation(landmark: LandmarkContent): NvdaViolation {
    const landmarkSpoken = landmark.landmark.spokenPhrases.join(' ');

    return {
        id: `landmark-without-heading-${landmark.landmark.identifier}`,
        rule: getRule('landmark-without-heading'),
        message: `Landmark "${landmarkSpoken}" contains ${landmark.contentSteps.length} items but no heading. Consider adding a heading to help screen reader users understand the section's purpose.`,
        ...(landmark.landmark.htmlSnippet != null ? { element: { htmlSnippet: landmark.landmark.htmlSnippet } } : {}),
        tool: 'nvda-audit',
        timestamp: landmark.landmark.timestamp,
        context: createNvdaContext(landmark.landmark, 'ArrowNavigation', landmark.stepIndex),
    };
}

function createRepeatedPatternViolation(pattern: RepeatedPattern): NvdaViolation {
    const firstOccurrence = pattern.occurrences[0]!;

    return {
        id: `repeated-pattern-${firstOccurrence.identifier}`,
        rule: getRule('repeated-pattern-without-heading'),
        message: `Repeated content pattern detected: ${pattern.occurrences.length} similar "${pattern.pattern}" without a preceding section heading. Consider adding a heading to group this content (e.g., "Products", "Results", "Items").`,
        ...(firstOccurrence.htmlSnippet != null ? { element: { htmlSnippet: firstOccurrence.htmlSnippet } } : {}),
        tool: 'nvda-audit',
        timestamp: firstOccurrence.timestamp,
        context: createNvdaContext(firstOccurrence, 'ArrowNavigation', pattern.startIndex),
    };
}
