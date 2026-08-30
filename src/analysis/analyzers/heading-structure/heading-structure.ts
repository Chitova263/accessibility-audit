/**
 * Analyzer: Heading Structure
 *
 * Detects heading hierarchy issues:
 * - Skipped heading levels (e.g., H1 → H3)
 * - Multiple H1s on page
 * - Missing H1
 * - Empty headings
 *
 * Maps to WCAG 1.3.1 (Info and Relationships).
 */

import type { NvdaViolation, NvdaContext } from '../../core/violation';
import type { AuditContext } from '../../core/context';
import { createNvdaContext } from '../../utils/tool-details';
import { getRule } from '../../registry/rule-catalog';
import { captureScreenshot } from '../../utils/screenshot-capture';

type HeadingIssue = 'skipped-level' | 'multiple-h1' | 'missing-h1' | 'empty-heading';

export interface HeadingStructureAnalyzerResult {
    violations: NvdaViolation[];
    summary: {
        totalHeadings: number;
        headingSequence: number[];
        violationsFound: number;
        byIssue: Record<HeadingIssue, number>;
    };
}

interface HeadingInfo {
    level: number;
    name: string;
    stepIndex: number;
    htmlSnippet: string | null;
    spokenPhrases: string[];
    itemText: string;
    identifier: string;
    timestamp: number;
    axNode: unknown;
    backendNodeId?: number;
}

export async function analyzeHeadingStructure(ctx: AuditContext): Promise<HeadingStructureAnalyzerResult> {
    const { transcript, page, cdp } = ctx;
    const violations: NvdaViolation[] = [];
    const byIssue: Record<HeadingIssue, number> = {
        'skipped-level': 0,
        'multiple-h1': 0,
        'missing-h1': 0,
        'empty-heading': 0,
    };

    // Collect all headings from heading strategies
    const headings: HeadingInfo[] = [];

    for (const result of transcript) {
        const strategyType = result.meta.type ?? result.meta.name;

        // Only process heading strategies
        if (!strategyType.startsWith('heading')) continue;

        for (let stepIndex = 0; stepIndex < result.navigationSteps.length; stepIndex++) {
            const step = result.navigationSteps[stepIndex]!;
            const node = step.axNode;

            if (!node || node.role?.value !== 'heading') continue;

            // Extract level from properties
            const levelProp = node.properties?.find((p: { name: string }) => p.name === 'level');
            const level = levelProp?.value?.value ?? 0;

            headings.push({
                level,
                name: node.name?.value ?? '',
                stepIndex,
                htmlSnippet: step.htmlSnippet,
                spokenPhrases: step.spokenPhrases,
                itemText: step.itemText,
                identifier: step.identifier,
                timestamp: step.timestamp,
                axNode: node,
                backendNodeId: node.backendDOMNodeId,
            });
        }
    }

    // Deduplicate headings by identifier (same heading might appear in multiple strategies)
    const uniqueHeadings = deduplicateHeadings(headings);
    const headingSequence = uniqueHeadings.map((h) => h.level);

    // Check: Missing H1 (no screenshot - absence of element)
    const h1Count = uniqueHeadings.filter((h) => h.level === 1).length;
    if (h1Count === 0 && uniqueHeadings.length > 0) {
        byIssue['missing-h1'] = 1;
        violations.push(createMissingH1Violation(uniqueHeadings[0]!));
    }

    // Check: Multiple H1s (has screenshot)
    if (h1Count > 1) {
        const h1Headings = uniqueHeadings.filter((h) => h.level === 1);
        byIssue['multiple-h1'] = h1Count - 1;

        // Flag all H1s after the first
        for (let i = 1; i < h1Headings.length; i++) {
            const heading = h1Headings[i]!;
            const context = createContext(heading);
            if (typeof heading.backendNodeId === 'number') {
                context.screenshot = (await captureScreenshot(page, cdp, heading.backendNodeId)) ?? undefined;
            }
            violations.push(createMultipleH1Violation(heading, i + 1, context));
        }
    }

    // Check: Skipped levels and empty headings
    let previousLevel = 0;

    for (const heading of uniqueHeadings) {
        // Empty heading (has screenshot)
        if (heading.name.trim() === '') {
            byIssue['empty-heading']++;
            const context = createContext(heading);
            if (typeof heading.backendNodeId === 'number') {
                context.screenshot = (await captureScreenshot(page, cdp, heading.backendNodeId)) ?? undefined;
            }
            violations.push(createEmptyHeadingViolation(heading, context));
        }

        // Skipped level (has screenshot)
        if (previousLevel > 0 && heading.level > previousLevel + 1) {
            byIssue['skipped-level']++;
            const context = createContext(heading);
            if (typeof heading.backendNodeId === 'number') {
                context.screenshot = (await captureScreenshot(page, cdp, heading.backendNodeId)) ?? undefined;
            }
            violations.push(createSkippedLevelViolation(heading, previousLevel, context));
        }

        previousLevel = heading.level;
    }

    return {
        violations,
        summary: {
            totalHeadings: uniqueHeadings.length,
            headingSequence,
            violationsFound: violations.length,
            byIssue,
        },
    };
}

function deduplicateHeadings(headings: HeadingInfo[]): HeadingInfo[] {
    const seen = new Set<string>();
    const unique: HeadingInfo[] = [];

    for (const h of headings) {
        // Use level + name + snippet as identity
        const key = `${h.level}:${h.name}:${h.htmlSnippet ?? ''}`;
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(h);
        }
    }

    return unique;
}

function createContext(heading: HeadingInfo): NvdaContext {
    return createNvdaContext(
        {
            identifier: heading.identifier,
            spokenPhrases: heading.spokenPhrases,
            itemText: heading.itemText,
            axNode: heading.axNode,
        },
        'heading',
        heading.stepIndex
    );
}

function createMissingH1Violation(firstHeading: HeadingInfo): NvdaViolation {
    return {
        id: `missing-h1-${firstHeading.identifier}`,
        rule: getRule('missing-h1'),
        message: `Page has no H1 heading. First heading found is H${firstHeading.level}. Pages should have exactly one H1 that describes the main content.`,
        ...(firstHeading.htmlSnippet != null && { element: { htmlSnippet: firstHeading.htmlSnippet } }),
        tool: 'nvda-audit',
        timestamp: firstHeading.timestamp,
        context: createContext(firstHeading),
    };
}

function createMultipleH1Violation(heading: HeadingInfo, count: number, context: NvdaContext): NvdaViolation {
    return {
        id: `multiple-h1-${heading.identifier}`,
        rule: getRule('multiple-h1'),
        message: `Multiple H1 headings found (this is H1 #${count}). Pages should have exactly one H1 that describes the main content.`,
        ...(heading.htmlSnippet != null && { element: { htmlSnippet: heading.htmlSnippet } }),
        tool: 'nvda-audit',
        timestamp: heading.timestamp,
        context,
    };
}

function createSkippedLevelViolation(heading: HeadingInfo, previousLevel: number, context: NvdaContext): NvdaViolation {
    return {
        id: `skipped-level-${heading.identifier}`,
        rule: getRule('heading-level-skipped'),
        message: `Heading level skipped: H${previousLevel} → H${heading.level}. Expected H${previousLevel + 1}. Skipping heading levels breaks the document outline for screen reader users.`,
        ...(heading.htmlSnippet != null && { element: { htmlSnippet: heading.htmlSnippet } }),
        tool: 'nvda-audit',
        timestamp: heading.timestamp,
        context,
    };
}

function createEmptyHeadingViolation(heading: HeadingInfo, context: NvdaContext): NvdaViolation {
    return {
        id: `empty-heading-${heading.identifier}`,
        rule: getRule('empty-heading'),
        message: `H${heading.level} heading has no text content. Empty headings confuse screen reader users navigating by heading.`,
        ...(heading.htmlSnippet != null && { element: { htmlSnippet: heading.htmlSnippet } }),
        tool: 'nvda-audit',
        timestamp: heading.timestamp,
        context,
    };
}
