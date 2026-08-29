import { parse } from 'node-html-parser';
import { create } from 'xmlbuilder2';
import type { Violation, NvdaViolation, NvdaToolDetails } from '../../../analysis/violation';
import type {
    PromptNavigationStep,
    PromptStrategySection,
    TranscriptCorrelation,
    PromptViolation,
    PromptViolationGroup,
    PromptViolationsData,
    ViolationsSectionConfig,
    ResolvedViolationsConfig,
} from '../schemas';
import { mergeViolationsConfig } from '../schemas';

/**
 * Cleans HTML snippet for prompt inclusion.
 */
function cleanHtmlSnippet(html: string, maxLength: number): string {
    try {
        const root = parse(html, { comment: false });
        root.querySelectorAll('script, style, noscript, svg').forEach((el) => el.remove());

        let cleaned = root.outerHTML.trim();

        if (cleaned.length <= maxLength) {
            return cleaned;
        }

        // Fall back to text if too long
        const text = root.textContent.trim();
        if (text.length <= maxLength) {
            return text;
        }

        return text.slice(0, maxLength) + '...';
    } catch {
        return html.length <= maxLength ? html : html.slice(0, maxLength) + '...';
    }
}

/**
 * Checks if a violation is an NVDA violation with tool details.
 */
function isNvdaViolation(violation: Violation): violation is NvdaViolation {
    const details = violation.toolDetails as NvdaToolDetails | undefined;
    return (
        violation.tool === 'nvda-audit' &&
        details !== undefined &&
        typeof details.stepIndex === 'number' &&
        typeof details.navigationStrategy === 'string'
    );
}

/**
 * Extracts correlation from NVDA violation.
 */
function extractCorrelation(violation: NvdaViolation): TranscriptCorrelation {
    const details = violation.toolDetails;
    return {
        strategyName: details.navigationStrategy,
        stepIndex: details.stepIndex,
        spoken: details.spokenPhrases.join(' ').trim(),
        confidence: 'high', // Direct from same audit run
    };
}

/**
 * Tries to find correlation by matching HTML snippet or selector to transcript steps.
 */
function findCorrelation(
    violation: Violation,
    strategySections: PromptStrategySection[]
): TranscriptCorrelation | undefined {
    // NVDA violations have direct correlation
    if (isNvdaViolation(violation)) {
        return extractCorrelation(violation);
    }

    // For other tools, try to match by selector or content
    const selector = violation.element.selector;
    const htmlSnippet = violation.element.htmlSnippet;

    if (!selector && !htmlSnippet) {
        return undefined;
    }

    // Search through transcript steps for potential matches
    for (const section of strategySections) {
        for (const step of section.steps) {
            // Try to match by HTML content similarity
            if (htmlSnippet && step.htmlSnippet) {
                // Simple heuristic: check if accessible name appears in both
                const violationText = extractTextFromHtml(htmlSnippet);
                if (
                    violationText &&
                    step.itemText &&
                    (step.itemText.includes(violationText) || violationText.includes(step.itemText))
                ) {
                    return {
                        strategyName: section.strategyName,
                        stepIndex: step.index,
                        spoken: step.spoken,
                        confidence: 'medium',
                    };
                }
            }

            // Try to match by role + name
            if (step.axNode && violation.ruleId.includes(step.axNode.role)) {
                return {
                    strategyName: section.strategyName,
                    stepIndex: step.index,
                    spoken: step.spoken,
                    confidence: 'low',
                };
            }
        }
    }

    return undefined;
}

/**
 * Extracts text content from HTML string.
 */
function extractTextFromHtml(html: string): string {
    try {
        const root = parse(html);
        return root.textContent.trim();
    } catch {
        return '';
    }
}

/**
 * Transforms a violation into prompt-ready format.
 */
function transformViolation(
    violation: Violation,
    strategySections: PromptStrategySection[],
    config: ResolvedViolationsConfig
): PromptViolation {
    const wcag = `${violation.wcag.primary.criterion} ${violation.wcag.primary.level}`;

    let htmlSnippet: string | undefined;
    if (config.includeHtmlSnippets && violation.element.htmlSnippet) {
        htmlSnippet = cleanHtmlSnippet(violation.element.htmlSnippet, config.maxHtmlSnippetLength);
    }

    let correlation: TranscriptCorrelation | undefined;
    if (config.includeCorrelations) {
        correlation = findCorrelation(violation, strategySections);
    }

    return {
        id: violation.id,
        ruleId: violation.ruleId,
        wcag,
        wcagLevel: violation.wcag.primary.level,
        impact: violation.impact,
        message: violation.message,
        selector: violation.element.selector,
        htmlSnippet,
        correlation,
    };
}

/**
 * Groups violations by rule ID.
 */
function groupViolations(violations: PromptViolation[], config: ResolvedViolationsConfig): PromptViolationGroup[] {
    const groups = new Map<string, PromptViolation[]>();

    for (const violation of violations) {
        const existing = groups.get(violation.ruleId) ?? [];
        existing.push(violation);
        groups.set(violation.ruleId, existing);
    }

    return Array.from(groups.entries())
        .filter(([, items]) => items.length > 0)
        .map(([ruleId, items]) => {
            const first = items[0]!; // Safe: filtered for length > 0
            const limitedItems =
                config.maxViolationsPerGroup > 0 ? items.slice(0, config.maxViolationsPerGroup) : items;

            return {
                ruleId,
                wcag: first.wcag,
                wcagLevel: first.wcagLevel,
                impact: first.impact,
                count: items.length,
                violations: limitedItems,
            };
        });
}

/**
 * Filters violations based on config.
 */
function filterViolations(violations: Violation[], config: ResolvedViolationsConfig): Violation[] {
    return violations.filter((v) => {
        if (config.includeImpacts.length > 0 && !config.includeImpacts.includes(v.impact)) {
            return false;
        }
        if (config.includeRules.length > 0 && !config.includeRules.includes(v.ruleId)) {
            return false;
        }
        return true;
    });
}

/**
 * Builds violations data structure from violation array.
 */
export function buildViolationsData(
    violations: Violation[],
    strategySections: PromptStrategySection[] = [],
    config: ViolationsSectionConfig = {}
): PromptViolationsData {
    const mergedConfig = mergeViolationsConfig(config);

    const filtered = filterViolations(violations, mergedConfig);
    const transformed = filtered.map((v) => transformViolation(v, strategySections, mergedConfig));

    // Count by impact
    const byImpact: Record<string, number> = {};
    for (const v of transformed) {
        byImpact[v.impact] = (byImpact[v.impact] ?? 0) + 1;
    }

    // Group if configured
    const groups = mergedConfig.groupByRule
        ? groupViolations(transformed, mergedConfig)
        : transformed.map((v) => ({
              ruleId: v.ruleId,
              wcag: v.wcag,
              wcagLevel: v.wcagLevel,
              impact: v.impact,
              count: 1,
              violations: [v],
          }));

    return {
        groups,
        totalViolations: transformed.length,
        totalRules: new Set(transformed.map((v) => v.ruleId)).size,
        byImpact,
    };
}

/**
 * Renders violations data as XML for prompt inclusion using xmlbuilder2.
 */
export function renderViolationsXml(data: PromptViolationsData): string {
    if (data.totalViolations === 0) {
        return `<violations total="0" rules="0" />\n<!-- No violations found by static analyzers -->`;
    }

    // Build attributes including impact counts
    const attrs: Record<string, string | number> = {
        total: data.totalViolations,
        rules: data.totalRules,
    };

    for (const [impact, count] of Object.entries(data.byImpact)) {
        attrs[impact] = count;
    }

    const root = create().ele('violations', attrs);

    // Add each group
    for (const group of data.groups) {
        const groupAttrs: Record<string, string | number> = {
            id: group.ruleId,
            wcag: group.wcag,
            impact: group.impact,
            count: group.count,
        };

        if (group.count > group.violations.length) {
            groupAttrs.showing = group.violations.length;
        }

        const ruleEle = root.ele('rule', groupAttrs);

        for (const violation of group.violations) {
            const violationEle = ruleEle.ele('violation', { id: violation.id });
            violationEle.ele('message').txt(violation.message);

            if (violation.selector) {
                violationEle.ele('selector').txt(violation.selector);
            }

            if (violation.htmlSnippet) {
                violationEle.ele('html_snippet').dat(violation.htmlSnippet);
            }

            if (violation.correlation) {
                const c = violation.correlation;
                violationEle
                    .ele('transcript_match', {
                        strategy: c.strategyName,
                        step: c.stepIndex,
                        confidence: c.confidence,
                    })
                    .ele('spoken')
                    .txt(c.spoken);
            }
        }
    }

    return root.end({ prettyPrint: true, indent: '    ', headless: true });
}

/**
 * Convenience function: builds and renders violations XML in one call.
 */
export function buildViolationsSection(
    violations: Violation[],
    strategySections: PromptStrategySection[] = [],
    config: ViolationsSectionConfig = {}
): string {
    const data = buildViolationsData(violations, strategySections, config);
    return renderViolationsXml(data);
}
