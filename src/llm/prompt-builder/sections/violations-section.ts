import { parse } from 'node-html-parser';
import { create } from 'xmlbuilder2';
import type { Violation, ScreenReaderViolation } from '../../../analysis/core/violation';
import { isScreenReaderViolation } from '../../../analysis/core/violation';
import type {
    PromptStrategySection,
    TranscriptCorrelation,
    PromptViolation,
    PromptViolationGroup,
    PromptViolationsData,
    ViolationsSectionConfig,
    ResolvedViolationsConfig,
} from '../schemas';
import { mergeViolationsConfig } from '../schemas';

function cleanHtmlSnippet(html: string, maxLength: number): string {
    try {
        const root = parse(html, { comment: false });
        root.querySelectorAll('script, style, noscript, svg').forEach((el) => el.remove());

        const cleaned = root.outerHTML.trim();

        if (cleaned.length <= maxLength) {
            return cleaned;
        }

        const text = root.textContent.trim();
        if (text.length <= maxLength) {
            return text;
        }

        return text.slice(0, maxLength) + '...';
    } catch {
        return html.length <= maxLength ? html : html.slice(0, maxLength) + '...';
    }
}

function extractCorrelation(violation: ScreenReaderViolation): TranscriptCorrelation {
    const context = violation.context;
    return {
        strategyName: context.source.strategy,
        stepIndex: context.source.stepIndex,
        spoken: context.source.spokenPhrase,
        confidence: 'high',
    };
}

function findCorrelation(
    violation: Violation,
    strategySections: PromptStrategySection[]
): TranscriptCorrelation | undefined {
    if (isScreenReaderViolation(violation)) {
        return extractCorrelation(violation);
    }

    const selector = violation.element?.selector;
    const htmlSnippet = violation.element?.htmlSnippet;

    if (!selector && !htmlSnippet) {
        return undefined;
    }

    for (const section of strategySections) {
        for (const step of section.steps) {
            if (htmlSnippet && step.htmlSnippet) {
                const violationText = extractTextFromHtml(htmlSnippet);
                if (
                    violationText &&
                    step.focusedElementText &&
                    (step.focusedElementText.includes(violationText) || violationText.includes(step.focusedElementText))
                ) {
                    return {
                        strategyName: section.strategyName,
                        stepIndex: step.index,
                        spoken: step.spoken,
                        confidence: 'medium',
                    };
                }
            }

            if (step.axNode && violation.rule.id.includes(step.axNode.role)) {
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

function extractTextFromHtml(html: string): string {
    try {
        const root = parse(html);
        return root.textContent.trim();
    } catch {
        return '';
    }
}

function transformViolation(
    violation: Violation,
    strategySections: PromptStrategySection[],
    config: ResolvedViolationsConfig
): PromptViolation {
    const wcag = `${violation.rule.wcag.primary.criterion} ${violation.rule.wcag.primary.level}`;

    let htmlSnippet: string | undefined;
    if (config.includeHtmlSnippets && violation.element?.htmlSnippet) {
        htmlSnippet = cleanHtmlSnippet(violation.element.htmlSnippet, config.maxHtmlSnippetLength);
    }

    let correlation: TranscriptCorrelation | undefined;
    if (config.includeCorrelations) {
        correlation = findCorrelation(violation, strategySections);
    }

    return {
        id: violation.id,
        ruleId: violation.rule.id,
        wcag,
        wcagLevel: violation.rule.wcag.primary.level,
        impact: violation.rule.impact,
        message: violation.message,
        selector: violation.element?.selector,
        htmlSnippet,
        correlation,
    };
}

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

function filterViolations(violations: Violation[], config: ResolvedViolationsConfig): Violation[] {
    return violations.filter((v) => {
        if (config.includeImpacts.length > 0 && !config.includeImpacts.includes(v.rule.impact)) {
            return false;
        }
        if (config.includeRules.length > 0 && !config.includeRules.includes(v.rule.id)) {
            return false;
        }
        return true;
    });
}

export function buildViolationsData(
    violations: Violation[],
    strategySections: PromptStrategySection[] = [],
    config: ViolationsSectionConfig = {}
): PromptViolationsData {
    const mergedConfig = mergeViolationsConfig(config);

    const filtered = filterViolations(violations, mergedConfig);
    const transformed = filtered.map((v) => transformViolation(v, strategySections, mergedConfig));

    const byImpact: Record<string, number> = {};
    for (const v of transformed) {
        byImpact[v.impact] = (byImpact[v.impact] ?? 0) + 1;
    }

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

export function renderViolationsXml(data: PromptViolationsData): string {
    if (data.totalViolations === 0) {
        return `<violations total="0" rules="0" />\n<!-- No violations found by static analyzers -->`;
    }

    const attrs: Record<string, string | number> = {
        total: data.totalViolations,
        rules: data.totalRules,
    };

    for (const [impact, count] of Object.entries(data.byImpact)) {
        attrs[impact] = count;
    }

    const root = create().ele('violations', attrs);

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
                const correlation = violation.correlation;
                violationEle
                    .ele('transcript_match', {
                        strategy: correlation.strategyName,
                        step: correlation.stepIndex,
                        confidence: correlation.confidence,
                    })
                    .ele('spoken')
                    .txt(correlation.spoken);
            }
        }
    }

    return root.end({ prettyPrint: true, indent: '    ', headless: true });
}

export function buildViolationsSection(
    violations: Violation[],
    strategySections: PromptStrategySection[] = [],
    config: ViolationsSectionConfig = {}
): string {
    const data = buildViolationsData(violations, strategySections, config);
    return renderViolationsXml(data);
}
