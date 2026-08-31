/**
 * HTML Reporter
 *
 * Generates a standalone HTML report from accessibility audit results.
 * The report is self-contained with embedded CSS and can be opened in any browser.
 */

import { readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import type { Reporter, ReportData, ReportOutput, ReporterOptions } from '../reporter';
import type { StrategyResult } from '../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';
import {
    generateFilename,
    formatTimestamp,
    formatDuration,
    getSeverityColor,
    getAssessmentColor,
    getConfidenceColor,
    escapeHtml,
    truncate,
} from '../reporter';
import type { LlmFinding, LlmViolationEnhancement } from '../../llm/prompt-builder';

export interface HtmlReporterOptions extends ReporterOptions {
    /** Theme: 'light' or 'dark' */
    theme?: 'light' | 'dark';

    /** Include collapsible sections */
    collapsible?: boolean;

    /** Include search/filter functionality */
    interactive?: boolean;

    /** Logo URL to include in header */
    logoUrl?: string;

    /** Custom CSS to inject */
    customCss?: string;

    /** Base path for resolving screenshot paths (defaults to cwd) */
    screenshotsBasePath?: string;
}

const DEFAULT_OPTIONS: Required<HtmlReporterOptions> = {
    includeTranscript: true,
    includeHtmlSnippets: true,
    title: 'Accessibility Audit Report',
    theme: 'light',
    collapsible: true,
    interactive: true,
    logoUrl: '',
    customCss: '',
    screenshotsBasePath: process.cwd(),
};

export class HtmlReporter implements Reporter {
    readonly name = 'html';

    async generate(data: ReportData, options?: HtmlReporterOptions): Promise<ReportOutput> {
        const opts = { ...DEFAULT_OPTIONS, ...options };

        // Preload screenshots from files for violations that have path references
        const screenshotCache = await this.preloadScreenshots(data, opts.screenshotsBasePath);

        const html = this.buildHtml(data, opts, screenshotCache);

        return {
            format: 'html',
            content: html,
            filename: generateFilename('accessibility-report', 'html'),
            mimeType: 'text/html',
        };
    }

    /**
     * Preload all screenshots from file paths into base64 data.
     * This allows the HTML to be self-contained with embedded images.
     */
    private async preloadScreenshots(data: ReportData, basePath: string): Promise<Map<string, string>> {
        const cache = new Map<string, string>();

        for (const violation of data.violations) {
            const nvdaContext = violation.context as
                { screenshot?: { path?: string; error?: string; width?: number; height?: number } } | undefined;

            const screenshot = nvdaContext?.screenshot;
            if (!screenshot) continue;

            // Only load if it's a success (has path, no error)
            if ('path' in screenshot && screenshot.path) {
                try {
                    const fullPath = resolve(basePath, screenshot.path);
                    const buffer = await readFile(fullPath);
                    const base64 = buffer.toString('base64');
                    cache.set(screenshot.path, base64);
                } catch (e) {
                    // Screenshot file not found or unreadable - skip it
                    console.warn(`Warning: Could not load screenshot from ${screenshot.path}: ${e}`);
                }
            }
        }

        return cache;
    }

    private buildHtml(
        data: ReportData,
        opts: Required<HtmlReporterOptions>,
        screenshotCache: Map<string, string>
    ): string {
        return `<!DOCTYPE html>
<html lang="en" data-theme="${opts.theme}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(opts.title)}</title>
    <style>${this.getStyles(opts)}</style>
</head>
<body>
    ${this.buildHeader(data, opts)}
    <main>
        ${this.buildSummary(data)}
        ${this.buildViolations(data, screenshotCache)}
        ${this.buildFindings(data)}
        ${opts.includeTranscript ? this.buildTranscript(data) : ''}
        ${this.buildLimitations(data)}
    </main>
    ${this.buildFooter(data)}
    ${opts.interactive ? this.getScripts() : ''}
</body>
</html>`;
    }

    private buildHeader(data: ReportData, opts: Required<HtmlReporterOptions>): string {
        const logo = opts.logoUrl ? `<img src="${escapeHtml(opts.logoUrl)}" alt="Logo" class="logo">` : '';

        return `
<header>
    <div class="header-content">
        ${logo}
        <div class="header-text">
            <h1>${escapeHtml(opts.title)}</h1>
            <p class="page-info">
                <strong>URL:</strong> <a href="${escapeHtml(data.page.url)}" target="_blank">${escapeHtml(data.page.url)}</a><br>
                <strong>Title:</strong> ${escapeHtml(data.page.title)}
            </p>
        </div>
    </div>
    <div class="meta-info">
        <span>Generated: ${formatTimestamp(data.meta.timestamp)}</span>
        ${data.meta.duration ? `<span>Duration: ${formatDuration(data.meta.duration)}</span>` : ''}
        ${data.meta.toolVersion ? `<span>Tool: v${escapeHtml(data.meta.toolVersion)}</span>` : ''}
    </div>
</header>`;
    }

    private buildFooter(data: ReportData): string {
        return `
<footer>
    <p>Generated by NVDA Accessibility Audit Tool</p>
    <p>Report ID: ${data.meta.timestamp}</p>
</footer>`;
    }

    private buildSummary(data: ReportData): string {
        const { summary } = data.analysis.analysis;
        const assessmentColor = getAssessmentColor(summary.overallAssessment);

        const findingsCount = data.analysis.analysis.findings.length;
        const enhancementsCount = data.analysis.enhancements.length;
        const violationsCount = data.violations.length;

        return `
<section class="summary" aria-labelledby="summary-heading">
    <h2 id="summary-heading">Summary</h2>
    
    <div class="assessment-badge" style="--badge-color: ${assessmentColor}">
        ${this.formatAssessment(summary.overallAssessment)}
    </div>

    <div class="stats-grid">
        <div class="stat-card">
            <span class="stat-value">${violationsCount}</span>
            <span class="stat-label">Rule Violations</span>
        </div>
        <div class="stat-card">
            <span class="stat-value">${findingsCount}</span>
            <span class="stat-label">LLM Findings</span>
        </div>
        <div class="stat-card">
            <span class="stat-value">${enhancementsCount}</span>
            <span class="stat-label">Enhancements</span>
        </div>
        <div class="stat-card">
            <span class="stat-value">${summary.totalSteps}</span>
            <span class="stat-label">Steps Analyzed</span>
        </div>
        <div class="stat-card">
            <span class="stat-value">${summary.stepsToMainContent ?? 'N/A'}</span>
            <span class="stat-label">Steps to Main</span>
        </div>
    </div>

    ${
        summary.majorConcerns.length > 0
            ? `
    <div class="major-concerns">
        <h3>Major Concerns</h3>
        <ul>
            ${summary.majorConcerns.map((c) => `<li>${escapeHtml(c)}</li>`).join('\n')}
        </ul>
    </div>
    `
            : ''
    }
</section>`;
    }

    private formatAssessment(assessment: string): string {
        return assessment;
    }

    private buildFindings(data: ReportData): string {
        const findings = data.analysis.analysis.findings;

        if (findings.length === 0) {
            return `
<section class="findings" aria-labelledby="findings-heading">
    <h2 id="findings-heading">LLM Findings</h2>
    <p class="no-items">No additional findings identified by LLM analysis.</p>
</section>`;
        }

        // Group by category
        const byCategory = this.groupBy(findings, (f) => f.category);

        return `
<section class="findings" aria-labelledby="findings-heading">
    <h2 id="findings-heading">LLM Findings <span class="count">(${findings.length})</span></h2>
    
    ${Object.entries(byCategory)
        .map(
            ([category, items]) => `
    <div class="category-group">
        <h3 class="category-heading">${this.formatCategory(category)} <span class="count">(${items.length})</span></h3>
        ${items.map((f) => this.buildFindingCard(f)).join('\n')}
    </div>
    `
        )
        .join('\n')}
</section>`;
    }

    private buildFindingCard(finding: LlmFinding): string {
        return `
<article class="finding-card">
    <p class="finding-issue">${escapeHtml(finding.issue)}</p>
    
    <div class="finding-meta">
        <span><strong>Category:</strong> ${escapeHtml(finding.category)}</span>
        <span><strong>Confidence:</strong> ${escapeHtml(finding.confidence)}</span>
        ${finding.classification ? `<span><strong>Classification:</strong> ${escapeHtml(finding.classification)}</span>` : ''}
        ${finding.relatedRuleId ? `<span><strong>Related rule:</strong> ${escapeHtml(finding.relatedRuleId)}</span>` : ''}
    </div>
    
    <div class="finding-details">
        <div class="detail-section">
            <h4>Impact</h4>
            <p>${escapeHtml(finding.impact)}</p>
        </div>
        
        <div class="detail-section">
            <h4>Evidence</h4>
            <ul class="evidence-list">
                ${finding.evidence.steps
                    .map(
                        (step) => `
                    <li>
                        <a href="#step-${escapeHtml(step.identifier)}" class="evidence-link">
                            <span class="evidence-ref">${escapeHtml(step.strategy)} [${step.stepIndex}]</span>
                        </a>
                        <code>${escapeHtml(step.spokenPhrase)}</code>
                    </li>
                `
                    )
                    .join('\n')}
            </ul>
            ${finding.evidence.pattern ? `<p class="pattern">${escapeHtml(finding.evidence.pattern)}</p>` : ''}
        </div>

        ${
            finding.semanticJustification
                ? `
        <div class="detail-section">
            <h4>Justification</h4>
            <p>${escapeHtml(finding.semanticJustification)}</p>
        </div>
        `
                : ''
        }
    </div>
    
    ${finding.requiresHumanReview ? '<p class="human-review">⚠ Requires human review</p>' : ''}
</article>`;
    }

    private formatCategory(category: string): string {
        return category;
    }

    private buildViolations(data: ReportData, screenshotCache: Map<string, string>): string {
        const violations = data.violations;

        if (violations.length === 0) {
            return `
<section class="violations" aria-labelledby="violations-heading">
    <h2 id="violations-heading">Violations</h2>
    <p class="no-items">No violations detected.</p>
</section>`;
        }

        const enhancementMap = new Map(data.analysis.enhancements.map((e) => [e.violationId, e]));

        const byRule = this.groupBy(violations, (v) => v.rule.id);

        return `
<section class="violations" aria-labelledby="violations-heading">
    <h2 id="violations-heading">Violations <span class="count">(${violations.length})</span></h2>
    
    ${Object.entries(byRule)
        .map(
            ([ruleId, items]) => `
    <div class="rule-group">
        <h3 class="rule-heading">
            <span class="rule-id">${escapeHtml(ruleId)}</span>
            <span class="rule-wcag">${escapeHtml(items[0]?.rule.wcag?.primary?.criterion ?? '')}</span>
            <span class="rule-impact impact-${items[0]?.rule.impact ?? 'moderate'}">${escapeHtml(items[0]?.rule.impact ?? '')}</span>
            <span class="count">(${items.length})</span>
        </h3>
        <p class="rule-summary">${escapeHtml(items[0]?.rule.summary ?? '')}</p>
        ${items.map((v) => this.buildViolationCard(v, enhancementMap.get(v.id), screenshotCache)).join('\n')}
    </div>
    `
        )
        .join('\n')}
</section>`;
    }

    private buildViolationCard(
        violation: ReportData['violations'][0],
        enhancement: LlmViolationEnhancement | undefined,
        screenshotCache: Map<string, string>
    ): string {
        const ctx = violation.context as
            | {
                  source?: { strategy: string; stepIndex: number; stepId: string; spokenPhrase: string };
                  axNode?: { nodeId: string; role?: string; name?: string; properties?: unknown };
                  screenshot?: { path?: string; error?: string; width?: number; height?: number };
              }
            | undefined;

        const source = ctx?.source;
        const axNode = ctx?.axNode;
        const screenshot = ctx?.screenshot;

        // Build attachment tabs content
        const hasScreenshot = screenshot && 'path' in screenshot && screenshot.path && screenshotCache.has(screenshot.path);
        const hasHtml = !!violation.element?.htmlSnippet;
        const hasAttachments = hasScreenshot || hasHtml;

        let screenshotTab = '';
        let htmlTab = '';

        if (hasScreenshot && screenshot.path) {
            const base64 = screenshotCache.get(screenshot.path);
            if (base64) {
                screenshotTab = `
                <div class="v-tab-panel" id="screenshot-${escapeHtml(violation.id)}" role="tabpanel" aria-labelledby="screenshot-tab-${escapeHtml(violation.id)}">
                    <div class="v-screenshot-container">
                        <img src="data:image/png;base64,${base64}" 
                             alt="Element highlighted on page showing the violation in context" 
                             loading="lazy"
                             class="v-screenshot-full">
                        <div class="v-screenshot-meta">
                            <span class="v-screenshot-size">${screenshot.width} × ${screenshot.height}px</span>
                            <button type="button" class="v-screenshot-zoom" aria-label="View full size" title="Open in lightbox">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>`;
            }
        }

        if (hasHtml) {
            htmlTab = `
            <div class="v-tab-panel" id="html-${escapeHtml(violation.id)}" role="tabpanel" aria-labelledby="html-tab-${escapeHtml(violation.id)}" hidden>
                <div class="v-html-container">
                    <pre><code>${escapeHtml(truncate(violation.element!.htmlSnippet!, 800))}</code></pre>
                    ${violation.element?.selector ? `<span class="v-selector">${escapeHtml(violation.element.selector)}</span>` : ''}
                </div>
            </div>`;
        }

        const attachmentsSection = hasAttachments ? `
        <details class="v-attachments">
            <summary class="v-attachments-toggle">
                <svg class="v-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 18l6-6-6-6"/>
                </svg>
                <span>Attachments</span>
                <span class="v-attachments-count">${(hasScreenshot ? 1 : 0) + (hasHtml ? 1 : 0)}</span>
            </summary>
            <div class="v-attachments-content">
                ${hasScreenshot && hasHtml ? `
                <div class="v-tabs" role="tablist" aria-label="Violation attachments">
                    <button type="button" role="tab" id="screenshot-tab-${escapeHtml(violation.id)}" aria-selected="true" aria-controls="screenshot-${escapeHtml(violation.id)}" class="v-tab is-active">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                        </svg>
                        Screenshot
                    </button>
                    <button type="button" role="tab" id="html-tab-${escapeHtml(violation.id)}" aria-selected="false" aria-controls="html-${escapeHtml(violation.id)}" class="v-tab" tabindex="-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="16 18 22 12 16 6"/>
                            <polyline points="8 6 2 12 8 18"/>
                        </svg>
                        HTML
                    </button>
                </div>
                ` : hasScreenshot ? `
                <div class="v-attachment-header">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <span>Screenshot</span>
                </div>
                ` : `
                <div class="v-attachment-header">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="16 18 22 12 16 6"/>
                        <polyline points="8 6 2 12 8 18"/>
                    </svg>
                    <span>HTML Snippet</span>
                </div>
                `}
                ${screenshotTab}
                ${htmlTab}
            </div>
        </details>` : '';

        return `
<article class="violation-card" id="violation-${escapeHtml(violation.id)}">
    <div class="v-header">
        <p class="v-message">${escapeHtml(violation.message)}</p>
        ${hasAttachments ? '<span class="v-has-attachment" title="Has attachments">📎</span>' : ''}
    </div>

    ${
        source || axNode
            ? `
    <div class="v-details">
        ${
            source
                ? `
        <div class="v-detail-row">
            <span class="v-detail-label">Detected at</span>
            <div class="v-detail-value">
                <a href="#step-${escapeHtml(source.stepId)}" class="v-source-link">
                    <span class="v-source-part"><span class="v-source-label">Strategy</span><span class="v-source-value">${escapeHtml(source.strategy)}</span></span>
                    <span class="v-source-part"><span class="v-source-label">Step</span><span class="v-source-value">#${source.stepIndex}</span></span>
                </a>
            </div>
        </div>
        <div class="v-detail-row">
            <span class="v-detail-label">Announced</span>
            <div class="v-detail-value">
                <span class="v-spoken-text">${escapeHtml(source.spokenPhrase) || '<em class="v-empty-speech">(empty)</em>'}</span>
            </div>
        </div>
        `
                : ''
        }
        ${
            axNode
                ? `
        <div class="v-detail-row">
            <span class="v-detail-label">Element</span>
            <div class="v-detail-value">
                ${axNode.role ? `<code class="v-ax-role">${escapeHtml(axNode.role)}</code>` : ''}
                ${axNode.name ? `<span class="v-ax-name">"${escapeHtml(truncate(axNode.name, 80))}"</span>` : '<span class="v-ax-name v-empty">(no accessible name)</span>'}
            </div>
        </div>
        `
                : ''
        }
    </div>
    `
            : ''
    }

    ${
        enhancement
            ? `
    <div class="v-enhancement">
        ${enhancement.userImpactDescription ? `<p class="v-impact"><strong>Impact:</strong> ${escapeHtml(enhancement.userImpactDescription)}</p>` : ''}
        ${enhancement.remediationSuggestion ? `<p class="v-remediation"><strong>Fix:</strong> ${escapeHtml(enhancement.remediationSuggestion)}</p>` : ''}
    </div>
    `
            : ''
    }

    ${attachmentsSection}
</article>`;
    }

    private buildLimitations(data: ReportData): string {
        const limitations = data.analysis.analysis.limitations;

        if (limitations.length === 0) {
            return '';
        }

        return `
<section class="limitations" aria-labelledby="limitations-heading">
    <h2 id="limitations-heading">Analysis Limitations</h2>
    <p>The following aspects could not be determined from the transcript alone:</p>
    <ul>
        ${limitations.map((l) => `<li>${escapeHtml(l)}</li>`).join('\n')}
    </ul>
</section>`;
    }

    private buildTranscript(data: ReportData): string {
        if (!data.transcript || data.transcript.length === 0) {
            return `
<section class="transcript" aria-labelledby="transcript-heading">
    <h2 id="transcript-heading">Screen Reader Transcript</h2>
    <p class="no-items">No transcript data available.</p>
</section>`;
        }

        const strategies = data.transcript.filter((s) => s.navigationSteps.length > 0);
        const totalSteps = strategies.reduce((sum, s) => sum + s.navigationSteps.length, 0);
        const cited = this.citedStepIdentifiers(data);

        const walkChips = strategies
            .map(
                (s) =>
                    `<button type="button" class="t-chip" data-walk="${escapeHtml(s.meta.name)}" aria-pressed="false" title="${escapeHtml(s.meta.description)}">${escapeHtml(s.meta.name)}<span class="t-chip-count">${s.navigationSteps.length}</span></button>`
            )
            .join('\n');

        const blocks = strategies
            .map((s) => {
                const lines = s.navigationSteps.map((step) => this.buildRow(step, s.meta.name, cited)).join('\n');
                return `
<div class="t-walk-block" data-walk="${escapeHtml(s.meta.name)}">
    <div class="t-walk-header" title="${escapeHtml(s.meta.description)}">
        <span class="t-walk-name">${escapeHtml(s.meta.name)}</span>
        <span class="t-walk-count">${s.navigationSteps.length} step${s.navigationSteps.length !== 1 ? 's' : ''}</span>
    </div>
    <div class="t-lines">
${lines}
    </div>
</div>`;
            })
            .join('\n');

        return `
<section class="transcript" aria-labelledby="transcript-heading">
    <h2 id="transcript-heading">Screen Reader Transcript <span class="count">${totalSteps} steps</span></h2>

    <div class="t-controls">
        <label class="t-search" for="transcript-filter">
            <span class="visually-hidden">Filter announcements</span>
            <input type="search" id="transcript-filter" placeholder="Filter announcements&hellip;" autocomplete="off">
        </label>
        <div class="t-chips" role="group" aria-label="Filter by navigation walk">
            <button type="button" class="t-chip is-active" data-walk="all" aria-pressed="true">All</button>
            ${walkChips}
        </div>
        <p class="t-status" role="status" aria-live="polite"></p>
    </div>

    <div class="t-body">
${blocks}
    </div>
</section>`;
    }

    /**
     * Step identifiers the analysis cites as evidence.
     *
     * The findings section links into the transcript; this lets the transcript
     * point back, so a reader scanning it can see which steps mattered.
     */
    private citedStepIdentifiers(data: ReportData): Set<string> {
        const identifiers = new Set<string>();

        for (const finding of data.analysis.analysis.findings) {
            for (const step of finding.evidence.steps) {
                identifiers.add(step.identifier);
            }
        }

        return identifiers;
    }

    /**
     * One transcript line per step.
     *
     * Layout: step-number  [cited]  "announcement text"  [</>]
     * Markup expands inline below the line, not in a sibling row.
     */
    private buildRow(
        step: {
            index: number;
            identifier: string;
            spokenPhrases: string[];
            itemText: string;
            htmlSnippet: string | null;
        },
        walk: string,
        cited: Set<string>
    ): string {
        const spoken = step.spokenPhrases.join(' ') || step.itemText || '(no announcement)';
        const isCited = cited.has(step.identifier);
        const markup = step.htmlSnippet ? this.formatHtmlSnippet(step.htmlSnippet) : null;
        const lineId = `step-${escapeHtml(step.identifier)}`;
        const markupId = `markup-${escapeHtml(step.identifier)}`;
        const walkAttr = escapeHtml(walk);

        const citedBadge = isCited
            ? `<span class="t-cited" title="Cited as evidence by the analysis">cited</span>`
            : '';

        const markupToggle = markup
            ? `<button type="button" class="t-markup-toggle" aria-expanded="false" aria-controls="${markupId}" title="Show HTML markup">&lt;/&gt;</button>`
            : '';

        const markupBlock = markup
            ? `<div class="t-markup" id="${markupId}" hidden><pre><code>${markup}</code></pre></div>`
            : '';

        return `<div class="t-line${isCited ? ' t-line--cited' : ''}" id="${lineId}" data-walk="${walkAttr}">
    <span class="t-num"><a href="#${lineId}" tabindex="-1" aria-label="Step ${step.index}">${step.index}</a></span>
    <span class="t-text">${escapeHtml(spoken)}</span>
    <span class="t-actions">${citedBadge}${markupToggle}</span>
    ${markupBlock}
</div>`;
    }

    /**
     * Format HTML snippet with proper indentation for readability.
     * Uses node-html-parser for reliable HTML parsing and formatting.
     */
    private formatHtmlSnippet(html: string): string {
        // Truncate if too long before formatting
        const snippet = html.length > 600 ? html.slice(0, 600) + '...' : html;

        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { parse } = require('node-html-parser');
            const root = parse(snippet, {
                lowerCaseTagName: false,
                comment: true,
                voidTag: {
                    tags: [
                        'area',
                        'base',
                        'br',
                        'col',
                        'embed',
                        'hr',
                        'img',
                        'input',
                        'link',
                        'meta',
                        'param',
                        'source',
                        'track',
                        'wbr',
                    ],
                },
            });

            // Format with indentation
            const formatted = this.formatNode(root, 0);
            return escapeHtml(formatted.trim());
        } catch {
            // Fallback to basic formatting if parser fails
            return escapeHtml(this.basicHtmlFormat(snippet));
        }
    }

    /**
     * Recursively format an HTML node with indentation.
     */
    private formatNode(node: any, depth: number): string {
        const indent = '  '.repeat(depth);

        // Text node
        if (node.nodeType === 3) {
            const text = node.text?.trim();
            return text ? `${indent}${text}\n` : '';
        }

        // Comment node
        if (node.nodeType === 8) {
            return `${indent}<!--${node.text}-->\n`;
        }

        // Root node - just process children
        if (!node.tagName) {
            return node.childNodes?.map((child: any) => this.formatNode(child, depth)).join('') || '';
        }

        // Element node
        const tagName = node.tagName.toLowerCase();
        const attrs = node.rawAttrs ? ` ${node.rawAttrs}` : '';

        // Void elements (self-closing)
        const voidTags = [
            'area',
            'base',
            'br',
            'col',
            'embed',
            'hr',
            'img',
            'input',
            'link',
            'meta',
            'param',
            'source',
            'track',
            'wbr',
        ];
        if (voidTags.includes(tagName)) {
            return `${indent}<${tagName}${attrs}>\n`;
        }

        // Get children content
        const children = node.childNodes || [];
        const hasOnlyText = children.length === 1 && children[0].nodeType === 3;
        const textContent = hasOnlyText ? children[0].text?.trim() : '';

        // Short inline elements - keep on one line
        if (hasOnlyText && textContent && textContent.length < 40) {
            return `${indent}<${tagName}${attrs}>${textContent}</${tagName}>\n`;
        }

        // Elements with children - format with newlines
        if (children.length > 0) {
            const childContent = children.map((child: any) => this.formatNode(child, depth + 1)).join('');
            return `${indent}<${tagName}${attrs}>\n${childContent}${indent}</${tagName}>\n`;
        }

        // Empty elements
        return `${indent}<${tagName}${attrs}></${tagName}>\n`;
    }

    /**
     * Basic HTML formatting fallback.
     */
    private basicHtmlFormat(html: string): string {
        let formatted = html.replace(/></g, '>\n<').replace(/\/>/g, '/>\n');

        const lines = formatted.split('\n');
        let indent = 0;
        const indentedLines: string[] = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (trimmed.startsWith('</')) {
                indent = Math.max(0, indent - 1);
            }

            indentedLines.push('  '.repeat(indent) + trimmed);

            if (
                trimmed.startsWith('<') &&
                !trimmed.startsWith('</') &&
                !trimmed.startsWith('<!') &&
                !trimmed.endsWith('/>') &&
                !trimmed.includes('</')
            ) {
                indent++;
            }

            if (trimmed.includes('</') && !trimmed.startsWith('</')) {
                indent = Math.max(0, indent - 1);
            }
        }

        return indentedLines.join('\n');
    }

    private getStyles(opts: Required<HtmlReporterOptions>): string {
        return `
:root {
    --bg-primary: #ffffff;
    --bg-secondary: #f5f5f5;
    --text-primary: #212121;
    --text-secondary: #757575;
    --border-color: #e0e0e0;
    --accent-color: #1976d2;
    --success-color: #388e3c;
    --warning-color: #f57c00;
    --error-color: #d32f2f;
    --card-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

[data-theme="dark"] {
    --bg-primary: #121212;
    --bg-secondary: #1e1e1e;
    --text-primary: #e0e0e0;
    --text-secondary: #9e9e9e;
    --border-color: #333333;
    --card-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

html {
    scroll-behavior: smooth;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    background-color: var(--bg-secondary);
    color: var(--text-primary);
    line-height: 1.6;
}

header {
    background: var(--accent-color);
    color: white;
    padding: 2rem;
    margin-bottom: 2rem;
}

.header-content {
    display: flex;
    align-items: center;
    gap: 1rem;
    max-width: 1200px;
    margin: 0 auto;
}

.header-content h1 {
    font-size: 1.75rem;
    font-weight: 600;
}

.page-info {
    margin-top: 0.5rem;
    font-size: 0.9rem;
    opacity: 0.9;
}

.page-info a {
    color: inherit;
}

.meta-info {
    display: flex;
    gap: 2rem;
    max-width: 1200px;
    margin: 1rem auto 0;
    font-size: 0.85rem;
    opacity: 0.8;
}

.logo {
    height: 48px;
    width: auto;
}

main {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1rem 2rem;
}

section {
    background: var(--bg-primary);
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    box-shadow: var(--card-shadow);
}

h2 {
    font-size: 1.25rem;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid var(--border-color);
}

h3 {
    font-size: 1.1rem;
    margin: 1rem 0 0.75rem;
}

h4 {
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin-bottom: 0.25rem;
}

.count {
    font-weight: normal;
    color: var(--text-secondary);
    font-size: 0.9em;
}

/* Summary */
.assessment-badge {
    display: inline-block;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    font-weight: 600;
    font-size: 1.1rem;
    background-color: var(--badge-color);
    color: white;
    margin-bottom: 1rem;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 1rem;
    margin: 1rem 0;
}

.stat-card {
    text-align: center;
    padding: 1rem;
    background: var(--bg-secondary);
    border-radius: 8px;
}

.stat-value {
    display: block;
    font-size: 2rem;
    font-weight: 700;
    color: var(--accent-color);
}

.stat-label {
    font-size: 0.85rem;
    color: var(--text-secondary);
}

.major-concerns {
    margin-top: 1rem;
    padding: 1rem;
    background: #fff3e0;
    border-radius: 4px;
    border-left: 4px solid var(--warning-color);
}

[data-theme="dark"] .major-concerns {
    background: #3e2723;
}

.major-concerns h3 {
    margin-top: 0;
    color: var(--warning-color);
}

.major-concerns ul {
    margin-left: 1.5rem;
}

/* Cards */
.finding-card, .enhancement-card {
    background: var(--bg-secondary);
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1rem;
    border-left: 4px solid var(--accent-color);
}

.finding-header, .enhancement-header {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
}

.badge {
    display: inline-block;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
}

.badge.confidence {
    background-color: var(--badge-color);
    color: white;
}

.badge.classification {
    background-color: var(--accent-color);
    color: white;
}

.badge.rule-link {
    background-color: var(--bg-primary);
    border: 1px solid var(--border-color);
}

.finding-issue {
    font-weight: 500;
    margin-bottom: 0.75rem;
}

.finding-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--border-color);
}

.detail-section {
    margin-bottom: 0.75rem;
}

.evidence-list {
    margin-left: 1.5rem;
}

.evidence-list li {
    margin-bottom: 0.5rem;
}

.evidence-link {
    text-decoration: none;
    margin-right: 0.5rem;
}

.evidence-ref {
    display: inline-block;
    padding: 0.15rem 0.4rem;
    background: var(--accent-color);
    color: white;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    font-family: monospace;
}

.evidence-link:hover .evidence-ref {
    background: var(--text-primary);
}

.evidence-list code {
    background: var(--bg-primary);
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    font-size: 0.85rem;
}

.positions {
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-top: 0.5rem;
}

.human-review {
    font-size: 0.85rem;
    color: var(--warning-color);
    margin-top: 0.75rem;
}

.wcag-badge {
    background: var(--bg-primary);
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    font-size: 0.8rem;
    margin-left: 0.5rem;
}

.tool-badge {
    background: var(--bg-secondary);
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    font-size: 0.75rem;
    margin-left: 0.5rem;
    color: var(--text-secondary);
}

details {
    margin-top: 0.5rem;
}

summary {
    cursor: pointer;
    color: var(--accent-color);
    font-size: 0.85rem;
}

pre {
    background: var(--bg-primary);
    padding: 0.75rem;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 0.8rem;
    margin-top: 0.5rem;
}

/* Debug details */
.debug-details {
    margin-top: 1rem;
    border-top: 1px solid var(--border-color);
    padding-top: 0.75rem;
}

.debug-details summary {
    cursor: pointer;
    font-size: 0.85rem;
    color: var(--text-secondary);
}

.debug-details summary:hover {
    color: var(--accent-color);
}

.debug-json {
    margin-top: 0.5rem;
    padding: 0.75rem;
    background: #f8f8f8;
    border-radius: 4px;
    font-size: 0.7rem;
    overflow-x: auto;
    max-height: 300px;
    overflow-y: auto;
}

[data-theme="dark"] .debug-json {
    background: #1a1a1a;
}

.debug-json code {
    color: var(--text-secondary);
}

/* Limitations */
.limitations {
    background: #e3f2fd;
    border-left: 4px solid var(--accent-color);
}

[data-theme="dark"] .limitations {
    background: #0d47a1;
}

.limitations ul {
    margin-left: 1.5rem;
}

/* Footer */
footer {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary);
    font-size: 0.85rem;
}

/* No items message */
.no-items {
    color: var(--text-secondary);
    font-style: italic;
}

/* Original violation in enhancement */
.original-violation-full {
    background: var(--bg-secondary);
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 1rem;
    border-left: 3px solid var(--accent-color);
}

/* Violations section */
.violations {
    background: var(--bg-primary);
}

.rule-group {
    margin-bottom: 1.5rem;
}

.rule-heading {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-bottom: 0.25rem;
}

.rule-id {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 1rem;
}

.rule-wcag {
    background: var(--bg-secondary);
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: normal;
}

.rule-impact {
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
}

.rule-impact.impact-critical { background: var(--error-color); color: white; }
.rule-impact.impact-serious { background: #e65100; color: white; }
.rule-impact.impact-moderate { background: var(--warning-color); color: white; }
.rule-impact.impact-minor { background: var(--text-secondary); color: white; }

.rule-summary {
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-bottom: 0.75rem;
}

.violation-card {
    background: var(--bg-secondary);
    border-radius: 6px;
    padding: 1rem;
    margin-bottom: 0.75rem;
}

.v-message {
    font-size: 0.9rem;
    margin-bottom: 0;
    line-height: 1.5;
}

/* Details grid layout - cleaner display of source/element info */
.v-details {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.4rem 1rem;
    margin-top: 0.75rem;
    padding: 0.75rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-size: 0.85rem;
}

.v-detail-row {
    display: contents;
}

.v-detail-label {
    color: var(--text-secondary);
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    padding-top: 0.15rem;
    white-space: nowrap;
}

.v-detail-value {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    flex-wrap: wrap;
    min-width: 0;
}

/* Source link - strategy + step index with explicit labels */
.v-source-link {
    display: inline-flex;
    align-items: stretch;
    gap: 0;
    text-decoration: none;
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid var(--border-color);
    transition: border-color 0.15s, box-shadow 0.15s;
}

.v-source-link:hover {
    border-color: var(--accent-color);
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.v-source-part {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.25rem 0.6rem;
}

.v-source-part:first-child {
    background: var(--accent-color);
    color: white;
}

.v-source-part:last-child {
    background: var(--bg-secondary);
    border-left: 1px solid var(--border-color);
}

.v-source-label {
    font-size: 0.6rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.8;
    line-height: 1;
    margin-bottom: 0.15rem;
}

.v-source-part:first-child .v-source-label {
    color: rgba(255,255,255,0.85);
}

.v-source-part:last-child .v-source-label {
    color: var(--text-secondary);
}

.v-source-value {
    font-size: 0.82rem;
    font-weight: 600;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    line-height: 1;
}

.v-source-part:first-child .v-source-value {
    color: white;
}

.v-source-part:last-child .v-source-value {
    color: var(--text-primary);
}

/* Spoken text - the announcement */
.v-spoken-text {
    display: block;
    padding: 0.35rem 0.6rem;
    background: var(--bg-secondary);
    border-radius: 4px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.82rem;
    color: var(--text-primary);
    line-height: 1.4;
    word-break: break-word;
}

.v-empty-speech {
    color: var(--text-secondary);
    font-style: italic;
}

/* Accessibility tree node info */
.v-ax-role {
    display: inline-block;
    padding: 0.15rem 0.45rem;
    background: #e3f2fd;
    color: #1565c0;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
}

[data-theme="dark"] .v-ax-role {
    background: #1a237e;
    color: #90caf9;
}

.v-ax-name {
    color: var(--text-primary);
    font-size: 0.85rem;
}

.v-ax-name.v-empty {
    color: var(--text-secondary);
    font-style: italic;
}

.v-enhancement {
    margin-top: 0.75rem;
    padding: 0.75rem;
    background: rgba(56, 142, 60, 0.08);
    border-radius: 6px;
    border-left: 3px solid var(--success-color);
    font-size: 0.85rem;
}

[data-theme="dark"] .v-enhancement {
    background: rgba(56, 142, 60, 0.12);
}

.v-impact {
    margin-bottom: 0.5rem;
    color: var(--text-primary);
}

.v-remediation {
    color: var(--text-primary);
}

.v-remediation strong {
    color: var(--success-color);
}

/* Attachments Section - Allure/Mochawesome inspired */
.v-header {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
}

.v-header .v-message {
    flex: 1;
}

.v-has-attachment {
    font-size: 0.85rem;
    opacity: 0.6;
}

.v-attachments {
    margin-top: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    overflow: hidden;
}

.v-attachments-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.6rem 0.75rem;
    background: var(--bg-primary);
    border: none;
    cursor: pointer;
    font-size: 0.82rem;
    font-weight: 500;
    color: var(--text-primary);
    transition: background 0.15s;
}

.v-attachments-toggle:hover {
    background: var(--bg-secondary);
}

.v-chevron {
    transition: transform 0.2s ease;
    color: var(--text-secondary);
}

.v-attachments[open] .v-chevron {
    transform: rotate(90deg);
}

.v-attachments-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.25rem;
    height: 1.25rem;
    padding: 0 0.35rem;
    background: var(--accent-color);
    color: white;
    border-radius: 10px;
    font-size: 0.7rem;
    font-weight: 600;
}

.v-attachments-content {
    border-top: 1px solid var(--border-color);
    background: var(--bg-primary);
}

.v-attachment-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--text-secondary);
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
}

.v-attachment-header svg {
    opacity: 0.7;
}

/* Tabs for multiple attachments */
.v-tabs {
    display: flex;
    gap: 0;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
}

.v-tab {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.6rem 1rem;
    font-size: 0.8rem;
    font-weight: 500;
    font-family: inherit;
    color: var(--text-secondary);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: all 0.15s;
}

.v-tab:hover {
    color: var(--text-primary);
    background: rgba(0,0,0,0.03);
}

[data-theme="dark"] .v-tab:hover {
    background: rgba(255,255,255,0.03);
}

.v-tab:focus-visible {
    outline: 2px solid var(--accent-color);
    outline-offset: -2px;
}

.v-tab.is-active {
    color: var(--accent-color);
    border-bottom-color: var(--accent-color);
    background: var(--bg-primary);
}

.v-tab svg {
    opacity: 0.7;
}

.v-tab.is-active svg {
    opacity: 1;
}

.v-tab-panel {
    padding: 0;
}

.v-tab-panel[hidden] {
    display: none;
}

/* Screenshot container - full width display */
.v-screenshot-container {
    position: relative;
    background: #1a1a1a;
    background-image: 
        linear-gradient(45deg, #222 25%, transparent 25%),
        linear-gradient(-45deg, #222 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #222 75%),
        linear-gradient(-45deg, transparent 75%, #222 75%);
    background-size: 16px 16px;
    background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
    min-height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
}

.v-screenshot-full {
    max-width: 100%;
    max-height: 600px;
    height: auto;
    border: 3px solid var(--error-color);
    border-radius: 4px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    cursor: zoom-in;
    transition: transform 0.2s;
}

.v-screenshot-full:hover {
    transform: scale(1.01);
}

.v-screenshot-meta {
    position: absolute;
    bottom: 0.75rem;
    right: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.v-screenshot-size {
    padding: 0.25rem 0.5rem;
    background: rgba(0,0,0,0.7);
    color: #fff;
    font-size: 0.7rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    border-radius: 4px;
}

.v-screenshot-zoom {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: rgba(0,0,0,0.7);
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.15s;
}

.v-screenshot-zoom:hover {
    background: var(--accent-color);
}

.v-screenshot-zoom:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
}

/* HTML container */
.v-html-container {
    padding: 1rem;
    background: var(--bg-secondary);
}

.v-html-container pre {
    margin: 0;
    padding: 1rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-size: 0.78rem;
    line-height: 1.6;
    overflow-x: auto;
    max-height: 400px;
    overflow-y: auto;
}

.v-html-container code {
    color: var(--text-secondary);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.v-html-container .v-selector {
    display: block;
    margin-top: 0.75rem;
    padding: 0.5rem 0.75rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-size: 0.72rem;
    color: var(--text-secondary);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    word-break: break-all;
}

/* Lightbox for full-screen screenshot viewing */
.v-lightbox {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.92);
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.2s, visibility 0.2s;
}

.v-lightbox.is-open {
    opacity: 1;
    visibility: visible;
}

.v-lightbox-content {
    position: relative;
    max-width: 95vw;
    max-height: 95vh;
}

.v-lightbox-img {
    max-width: 95vw;
    max-height: 90vh;
    border: 3px solid var(--error-color);
    border-radius: 6px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
}

.v-lightbox-close {
    position: absolute;
    top: -40px;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: rgba(255,255,255,0.1);
    color: #fff;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    font-size: 1.25rem;
    transition: background 0.15s;
}

.v-lightbox-close:hover {
    background: rgba(255,255,255,0.2);
}

.v-lightbox-close:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
}

.v-lightbox-meta {
    position: absolute;
    bottom: -32px;
    left: 0;
    right: 0;
    text-align: center;
    color: rgba(255,255,255,0.7);
    font-size: 0.8rem;
}

.violation-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
}

.impact-badge {
    background: var(--bg-primary);
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    font-size: 0.75rem;
    color: var(--text-secondary);
}

.violation-message {
    margin: 0.5rem 0;
    font-size: 0.9rem;
}

.violation-selector {
    margin: 0.5rem 0;
    font-size: 0.8rem;
}

.violation-selector code {
    background: var(--bg-primary);
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
}

.violation-html {
    margin: 0.5rem 0 0 0;
    padding: 0.5rem;
    background: var(--bg-primary);
    border-radius: 4px;
    font-size: 0.75rem;
    overflow-x: auto;
}

.violation-html code {
    color: var(--text-secondary);
}

/* Violation screenshot */
.violation-screenshot {
    margin: 1rem 0;
    padding: 0.75rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
}

.violation-screenshot h4 {
    margin-bottom: 0.5rem;
}

.violation-screenshot img {
    max-width: 100%;
    height: auto;
    border: 2px solid var(--error-color);
    border-radius: 4px;
    display: block;
}

.violation-id {
    font-size: 0.85rem;
}

/* Transcript */
.transcript {
    background: var(--bg-primary);
}

.visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
}

/* Controls bar */
.t-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-bottom: 1.25rem;
}

.t-search input {
    min-width: min(260px, 100%);
    padding: 0.4rem 0.65rem;
    font-size: 0.85rem;
    color: var(--text-primary);
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 5px;
    font-family: inherit;
}

.t-search input:focus-visible {
    outline: 2px solid var(--accent-color);
    outline-offset: 1px;
}

.t-chips {
    display: flex;
    gap: 0.3rem;
    flex-wrap: wrap;
}

.t-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35em;
    padding: 0.25rem 0.6rem;
    font-size: 0.78rem;
    font-family: inherit;
    color: var(--text-secondary);
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 999px;
    cursor: pointer;
    white-space: nowrap;
}

.t-chip:hover {
    color: var(--text-primary);
    border-color: var(--text-secondary);
}

.t-chip:focus-visible {
    outline: 2px solid var(--accent-color);
    outline-offset: 1px;
}

.t-chip.is-active {
    color: var(--bg-primary);
    background: var(--text-primary);
    border-color: var(--text-primary);
}

.t-chip-count {
    opacity: 0.55;
    font-variant-numeric: tabular-nums;
    font-size: 0.9em;
}

.t-status {
    margin: 0;
    font-size: 0.82rem;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
}

/* Walk blocks */
.t-body {
    display: flex;
    flex-direction: column;
    gap: 0;
}

.t-walk-block {
    border-top: 1px solid var(--border-color);
}

.t-walk-block[hidden] {
    display: none;
}

.t-walk-header {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    padding: 0.6rem 0;
    cursor: default;
}

.t-walk-name {
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-secondary);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.t-walk-count {
    font-size: 0.72rem;
    color: var(--text-secondary);
    opacity: 0.6;
}

/* Transcript lines */
.t-lines {
    display: flex;
    flex-direction: column;
    padding-bottom: 0.5rem;
}

.t-line {
    display: grid;
    grid-template-columns: 3ch 1fr auto;
    grid-template-rows: auto auto;
    column-gap: 1rem;
    align-items: baseline;
    padding: 0.3rem 0;
    border-radius: 3px;
}

.t-line[hidden] {
    display: none;
}

.t-line:hover {
    background: var(--bg-secondary);
}

.t-line:target {
    background: var(--bg-secondary);
    outline: 1px solid var(--accent-color);
    outline-offset: 2px;
}

/* Cited lines get a left-gutter accent */
.t-line--cited {
    border-left: 2px solid var(--accent-color);
    padding-left: 0.5rem;
    margin-left: -0.5rem;
}

.t-num {
    grid-column: 1;
    grid-row: 1;
    text-align: right;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.72rem;
    color: var(--text-secondary);
    opacity: 0.5;
    user-select: none;
    padding-top: 0.05em;
}

.t-num a {
    color: inherit;
    text-decoration: none;
}

.t-num a:hover,
.t-num a:focus-visible {
    opacity: 1;
    color: var(--accent-color);
}

.t-text {
    grid-column: 2;
    grid-row: 1;
    font-size: 0.9rem;
    line-height: 1.55;
    color: var(--text-primary);
}

.t-actions {
    grid-column: 3;
    grid-row: 1;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    white-space: nowrap;
}

.t-cited {
    font-size: 0.66rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--accent-color);
    border: 1px solid currentColor;
    border-radius: 999px;
    padding: 0.05rem 0.4rem;
    opacity: 0.8;
}

.t-markup-toggle {
    padding: 0.1rem 0.3rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.72rem;
    color: var(--text-secondary);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 3px;
    cursor: pointer;
    opacity: 0.6;
}

.t-markup-toggle:hover {
    opacity: 1;
    border-color: var(--border-color);
}

.t-markup-toggle:focus-visible {
    outline: 2px solid var(--accent-color);
    outline-offset: 1px;
}

.t-markup-toggle[aria-expanded="true"] {
    opacity: 1;
    color: var(--accent-color);
    border-color: var(--border-color);
}

/* Inline markup block */
.t-markup {
    grid-column: 2 / 4;
    grid-row: 2;
    margin-top: 0.35rem;
    margin-bottom: 0.2rem;
}

.t-markup[hidden] {
    display: none;
}

.t-markup pre {
    margin: 0;
    padding: 0.6rem 0.8rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-size: 0.75rem;
    overflow-x: auto;
    line-height: 1.5;
}

.t-markup code {
    color: var(--text-secondary);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}


/* Responsive */
@media (max-width: 768px) {
    header {
        padding: 1rem;
    }
    
    .header-content {
        flex-direction: column;
        text-align: center;
    }
    
    .meta-info {
        flex-direction: column;
        gap: 0.5rem;
    }
    
    .stats-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

${opts.customCss}
`;
    }

    private getScripts(): string {
        return `
<div class="v-lightbox" id="screenshot-lightbox" role="dialog" aria-modal="true" aria-label="Screenshot preview">
    <div class="v-lightbox-content">
        <button type="button" class="v-lightbox-close" aria-label="Close">&times;</button>
        <img class="v-lightbox-img" src="" alt="">
        <div class="v-lightbox-meta"></div>
    </div>
</div>
<script>
(function () {
    // ========== Transcript Filter ==========
    var input = document.getElementById('transcript-filter');
    var status = document.querySelector('.t-status');
    var chips = Array.prototype.slice.call(document.querySelectorAll('.t-chip'));
    var lines = Array.prototype.slice.call(document.querySelectorAll('.t-line'));
    var blocks = Array.prototype.slice.call(document.querySelectorAll('.t-walk-block'));
    var walk = 'all';

    function apply() {
        var query = (input ? input.value : '').trim().toLowerCase();
        var shown = 0;

        lines.forEach(function (line) {
            var text = (line.querySelector('.t-text') || line).textContent.toLowerCase();
            var matchesWalk = walk === 'all' || line.getAttribute('data-walk') === walk;
            var matchesText = query === '' || text.indexOf(query) !== -1;
            var visible = matchesWalk && matchesText;
            line.hidden = !visible;
            if (visible) shown++;
        });

        // Hide entire walk blocks when every line inside them is hidden
        blocks.forEach(function (block) {
            var visibleLines = block.querySelectorAll('.t-line:not([hidden])');
            block.hidden = visibleLines.length === 0;
        });

        var filtering = query !== '' || walk !== 'all';
        if (status) {
            status.textContent = filtering ? shown + (shown === 1 ? ' step' : ' steps') : '';
        }
    }

    function selectWalk(name) {
        walk = name;
        chips.forEach(function (chip) {
            var on = chip.getAttribute('data-walk') === name;
            chip.classList.toggle('is-active', on);
            chip.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        apply();
    }

    if (input) input.addEventListener('input', apply);

    chips.forEach(function (chip) {
        chip.addEventListener('click', function () {
            selectWalk(chip.getAttribute('data-walk'));
        });
    });

    // Markup toggle: expand/collapse inline .t-markup block
    document.querySelectorAll('.t-markup-toggle').forEach(function (toggle) {
        toggle.addEventListener('click', function () {
            var expanded = toggle.getAttribute('aria-expanded') === 'true';
            toggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
            var markup = document.getElementById(toggle.getAttribute('aria-controls'));
            if (markup) markup.hidden = expanded;
        });
    });

    // Evidence links can point at a line that the current filter is hiding — reveal it
    function revealTarget() {
        if (!location.hash) return;
        var target = document.getElementById(location.hash.slice(1));
        if (!target || !target.classList.contains('t-line')) return;
        if (target.hidden) {
            if (input) input.value = '';
            selectWalk('all');
        }
        target.scrollIntoView({ block: 'center' });
    }

    window.addEventListener('hashchange', revealTarget);
    revealTarget();

    // ========== Attachment Tabs ==========
    document.querySelectorAll('.v-tabs').forEach(function (tablist) {
        var tabs = tablist.querySelectorAll('.v-tab');
        
        tabs.forEach(function (tab) {
            tab.addEventListener('click', function () {
                // Deactivate all tabs in this tablist
                tabs.forEach(function (t) {
                    t.classList.remove('is-active');
                    t.setAttribute('aria-selected', 'false');
                    t.setAttribute('tabindex', '-1');
                    var panel = document.getElementById(t.getAttribute('aria-controls'));
                    if (panel) panel.hidden = true;
                });
                
                // Activate clicked tab
                tab.classList.add('is-active');
                tab.setAttribute('aria-selected', 'true');
                tab.removeAttribute('tabindex');
                var panel = document.getElementById(tab.getAttribute('aria-controls'));
                if (panel) panel.hidden = false;
            });
            
            // Keyboard navigation
            tab.addEventListener('keydown', function (e) {
                var index = Array.prototype.indexOf.call(tabs, tab);
                var newIndex = index;
                
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    newIndex = (index + 1) % tabs.length;
                    e.preventDefault();
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    newIndex = (index - 1 + tabs.length) % tabs.length;
                    e.preventDefault();
                } else if (e.key === 'Home') {
                    newIndex = 0;
                    e.preventDefault();
                } else if (e.key === 'End') {
                    newIndex = tabs.length - 1;
                    e.preventDefault();
                }
                
                if (newIndex !== index) {
                    tabs[newIndex].click();
                    tabs[newIndex].focus();
                }
            });
        });
    });

    // ========== Screenshot Lightbox ==========
    var lightbox = document.getElementById('screenshot-lightbox');
    var lightboxImg = lightbox ? lightbox.querySelector('.v-lightbox-img') : null;
    var lightboxMeta = lightbox ? lightbox.querySelector('.v-lightbox-meta') : null;
    var lightboxClose = lightbox ? lightbox.querySelector('.v-lightbox-close') : null;

    function openLightbox(img) {
        if (!lightbox || !lightboxImg) return;
        lightboxImg.src = img.src;
        lightboxImg.alt = img.alt;
        if (lightboxMeta) {
            lightboxMeta.textContent = img.naturalWidth + ' × ' + img.naturalHeight + ' pixels';
        }
        lightbox.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        if (lightboxClose) lightboxClose.focus();
    }

    function closeLightbox() {
        if (!lightbox) return;
        lightbox.classList.remove('is-open');
        document.body.style.overflow = '';
    }

    // Open lightbox on screenshot click
    document.querySelectorAll('.v-screenshot-full').forEach(function (img) {
        img.addEventListener('click', function () {
            openLightbox(img);
        });
    });

    // Open lightbox on zoom button click
    document.querySelectorAll('.v-screenshot-zoom').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var container = btn.closest('.v-screenshot-container');
            var img = container ? container.querySelector('.v-screenshot-full') : null;
            if (img) openLightbox(img);
        });
    });

    // Close lightbox
    if (lightboxClose) {
        lightboxClose.addEventListener('click', closeLightbox);
    }

    if (lightbox) {
        lightbox.addEventListener('click', function (e) {
            if (e.target === lightbox) closeLightbox();
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && lightbox.classList.contains('is-open')) {
                closeLightbox();
            }
        });
    }
})();
</script>`;
    }

    private groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
        const result: Record<string, T[]> = {};
        for (const item of items) {
            const key = keyFn(item);
            if (!result[key]) {
                result[key] = [];
            }
            result[key].push(item);
        }
        return result;
    }
}

export function createHtmlReporter(): HtmlReporter {
    return new HtmlReporter();
}
