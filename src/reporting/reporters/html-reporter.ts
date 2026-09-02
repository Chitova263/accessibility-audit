import { readFile } from 'fs/promises';
import { resolve } from 'path';
import type { Reporter, ReportData, ReportOutput, ReporterOptions } from '../reporter';
import { generateFilename, formatTimestamp, escapeHtml, truncate } from '../reporter';
import type { LlmFinding, LlmViolationEnhancement } from '../../llm/prompt-builder';

export interface HtmlReporterOptions extends ReporterOptions {
    /** Base path for resolving screenshot paths (defaults to cwd) */
    screenshotsBasePath?: string;
}

const DEFAULT_OPTIONS: Required<HtmlReporterOptions> = {
    includeTranscript: true,
    includeHtmlSnippets: true,
    title: 'Accessibility Audit Report',
    screenshotsBasePath: process.cwd(),
};

const IMPACT_COLOR: Record<string, string> = {
    critical: '#d0021b',
    serious: '#e8500a',
    moderate: '#f5a623',
    minor: '#7b8794',
};

const IMPACT_BG: Record<string, string> = {
    critical: '#fff0f0',
    serious: '#fff4ee',
    moderate: '#fffae8',
    minor: '#f4f5f7',
};

const ASSESSMENT_COLOR: Record<string, string> = {
    good: '#0a7c42',
    'needs-review': '#c76b00',
    problematic: '#d0021b',
};

const CONFIDENCE_COLOR: Record<string, string> = {
    high: '#0a7c42',
    medium: '#c76b00',
    low: '#d0021b',
};

function impactColor(impact: string): string {
    return IMPACT_COLOR[impact.toLowerCase()] ?? '#7b8794';
}

function impactBg(impact: string): string {
    return IMPACT_BG[impact.toLowerCase()] ?? '#f4f5f7';
}

function assessmentColor(assessment: string): string {
    return ASSESSMENT_COLOR[assessment.toLowerCase()] ?? '#7b8794';
}

function confidenceColor(confidence: string): string {
    return CONFIDENCE_COLOR[confidence.toLowerCase()] ?? '#7b8794';
}

function pill(text: string, color: string, bg?: string): string {
    const bgStyle = bg ? `background:${bg};` : 'background:rgba(0,0,0,0.06);';
    return `<span class="pill" style="color:${color};${bgStyle}border-color:${color}20">${escapeHtml(text)}</span>`;
}

/**
 * Replaces [strategy:stepIndex:stepId] tokens in prose text with anchor links.
 * Must be used in combination with renderViolationRefs for complete reference rendering.
 */
function renderStepRefsOnly(text: string): string {
    // Token format: [strategy:stepIndex:uuid]
    const TOKEN = /\[([a-z0-9_-]+):(\d+):([0-9a-f-]{36})\]/gi;
    const parts: string[] = [];
    let last = 0;
    let match: RegExpExecArray | null;

    while ((match = TOKEN.exec(text)) !== null) {
        // Escape the plain text before this token
        parts.push(escapeHtml(text.slice(last, match.index)));
        const [, strategy, stepIndex, stepId] = match as unknown as [string, string, string, string];
        parts.push(
            `<a href="#step-${escapeHtml(stepId)}" class="step-ref" title="Jump to ${escapeHtml(strategy)} step ${escapeHtml(stepIndex)}">` +
                `<span class="step-ref__strategy">${escapeHtml(strategy)}</span>` +
                `<span class="step-ref__idx">${escapeHtml(stepIndex)}</span>` +
                `</a>`
        );
        last = match.index + match[0].length;
    }

    // Escape any remaining plain text after the last token
    parts.push(escapeHtml(text.slice(last)));
    return parts.join('');
}

/**
 * Replaces [ruleId:violationId] tokens in prose text with anchor links.
 * The input should already be HTML (e.g., output of renderStepRefsOnly).
 */
function renderViolationRefsOnly(html: string): string {
    // Token format: [ruleId:violationId] where violationId is ruleId + "-" + uuid
    // Examples: [multiple-h1:multiple-h1-da2c0148-7d23-438b-9ed5-2fc3d38671d2]
    //           [focus-trap:focus-trap-7f958390-ff16-4903-93c6-a58e6db7723f]
    // ViolationId format: {ruleId}-{uuid} where uuid is 8-4-4-4-12 hex chars
    // Note: This must NOT match step refs which have format [strategy:number:uuid]
    const TOKEN =
        /\[([a-z][a-z0-9_-]*):([a-z][a-z0-9_-]+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/gi;

    return html.replace(TOKEN, (_match, ruleId: string, violationId: string) => {
        return (
            `<a href="#violation-${escapeHtml(violationId)}" class="violation-ref" title="Jump to ${escapeHtml(ruleId)} violation">` +
            `<span class="violation-ref__rule">${escapeHtml(ruleId)}</span>` +
            `</a>`
        );
    });
}

/**
 * Replaces both [strategy:stepIndex:stepId] and [ruleId:violationId] tokens in prose text
 * with anchor links, then HTML-escapes the remaining text. Must be used instead of plain
 * escapeHtml for any LLM-generated free-text field that may contain references.
 */
function renderStepRefs(text: string): string {
    // First render step refs (which also escapes plain text)
    const withStepRefs = renderStepRefsOnly(text);
    // Then render violation refs on the already-HTML output
    return renderViolationRefsOnly(withStepRefs);
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
    const result: Record<string, T[]> = {};
    for (const item of items) {
        const key = keyFn(item);
        if (!result[key]) result[key] = [];
        result[key].push(item);
    }
    return result;
}

function wcagUrl(criterion: string): string {
    const match = criterion.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!match) return '';
    const [, p, g, sc] = match;
    return `https://www.w3.org/WAI/WCAG21/Understanding/${wcagSlug(p!, g!, sc!)}`;
}

function wcagSlug(p: string, g: string, sc: string): string {
    const slugs: Record<string, string> = {
        // Principle 1: Perceivable
        '1.1.1': 'non-text-content',
        '1.2.1': 'audio-only-and-video-only-prerecorded',
        '1.2.2': 'captions-prerecorded',
        '1.2.3': 'audio-description-or-media-alternative-prerecorded',
        '1.2.4': 'captions-live',
        '1.2.5': 'audio-description-prerecorded',
        '1.2.6': 'sign-language-prerecorded',
        '1.2.7': 'extended-audio-description-prerecorded',
        '1.2.8': 'media-alternative-prerecorded',
        '1.2.9': 'audio-only-live',
        '1.3.1': 'info-and-relationships',
        '1.3.2': 'meaningful-sequence',
        '1.3.3': 'sensory-characteristics',
        '1.3.4': 'orientation',
        '1.3.5': 'identify-input-purpose',
        '1.3.6': 'identify-purpose',
        '1.4.1': 'use-of-color',
        '1.4.2': 'audio-control',
        '1.4.3': 'contrast-minimum',
        '1.4.4': 'resize-text',
        '1.4.5': 'images-of-text',
        '1.4.6': 'contrast-enhanced',
        '1.4.7': 'low-or-no-background-audio',
        '1.4.8': 'visual-presentation',
        '1.4.9': 'images-of-text-no-exception',
        '1.4.10': 'reflow',
        '1.4.11': 'non-text-contrast',
        '1.4.12': 'text-spacing',
        '1.4.13': 'content-on-hover-or-focus',
        // Principle 2: Operable
        '2.1.1': 'keyboard',
        '2.1.2': 'no-keyboard-trap',
        '2.1.3': 'keyboard-no-exception',
        '2.1.4': 'character-key-shortcuts',
        '2.2.1': 'timing-adjustable',
        '2.2.2': 'pause-stop-hide',
        '2.2.3': 'no-timing',
        '2.2.4': 'interruptions',
        '2.2.5': 're-authenticating',
        '2.2.6': 'timeouts',
        '2.3.1': 'three-flashes-or-below-threshold',
        '2.3.2': 'three-flashes',
        '2.3.3': 'animation-from-interactions',
        '2.4.1': 'bypass-blocks',
        '2.4.2': 'page-titled',
        '2.4.3': 'focus-order',
        '2.4.4': 'link-purpose-in-context',
        '2.4.5': 'multiple-ways',
        '2.4.6': 'headings-and-labels',
        '2.4.7': 'focus-visible',
        '2.4.8': 'location',
        '2.4.9': 'link-purpose-link-only',
        '2.4.10': 'section-headings',
        '2.5.1': 'pointer-gestures',
        '2.5.2': 'pointer-cancellation',
        '2.5.3': 'label-in-name',
        '2.5.4': 'motion-actuation',
        '2.5.5': 'target-size',
        '2.5.6': 'concurrent-input-mechanisms',
        // Principle 3: Understandable
        '3.1.1': 'language-of-page',
        '3.1.2': 'language-of-parts',
        '3.1.3': 'unusual-words',
        '3.1.4': 'abbreviations',
        '3.1.5': 'reading-level',
        '3.1.6': 'pronunciation',
        '3.2.1': 'on-focus',
        '3.2.2': 'on-input',
        '3.2.3': 'consistent-navigation',
        '3.2.4': 'consistent-identification',
        '3.2.5': 'change-on-request',
        '3.3.1': 'error-identification',
        '3.3.2': 'labels-or-instructions',
        '3.3.3': 'error-suggestion',
        '3.3.4': 'error-prevention-legal-financial-data',
        '3.3.5': 'help',
        '3.3.6': 'error-prevention-all',
        // Principle 4: Robust
        '4.1.1': 'parsing',
        '4.1.2': 'name-role-value',
        '4.1.3': 'status-messages',
    };
    const key = `${p}.${g}.${sc}`;
    return slugs[key] ?? key;
}

export class HtmlReporter implements Reporter {
    readonly name = 'html';

    async generate(data: ReportData, options?: HtmlReporterOptions): Promise<ReportOutput> {
        const opts = { ...DEFAULT_OPTIONS, ...options };
        const screenshotCache = await this.preloadScreenshots(data, opts.screenshotsBasePath);
        const html = this.buildHtml(data, opts, screenshotCache);

        return {
            format: 'html',
            content: html,
            filename: generateFilename('accessibility-report', 'html'),
            mimeType: 'text/html',
        };
    }

    private async preloadScreenshots(data: ReportData, basePath: string): Promise<Map<string, string>> {
        const cache = new Map<string, string>();

        for (const violation of data.violations) {
            const ctx = violation.context as { screenshot?: { path?: string; error?: string } } | undefined;
            const screenshot = ctx?.screenshot;
            if (!screenshot || !('path' in screenshot) || !screenshot.path) continue;

            try {
                const fullPath = resolve(basePath, screenshot.path);
                const buffer = await readFile(fullPath);
                cache.set(screenshot.path, buffer.toString('base64'));
            } catch {
                // skip unreadable screenshot files
            }
        }

        return cache;
    }

    private buildHtml(
        data: ReportData,
        opts: Required<HtmlReporterOptions>,
        screenshotCache: Map<string, string>
    ): string {
        const { summary } = data.analysis.analysis;
        const aColor = assessmentColor(summary.overallAssessment);
        const impactCounts = this.impactBreakdown(data);

        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(opts.title)}</title>
<style>${this.getStyles()}</style>
</head>
<body>
${this.buildHeader(data, opts, aColor)}
<div class="page">
  <nav class="toc" aria-label="Report sections">
    <ul>
      <li><a href="#summary">Summary</a></li>
      <li><a href="#violations">Violations <span class="toc-count">${data.violations.length}</span></a></li>
      ${data.analysis.analysis.findings.length > 0 ? `<li><a href="#findings">LLM Findings <span class="toc-count">${data.analysis.analysis.findings.length}</span></a></li>` : ''}
      ${opts.includeTranscript && data.transcript && data.transcript.length > 0 ? `<li><a href="#transcript">Transcript</a></li>` : ''}
    </ul>
  </nav>
  <main class="content">
    ${this.buildSummary(data, impactCounts)}
    ${this.buildViolations(data, screenshotCache)}
    ${this.buildFindings(data)}
    ${opts.includeTranscript ? this.buildTranscript(data) : ''}
    ${this.buildLimitations(data)}
  </main>
</div>
<footer class="site-footer">
  <span>NVDA Accessibility Audit Tool</span>
  <span>Report generated ${formatTimestamp(data.meta.timestamp)}</span>
</footer>
${this.getScripts()}
</body>
</html>`;
    }

    private buildHeader(data: ReportData, opts: Required<HtmlReporterOptions>, aColor: string): string {
        const { summary } = data.analysis.analysis;
        const label = summary.overallAssessment.replace(/-/g, ' ');

        return `
<header class="site-header">
  <div class="site-header__inner">
    <div class="site-header__identity">
      <span class="site-header__tool">Accessibility Audit</span>
      <h1 class="site-header__title">${escapeHtml(opts.title)}</h1>
    </div>
    <div class="site-header__verdict" style="--verdict-color:${aColor}" aria-label="Overall assessment: ${escapeHtml(label)}">
      <span class="verdict-label">Assessment</span>
      <strong class="verdict-value">${escapeHtml(label)}</strong>
    </div>
  </div>
</header>`;
    }

    private impactBreakdown(data: ReportData): Record<string, number> {
        const counts: Record<string, number> = { critical: 0, serious: 0, moderate: 0, minor: 0 };
        for (const v of data.violations) {
            const impact = v.rule?.impact?.toLowerCase() ?? 'minor';
            if (impact in counts) {
                counts[impact] = (counts[impact] ?? 0) + 1;
            } else {
                counts['minor'] = (counts['minor'] ?? 0) + 1;
            }
        }
        return counts;
    }

    private buildSummary(data: ReportData, impactCounts: Record<string, number>): string {
        const { summary } = data.analysis.analysis;
        const total = data.violations.length;

        const segments = Object.entries(impactCounts)
            .filter(([, n]) => n > 0)
            .map(([impact, n]) => {
                const pct = total > 0 ? ((n / total) * 100).toFixed(1) : '0';
                const color = impactColor(impact);
                return `<span class="impact-bar__seg" style="width:${pct}%;background:${color}" title="${n} ${impact}"></span>`;
            })
            .join('');

        const impactStats = ['critical', 'serious', 'moderate', 'minor']
            .filter((i) => (impactCounts[i] ?? 0) > 0)
            .map(
                (i) => `
          <div class="impact-stat">
            <span class="impact-stat__dot" style="background:${impactColor(i)}"></span>
            <span class="impact-stat__count">${impactCounts[i] ?? 0}</span>
            <span class="impact-stat__label">${i}</span>
          </div>`
            )
            .join('');

        const concerns =
            summary.majorConcerns.length > 0
                ? `<div class="concerns">
            <h3 class="concerns__heading">Major concerns</h3>
            <ul class="concerns__list">
              ${summary.majorConcerns.map((c) => `<li>${renderStepRefs(c)}</li>`).join('\n')}
            </ul>
          </div>`
                : '';

        return `
<section id="summary" class="section" aria-labelledby="summary-h">
  <h2 id="summary-h" class="section__heading">Summary</h2>

  <div class="summary-grid">
    <div class="summary-card summary-card--stat">
      <span class="big-num">${total}</span>
      <span class="big-num__label">Violations</span>
    </div>
    <div class="summary-card summary-card--stat">
      <span class="big-num">${data.analysis.analysis.findings.length}</span>
      <span class="big-num__label">LLM Findings</span>
    </div>
    <div class="summary-card summary-card--stat">
      <span class="big-num">${summary.stepsToMainContent ?? '—'}</span>
      <span class="big-num__label">Steps to Main</span>
    </div>
    <div class="summary-card summary-card--stat">
      <span class="big-num">${summary.totalSteps}</span>
      <span class="big-num__label">Steps Analyzed</span>
    </div>
  </div>

  ${
      total > 0
          ? `<div class="impact-breakdown">
      <div class="impact-bar" role="img" aria-label="Violations by impact">${segments || '<span class="impact-bar__seg" style="width:100%;background:#e0e0e0"></span>'}</div>
      <div class="impact-stats">${impactStats}</div>
    </div>`
          : ''
  }

  ${concerns}
</section>`;
    }

    private buildViolations(data: ReportData, screenshotCache: Map<string, string>): string {
        const { violations } = data;

        if (violations.length === 0) {
            return `
<section id="violations" class="section" aria-labelledby="violations-h">
  <h2 id="violations-h" class="section__heading">Violations</h2>
  <p class="empty-msg">No violations detected.</p>
</section>`;
        }

        const enhancementMap = new Map(data.analysis.enhancements.map((e) => [e.violationId, e]));

        const byImpact: Record<string, typeof violations> = { critical: [], serious: [], moderate: [], minor: [] };
        for (const v of violations) {
            const impact = v.rule?.impact?.toLowerCase() ?? 'minor';
            if (!(impact in byImpact)) byImpact[impact] = [];
            (byImpact[impact] ?? (byImpact[impact] = [])).push(v);
        }

        const impactSections = Object.entries(byImpact)
            .filter(([, items]) => items.length > 0)
            .map(([impact, items]) => {
                const color = impactColor(impact);
                const bg = impactBg(impact);
                const byRule = groupBy(items, (v) => v.rule.id);

                const ruleBlocks = Object.entries(byRule)
                    .map(([ruleId, ruleItems]) => {
                        const first = ruleItems[0];
                        if (!first) return '';
                        const wcag = first.rule.wcag?.primary?.criterion ?? '';
                        const cards = ruleItems
                            .map((v) => this.buildViolationRow(v, enhancementMap.get(v.id), screenshotCache))
                            .join('\n');

                        return `
          <div class="rule-block">
            <div class="rule-block__header">
              <code class="rule-id">${escapeHtml(ruleId)}</code>
              ${wcag ? `<a class="wcag-tag" href="${wcagUrl(wcag)}" target="_blank" rel="noopener">WCAG ${escapeHtml(wcag)}</a>` : ''}
              <span class="rule-count">${ruleItems.length}</span>
              <span class="rule-summary">${escapeHtml(first.rule.summary ?? '')}</span>
            </div>
            <div class="rule-block__items">
${cards}
            </div>
          </div>`;
                    })
                    .join('\n');

                return `
        <div class="impact-group" style="--impact-color:${color};--impact-bg:${bg}">
          <h3 class="impact-group__heading">
            <span class="impact-dot" style="background:${color}"></span>
            ${impact.charAt(0).toUpperCase() + impact.slice(1)}
            <span class="impact-group__count">${items.length}</span>
          </h3>
${ruleBlocks}
        </div>`;
            })
            .join('\n');

        return `
<section id="violations" class="section" aria-labelledby="violations-h">
  <h2 id="violations-h" class="section__heading">
    Violations
    <span class="section__count">${violations.length}</span>
  </h2>
${impactSections}
</section>`;
    }

    private buildViolationRow(
        violation: ReportData['violations'][0],
        enhancement: LlmViolationEnhancement | undefined,
        screenshotCache: Map<string, string>
    ): string {
        const ctx = violation.context as
            | {
                  source?: { strategy: string; stepIndex: number; stepId: string; spokenPhrase: string };
                  axNode?: { role?: string; name?: string };
                  screenshot?: { path?: string; error?: string; width?: number; height?: number };
              }
            | undefined;

        const source = ctx?.source;
        const axNode = ctx?.axNode;
        const screenshot = ctx?.screenshot;

        const hasScreenshot =
            !!screenshot && 'path' in screenshot && !!screenshot.path && screenshotCache.has(screenshot.path);
        const hasHtml = !!violation.element?.htmlSnippet;

        let attachments = '';

        if (hasScreenshot && screenshot.path) {
            const b64 = screenshotCache.get(screenshot.path);
            if (b64) {
                const meta = hasHtml
                    ? `<div class="v-tabs" role="tablist" aria-label="Attachments">
                    <button type="button" class="v-tab is-active" role="tab"
                        aria-selected="true"
                        id="stab-${escapeHtml(violation.id)}"
                        aria-controls="spanel-${escapeHtml(violation.id)}">Screenshot</button>
                    <button type="button" class="v-tab" role="tab"
                        aria-selected="false" tabindex="-1"
                        id="htab-${escapeHtml(violation.id)}"
                        aria-controls="hpanel-${escapeHtml(violation.id)}">HTML</button>
                  </div>`
                    : '';

                const screenshotPanel = `
                <div class="v-panel" id="spanel-${escapeHtml(violation.id)}" role="tabpanel" aria-labelledby="stab-${escapeHtml(violation.id)}">
                  <div class="screenshot-wrap">
                    <img src="data:image/png;base64,${b64}"
                         alt="Highlighted element showing the violation"
                         loading="lazy" class="screenshot-img">
                    <div class="screenshot-controls">
                      <span class="screenshot-size">${screenshot.width ?? '?'}×${screenshot.height ?? '?'}</span>
                      <button type="button" class="btn-zoom" aria-label="Open full size" title="Full size">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                      </button>
                    </div>
                  </div>
                </div>`;

                const htmlPanel = hasHtml
                    ? `<div class="v-panel" id="hpanel-${escapeHtml(violation.id)}" role="tabpanel" aria-labelledby="htab-${escapeHtml(violation.id)}" hidden>
                  <div class="html-wrap">
                    <pre><code>${escapeHtml(truncate(violation.element!.htmlSnippet!, 800))}</code></pre>
                    ${violation.element?.selector ? `<span class="selector-tag">${escapeHtml(violation.element.selector)}</span>` : ''}
                  </div>
                </div>`
                    : '';

                attachments = `<details class="v-attachments">
              <summary class="v-attach-toggle">
                <svg class="chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M9 18l6-6-6-6"/></svg>
                Attachments
              </summary>
              <div class="v-attach-body">
                ${meta}${screenshotPanel}${htmlPanel}
              </div>
            </details>`;
            }
        } else if (hasHtml) {
            attachments = `<details class="v-attachments">
            <summary class="v-attach-toggle">
              <svg class="chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M9 18l6-6-6-6"/></svg>
              HTML Snippet
            </summary>
            <div class="v-attach-body">
              <div class="html-wrap">
                <pre><code>${escapeHtml(truncate(violation.element!.htmlSnippet!, 800))}</code></pre>
                ${violation.element?.selector ? `<span class="selector-tag">${escapeHtml(violation.element.selector)}</span>` : ''}
              </div>
            </div>
          </details>`;
        }

        const sourceChip = source
            ? `<a href="#step-${escapeHtml(source.stepId)}" class="source-chip" title="Jump to transcript step">
              <span class="source-chip__strategy">${escapeHtml(source.strategy)}</span><span class="source-chip__step">#${source.stepIndex}</span>
            </a>`
            : '';

        const spokenText = source
            ? `<span class="spoken-text">${escapeHtml(source.spokenPhrase) || '<em>(silent)</em>'}</span>`
            : '';

        const axBadge = axNode?.role
            ? `<code class="ax-role">${escapeHtml(axNode.role)}</code>${axNode.name ? ` <span class="ax-name">"${escapeHtml(truncate(axNode.name, 60))}"</span>` : ''}`
            : '';

        const enhancementBlock = enhancement
            ? `<div class="enhancement">
              ${enhancement.userImpactDescription ? `<p><strong>Impact:</strong> ${renderStepRefs(enhancement.userImpactDescription)}</p>` : ''}
              ${enhancement.remediationSuggestion ? `<p><strong>Fix:</strong> ${renderStepRefs(enhancement.remediationSuggestion)}</p>` : ''}
            </div>`
            : '';

        return `
      <div class="v-row" id="violation-${escapeHtml(violation.id)}">
        <p class="v-message">${escapeHtml(violation.message)}</p>
        <div class="v-meta">
          ${sourceChip}
          ${spokenText}
          ${axBadge}
        </div>
        ${enhancementBlock}
        ${attachments}
      </div>`;
    }

    private buildFindings(data: ReportData): string {
        const { findings } = data.analysis.analysis;

        if (findings.length === 0) {
            return `
<section id="findings" class="section" aria-labelledby="findings-h">
  <h2 id="findings-h" class="section__heading">LLM Findings</h2>
  <p class="empty-msg">No additional findings from LLM analysis.</p>
</section>`;
        }

        // Build a map from ruleId to first violation ID for linking relatedRuleId
        const ruleToViolationId = new Map<string, string>();
        for (const v of data.violations) {
            const ruleId = v.rule?.id;
            if (ruleId && !ruleToViolationId.has(ruleId)) {
                ruleToViolationId.set(ruleId, v.id);
            }
        }

        const byCategory = groupBy(findings, (f) => f.category);

        const categoryBlocks = Object.entries(byCategory)
            .map(([category, items]) => {
                const cards = items.map((f) => this.buildFindingCard(f, ruleToViolationId)).join('\n');
                return `
      <div class="category-group">
        <h3 class="category-heading">${escapeHtml(category.replace(/-/g, ' '))} <span class="section__count">${items.length}</span></h3>
        ${cards}
      </div>`;
            })
            .join('\n');

        return `
<section id="findings" class="section" aria-labelledby="findings-h">
  <h2 id="findings-h" class="section__heading">
    LLM Findings
    <span class="section__count">${findings.length}</span>
  </h2>
  ${categoryBlocks}
</section>`;
    }

    private buildFindingCard(finding: LlmFinding, ruleToViolationId: Map<string, string>): string {
        const cColor = confidenceColor(finding.confidence);
        const needsReview = finding.requiresHumanReview ? `<span class="review-flag">⚠ Needs review</span>` : '';

        const classificationPill = finding.classification
            ? pill(finding.classification.replace(/-/g, ' '), '#4a5568')
            : '';

        // Make relatedRuleId a clickable link if we have a matching violation
        let relatedRulePill = '';
        if (finding.relatedRuleId) {
            const violationId = ruleToViolationId.get(finding.relatedRuleId);
            if (violationId) {
                relatedRulePill = `<a href="#violation-${escapeHtml(violationId)}" class="violation-ref" title="Jump to ${escapeHtml(finding.relatedRuleId)} violation"><span class="violation-ref__rule">${escapeHtml(finding.relatedRuleId)}</span></a>`;
            } else {
                relatedRulePill = pill(finding.relatedRuleId, '#4a5568');
            }
        }

        const evidenceBlock = this.buildEvidenceBlock(finding);

        return `
    <article class="finding-card">
      <div class="finding-card__top">
        <p class="finding-issue">${renderStepRefs(finding.issue)}</p>
        <div class="finding-pills">
          ${pill(finding.confidence, cColor)}
          ${classificationPill}
          ${relatedRulePill}
          ${needsReview}
        </div>
      </div>

      <div class="finding-body">
        <div class="finding-section">
          <h4>Impact</h4>
          <p>${renderStepRefs(finding.impact)}</p>
        </div>

        <div class="finding-section">
          <h4>Evidence</h4>
          ${evidenceBlock}
        </div>

        ${
            finding.stepsToReproduce && finding.stepsToReproduce.length > 0
                ? `<div class="finding-section">
          <h4>Steps to Reproduce</h4>
          <ol class="steps-to-reproduce">
            ${finding.stepsToReproduce.map((step) => `<li>${renderStepRefs(step)}</li>`).join('\n            ')}
          </ol>
        </div>`
                : ''
        }

        ${
            finding.semanticJustification
                ? `<div class="finding-section">
          <h4>Justification</h4>
          <p>${renderStepRefs(finding.semanticJustification)}</p>
        </div>`
                : ''
        }
      </div>
    </article>`;
    }

    private buildEvidenceBlock(finding: LlmFinding): string {
        const { steps, pattern } = finding.evidence;

        const patternCaption = pattern ? `<p class="evidence-excerpt__pattern">${renderStepRefs(pattern)}</p>` : '';

        // Single step — inline row, no surrounding box
        if (steps.length === 1) {
            const s = steps[0]!;
            return `
          <div class="evidence-inline">
            <a href="#step-${escapeHtml(s.identifier)}" class="evidence-badge" title="Jump to transcript step">
              <span class="evidence-badge__strategy">${escapeHtml(s.strategy)}</span><span class="evidence-badge__idx">${s.stepIndex}</span>
            </a>
            <span class="evidence-inline__spoken">"${escapeHtml(s.spokenPhrase)}"</span>
          </div>
          ${patternCaption}`;
        }

        // Multiple steps — mini transcript excerpt block
        const rows = steps
            .map(
                (s) => `
            <div class="evidence-excerpt__row">
              <span class="evidence-excerpt__num">${s.stepIndex}</span>
              <span class="evidence-excerpt__spoken">"${escapeHtml(s.spokenPhrase)}"</span>
              <a href="#step-${escapeHtml(s.identifier)}" class="evidence-badge evidence-badge--sm" title="Jump to transcript step">
                <span class="evidence-badge__strategy">${escapeHtml(s.strategy)}</span>
              </a>
            </div>`
            )
            .join('\n');

        return `
          <div class="evidence-excerpt">
            <div class="evidence-excerpt__rail">
              ${rows}
            </div>
            ${patternCaption}
          </div>`;
    }

    private buildTranscript(data: ReportData): string {
        if (!data.transcript || data.transcript.length === 0) {
            return `
<section id="transcript" class="section" aria-labelledby="transcript-h">
  <h2 id="transcript-h" class="section__heading">Screen Reader Transcript</h2>
  <p class="empty-msg">No transcript data available.</p>
</section>`;
        }

        const strategies = data.transcript.filter((s) => s.navigationSteps.length > 0);
        const totalSteps = strategies.reduce((sum, s) => sum + s.navigationSteps.length, 0);
        const cited = this.citedStepIds(data);

        const chips = strategies
            .map(
                (s) =>
                    `<button type="button" class="t-chip" data-walk="${escapeHtml(s.meta.name)}" aria-pressed="false">${escapeHtml(s.meta.name)}<span class="t-chip__count">${s.navigationSteps.length}</span></button>`
            )
            .join('');

        const blocks = strategies
            .map((s) => {
                const rows = s.navigationSteps
                    .map((step) => this.buildTranscriptRow(step, s.meta.name, cited))
                    .join('\n');

                return `
      <div class="t-walk" data-walk="${escapeHtml(s.meta.name)}">
        <div class="t-walk__header">
          <span class="t-walk__name">${escapeHtml(s.meta.name)}</span>
          <span class="t-walk__count">${s.navigationSteps.length}</span>
        </div>
        <div class="t-rows">${rows}</div>
      </div>`;
            })
            .join('\n');

        return `
<section id="transcript" class="section" aria-labelledby="transcript-h">
  <h2 id="transcript-h" class="section__heading">
    Screen Reader Transcript
    <span class="section__count">${totalSteps} steps</span>
  </h2>

  <div class="t-controls">
    <label class="t-search" for="t-filter">
      <span class="sr-only">Filter announcements</span>
      <input type="search" id="t-filter" placeholder="Filter…" autocomplete="off">
    </label>
    <div class="t-chips" role="group" aria-label="Filter by strategy">
      <button type="button" class="t-chip is-active" data-walk="all" aria-pressed="true">All</button>
      ${chips}
    </div>
    <p class="t-status" role="status" aria-live="polite"></p>
  </div>

  <div class="t-body">${blocks}</div>
</section>`;
    }

    private citedStepIds(data: ReportData): Set<string> {
        const ids = new Set<string>();
        for (const finding of data.analysis.analysis.findings) {
            for (const step of finding.evidence.steps) ids.add(step.identifier);
        }
        return ids;
    }

    private buildTranscriptRow(
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
        const lineId = `step-${escapeHtml(step.identifier)}`;
        const markupId = `markup-${escapeHtml(step.identifier)}`;

        const citedBadge = isCited ? `<span class="t-cited" title="Cited as evidence">cited</span>` : '';

        const markupToggle = step.htmlSnippet
            ? `<button type="button" class="t-markup-btn" aria-expanded="false" aria-controls="${markupId}" title="Show HTML">&lt;/&gt;</button>`
            : '';

        const markupBlock = step.htmlSnippet
            ? `<div class="t-markup" id="${markupId}" hidden><pre><code>${escapeHtml(this.truncateHtml(step.htmlSnippet, 600))}</code></pre></div>`
            : '';

        return `
<div class="t-row${isCited ? ' t-row--cited' : ''}" id="${lineId}" data-walk="${escapeHtml(walk)}">
  <span class="t-num"><a href="#${lineId}" tabindex="-1" aria-label="Step ${step.index}">${step.index}</a></span>
  <span class="t-text">${escapeHtml(spoken)}</span>
  <span class="t-actions">${citedBadge}${markupToggle}</span>
  ${markupBlock}
</div>`;
    }

    private truncateHtml(html: string, max: number): string {
        return html.length > max ? html.slice(0, max) + '…' : html;
    }

    private buildLimitations(data: ReportData): string {
        const { limitations } = data.analysis.analysis;
        if (limitations.length === 0) return '';

        return `
<section class="section section--muted" aria-labelledby="limits-h">
  <h2 id="limits-h" class="section__heading">Analysis Limitations</h2>
  <p>These aspects could not be determined from the transcript alone:</p>
  <ul class="limitations-list">
    ${limitations.map((l) => `<li>${renderStepRefs(l)}</li>`).join('\n')}
  </ul>
</section>`;
    }

    private getStyles(): string {
        return `
/* ── Reset & base ── */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;font-size:16px}
body{
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  font-size:.9375rem;
  line-height:1.6;
  color:#1a1a2e;
  background:#f0f2f5;
}
a{color:#1452cc}
a:hover{color:#0e3fa0}
a:focus-visible{outline:2px solid #1452cc;outline-offset:2px;border-radius:2px}
code,pre{font-family:ui-monospace,'Cascadia Code','Fira Code',monospace}

/* ── Site header ── */
.site-header{
  background:#1a1a2e;
  color:#fff;
  padding:1.25rem 2rem;
}
.site-header__inner{
  max-width:1100px;
  margin:0 auto;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:1.5rem;
  flex-wrap:wrap;
}
.site-header__tool{
  font-size:.72rem;
  font-weight:600;
  letter-spacing:.1em;
  text-transform:uppercase;
  color:rgba(255,255,255,.5);
  display:block;
  margin-bottom:.25rem;
}
.site-header__title{
  font-size:1.35rem;
  font-weight:700;
  line-height:1.2;
  color:#fff;
}
.site-header__url{
  display:block;
  font-size:.82rem;
  color:rgba(255,255,255,.6);
  margin-top:.3rem;
  word-break:break-all;
  text-decoration:none;
}
.site-header__url:hover{color:rgba(255,255,255,.9)}
.site-header__verdict{
  text-align:right;
  flex-shrink:0;
  border-left:3px solid var(--verdict-color);
  padding:.5rem 0 .5rem 1rem;
}
.verdict-label{
  display:block;
  font-size:.68rem;
  letter-spacing:.08em;
  text-transform:uppercase;
  color:rgba(255,255,255,.5);
  margin-bottom:.2rem;
}
.verdict-value{
  display:block;
  font-size:1.1rem;
  font-weight:700;
  color:var(--verdict-color);
  text-transform:capitalize;
}

/* ── Layout ── */
.page{
  max-width:1100px;
  margin:2rem auto;
  padding:0 1.25rem;
  display:grid;
  grid-template-columns:180px 1fr;
  gap:2rem;
  align-items:start;
}
.toc{
  position:sticky;
  top:1.5rem;
  background:#fff;
  border:1px solid #dee2e6;
  border-radius:6px;
  padding:1rem;
}
.toc ul{list-style:none;display:flex;flex-direction:column;gap:.25rem}
.toc a{
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding:.35rem .5rem;
  border-radius:4px;
  font-size:.84rem;
  color:#444;
  text-decoration:none;
  transition:background .1s,color .1s;
}
.toc a:hover{background:#f0f2f5;color:#1452cc}
.toc-count{
  font-size:.72rem;
  background:#e2e8f0;
  color:#555;
  border-radius:999px;
  padding:.05rem .45rem;
  font-variant-numeric:tabular-nums;
}
.content{min-width:0}

/* ── Section base ── */
.section{
  background:#fff;
  border:1px solid #dee2e6;
  border-radius:6px;
  padding:1.5rem;
  margin-bottom:1.5rem;
}
.section--muted{background:#f8f9fa}
.section__heading{
  font-size:1.1rem;
  font-weight:700;
  color:#1a1a2e;
  display:flex;
  align-items:center;
  gap:.6rem;
  margin-bottom:1.25rem;
  padding-bottom:.75rem;
  border-bottom:2px solid #e2e8f0;
}
.section__count{
  font-size:.78rem;
  font-weight:600;
  background:#e2e8f0;
  color:#555;
  border-radius:999px;
  padding:.1rem .5rem;
  font-variant-numeric:tabular-nums;
}
.empty-msg{color:#6b7280;font-style:italic}

/* ── Summary ── */
.summary-grid{
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:1rem;
  margin-bottom:1.5rem;
}
.summary-card{
  background:#f8f9fa;
  border:1px solid #e2e8f0;
  border-radius:6px;
  padding:1rem;
  text-align:center;
}
.big-num{
  display:block;
  font-size:2.2rem;
  font-weight:800;
  color:#1a1a2e;
  line-height:1;
}
.big-num__label{
  display:block;
  font-size:.75rem;
  color:#6b7280;
  margin-top:.35rem;
  text-transform:uppercase;
  letter-spacing:.05em;
}

/* Impact bar */
.impact-breakdown{margin-bottom:1.25rem}
.impact-bar{
  display:flex;
  height:8px;
  border-radius:4px;
  overflow:hidden;
  background:#e2e8f0;
  margin-bottom:.75rem;
}
.impact-bar__seg{height:100%;transition:width .3s}
.impact-stats{display:flex;gap:1.5rem;flex-wrap:wrap}
.impact-stat{display:flex;align-items:center;gap:.4rem}
.impact-stat__dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.impact-stat__count{font-size:.9rem;font-weight:700;font-variant-numeric:tabular-nums}
.impact-stat__label{font-size:.8rem;color:#6b7280;text-transform:capitalize}

/* Major concerns */
.concerns{
  background:#fffbeb;
  border:1px solid #fbbf24;
  border-left:4px solid #f59e0b;
  border-radius:6px;
  padding:1rem 1.25rem;
}
.concerns__heading{
  font-size:.85rem;
  font-weight:700;
  text-transform:uppercase;
  letter-spacing:.06em;
  color:#92400e;
  margin-bottom:.6rem;
}
.concerns__list{
  margin-left:1.25rem;
  color:#78350f;
  font-size:.9rem;
  display:flex;
  flex-direction:column;
  gap:.3rem;
}

/* ── Violations ── */
.impact-group{
  margin-bottom:1.5rem;
  padding-bottom:1.5rem;
  border-bottom:1px solid #e2e8f0;
}
.impact-group:last-child{border-bottom:none;margin-bottom:0;padding-bottom:0}
.impact-group__heading{
  display:flex;
  align-items:center;
  gap:.5rem;
  font-size:.92rem;
  font-weight:700;
  text-transform:uppercase;
  letter-spacing:.08em;
  color:var(--impact-color);
  margin-bottom:1rem;
}
.impact-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.impact-group__count{
  font-size:.72rem;
  background:var(--impact-bg);
  color:var(--impact-color);
  border:1px solid var(--impact-color);
  border-radius:999px;
  padding:.05rem .5rem;
  font-variant-numeric:tabular-nums;
  font-weight:600;
}

/* Rule block */
.rule-block{
  margin-bottom:1rem;
  border:1px solid #e2e8f0;
  border-top:2px solid var(--impact-color);
  border-radius:0 0 6px 6px;
}
.rule-block__header{
  display:flex;
  align-items:center;
  flex-wrap:wrap;
  gap:.5rem;
  padding:.6rem .9rem;
  background:#f8f9fa;
  font-size:.82rem;
}
.rule-id{
  font-size:.82rem;
  font-weight:700;
  color:#1a1a2e;
  background:#e2e8f0;
  border-radius:3px;
  padding:.1rem .4rem;
}
.wcag-tag{
  font-size:.72rem;
  font-weight:600;
  color:#1452cc;
  background:#edf2f7;
  border:1px solid #cbd5e0;
  border-radius:3px;
  padding:.1rem .4rem;
  text-decoration:none;
  transition:background .1s,border-color .1s;
}
.wcag-tag:hover{background:#dbeafe;border-color:#1452cc}
.rule-count{
  font-size:.72rem;
  font-weight:600;
  background:var(--impact-bg);
  color:var(--impact-color);
  border:1px solid var(--impact-color);
  border-radius:999px;
  padding:.05rem .45rem;
}
.rule-summary{color:#6b7280;flex:1;min-width:0}
.rule-block__items{padding:.25rem 0}

/* Violation row */
.v-row{
  padding:.75rem .9rem;
  border-bottom:1px solid #f0f2f5;
  font-size:.875rem;
}
.v-row:last-child{border-bottom:none}
.v-row:hover{background:#fafbfc}
.v-message{
  font-weight:500;
  color:#1a1a2e;
  line-height:1.45;
  margin-bottom:.5rem;
}
.v-meta{
  display:flex;
  align-items:center;
  flex-wrap:wrap;
  gap:.5rem;
  margin-bottom:.5rem;
  font-size:.8rem;
}

/* Source chip — links to transcript */
.source-chip{
  display:inline-flex;
  align-items:stretch;
  border-radius:4px;
  overflow:hidden;
  border:1px solid #cbd5e0;
  text-decoration:none;
  font-size:.75rem;
  font-family:ui-monospace,monospace;
}
.source-chip:hover{border-color:#1452cc;box-shadow:0 1px 4px rgba(0,0,0,.1)}
.source-chip__strategy{
  background:#1452cc;
  color:#fff;
  padding:.15rem .5rem;
  font-weight:600;
}
.source-chip__step{
  background:#edf2f7;
  color:#4a5568;
  padding:.15rem .45rem;
}

/* Spoken text */
.spoken-text{
  font-family:ui-monospace,monospace;
  font-size:.78rem;
  background:#f0f2f5;
  border-radius:3px;
  padding:.15rem .4rem;
  color:#374151;
  max-width:400px;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}

/* AX node */
.ax-role{
  font-size:.75rem;
  background:#dbeafe;
  color:#1e40af;
  border-radius:3px;
  padding:.1rem .4rem;
}
.ax-name{font-size:.8rem;color:#6b7280}

/* Enhancement */
.enhancement{
  margin:.5rem 0;
  padding:.6rem .75rem;
  background:#f0fdf4;
  border-left:3px solid #16a34a;
  border-radius:0 4px 4px 0;
  font-size:.82rem;
  color:#1a2e1a;
  display:flex;
  flex-direction:column;
  gap:.3rem;
}
.enhancement strong{color:#15803d}

/* Attachments */
.v-attachments{margin-top:.5rem;border:1px solid #e2e8f0;border-radius:4px;overflow:hidden}
.v-attach-toggle{
  display:flex;
  align-items:center;
  gap:.4rem;
  width:100%;
  padding:.45rem .7rem;
  font-size:.78rem;
  font-weight:500;
  color:#4a5568;
  background:#f8f9fa;
  border:none;
  cursor:pointer;
  list-style:none;
}
.v-attachments[open] .chevron{transform:rotate(90deg)}
.chevron{transition:transform .15s;flex-shrink:0}
.v-attach-body{border-top:1px solid #e2e8f0}

/* Tabs */
.v-tabs{
  display:flex;
  background:#f8f9fa;
  border-bottom:1px solid #e2e8f0;
}
.v-tab{
  display:inline-flex;
  align-items:center;
  padding:.45rem .9rem;
  font-size:.78rem;
  font-weight:500;
  font-family:inherit;
  color:#6b7280;
  background:transparent;
  border:none;
  border-bottom:2px solid transparent;
  cursor:pointer;
  transition:all .12s;
}
.v-tab:hover{color:#1a1a2e}
.v-tab:focus-visible{outline:2px solid #1452cc;outline-offset:-2px}
.v-tab.is-active{color:#1452cc;border-bottom-color:#1452cc;background:#fff}
.v-panel[hidden]{display:none}

/* Screenshot */
.screenshot-wrap{
  position:relative;
  background:#111;
  background-image:linear-gradient(45deg,#1a1a1a 25%,transparent 25%),
    linear-gradient(-45deg,#1a1a1a 25%,transparent 25%),
    linear-gradient(45deg,transparent 75%,#1a1a1a 75%),
    linear-gradient(-45deg,transparent 75%,#1a1a1a 75%);
  background-size:14px 14px;
  background-position:0 0,0 7px,7px -7px,-7px 0;
  display:flex;
  align-items:center;
  justify-content:center;
  min-height:180px;
  padding:1rem;
}
.screenshot-img{
  max-width:100%;
  max-height:560px;
  border:2px solid #d0021b;
  border-radius:3px;
  box-shadow:0 4px 20px rgba(0,0,0,.4);
  cursor:zoom-in;
  transition:transform .15s;
}
.screenshot-img:hover{transform:scale(1.005)}
.screenshot-controls{
  position:absolute;
  bottom:.6rem;
  right:.6rem;
  display:flex;
  align-items:center;
  gap:.35rem;
}
.screenshot-size{
  font-family:ui-monospace,monospace;
  font-size:.68rem;
  background:rgba(0,0,0,.7);
  color:#fff;
  border-radius:3px;
  padding:.2rem .4rem;
}
.btn-zoom{
  display:flex;
  align-items:center;
  justify-content:center;
  width:26px;
  height:26px;
  background:rgba(0,0,0,.7);
  color:#fff;
  border:none;
  border-radius:3px;
  cursor:pointer;
  transition:background .12s;
}
.btn-zoom:hover{background:#1452cc}
.btn-zoom:focus-visible{outline:2px solid #fff;outline-offset:2px}

/* HTML snippet panel */
.html-wrap{padding:.75rem}
.html-wrap pre{
  margin:0;
  padding:.75rem;
  background:#1a1a2e;
  border-radius:4px;
  font-size:.75rem;
  line-height:1.55;
  overflow-x:auto;
  max-height:360px;
  overflow-y:auto;
}
.html-wrap code{color:#a8b2d8}
.selector-tag{
  display:block;
  margin-top:.5rem;
  font-family:ui-monospace,monospace;
  font-size:.7rem;
  color:#6b7280;
  word-break:break-all;
}

/* Lightbox */
.lightbox{
  position:fixed;inset:0;z-index:9999;
  display:flex;align-items:center;justify-content:center;
  background:rgba(0,0,0,.9);
  opacity:0;visibility:hidden;
  transition:opacity .15s,visibility .15s;
}
.lightbox.is-open{opacity:1;visibility:visible}
.lightbox__content{position:relative;max-width:95vw;max-height:95vh}
.lightbox__img{
  max-width:95vw;max-height:88vh;
  border:2px solid #d0021b;
  border-radius:4px;
  box-shadow:0 16px 48px rgba(0,0,0,.5);
}
.lightbox__close{
  position:absolute;top:-38px;right:0;
  display:flex;align-items:center;justify-content:center;
  width:32px;height:32px;
  background:rgba(255,255,255,.12);
  color:#fff;border:none;border-radius:50%;
  cursor:pointer;font-size:1.2rem;
  transition:background .12s;
}
.lightbox__close:hover{background:rgba(255,255,255,.25)}
.lightbox__close:focus-visible{outline:2px solid #fff;outline-offset:2px}
.lightbox__meta{
  position:absolute;bottom:-28px;left:0;right:0;
  text-align:center;font-size:.75rem;
  color:rgba(255,255,255,.6);
}

/* ── Findings ── */
.category-group{margin-bottom:1.25rem}
.category-group:last-child{margin-bottom:0}
.category-heading{
  font-size:.78rem;
  font-weight:700;
  text-transform:uppercase;
  letter-spacing:.1em;
  color:#6b7280;
  margin-bottom:.75rem;
  display:flex;
  align-items:center;
  gap:.5rem;
}
.finding-card{
  border:1px solid #e2e8f0;
  border-radius:6px;
  overflow:hidden;
  margin-bottom:.75rem;
}
.finding-card:last-child{margin-bottom:0}
.finding-card__top{
  padding:.9rem 1rem;
  border-bottom:1px solid #e2e8f0;
  background:#fafbfc;
}
.finding-issue{
  font-weight:600;
  font-size:.9rem;
  color:#1a1a2e;
  line-height:1.45;
  margin-bottom:.6rem;
}
.finding-pills{display:flex;flex-wrap:wrap;align-items:center;gap:.4rem}
.finding-body{padding:.9rem 1rem;display:flex;flex-direction:column;gap:.75rem}
.finding-section h4{
  font-size:.72rem;
  font-weight:700;
  text-transform:uppercase;
  letter-spacing:.08em;
  color:#9ca3af;
  margin-bottom:.35rem;
}
.finding-section p{font-size:.875rem;color:#374151;line-height:1.5}
.review-flag{
  font-size:.72rem;
  font-weight:600;
  color:#92400e;
  background:#fffbeb;
  border:1px solid #fbbf24;
  border-radius:3px;
  padding:.1rem .45rem;
}

/* Evidence — inline (single step) */
.evidence-inline{
  display:flex;
  align-items:baseline;
  gap:.5rem;
  flex-wrap:wrap;
}
.evidence-inline__spoken{
  font-family:ui-monospace,'Cascadia Code','Fira Code',monospace;
  font-size:.8rem;
  color:#1a1a2e;
  line-height:1.5;
}

/* Evidence badge (strategy + index) */
.evidence-badge{
  display:inline-flex;
  align-items:stretch;
  border-radius:3px;
  overflow:hidden;
  border:1px solid #cbd5e0;
  text-decoration:none;
  font-family:ui-monospace,monospace;
  font-size:.72rem;
  flex-shrink:0;
  line-height:1;
}
.evidence-badge:hover{border-color:#1452cc;box-shadow:0 1px 3px rgba(20,82,204,.15)}
.evidence-badge:focus-visible{outline:2px solid #1452cc;outline-offset:2px}
.evidence-badge__strategy{
  background:#1452cc;
  color:#fff;
  padding:.2rem .45rem;
  font-weight:600;
}
.evidence-badge__idx{
  background:#edf2f7;
  color:#4a5568;
  padding:.2rem .4rem;
}
.evidence-badge--sm .evidence-badge__strategy{
  padding:.15rem .35rem;
  font-size:.68rem;
}

/* Inline step reference — appears mid-sentence in prose fields */
.step-ref{
  display:inline-flex;
  align-items:stretch;
  border-radius:3px;
  overflow:hidden;
  border:1px solid #cbd5e0;
  text-decoration:none;
  font-family:ui-monospace,monospace;
  font-size:.72em;
  vertical-align:baseline;
  line-height:1.4;
  position:relative;
  top:-.05em;
}
.step-ref:hover{border-color:#1452cc;box-shadow:0 1px 3px rgba(20,82,204,.15)}
.step-ref:focus-visible{outline:2px solid #1452cc;outline-offset:2px}
.step-ref__strategy{
  background:#1452cc;
  color:#fff;
  padding:.1rem .35rem;
  font-weight:600;
}
.step-ref__idx{
  background:#edf2f7;
  color:#4a5568;
  padding:.1rem .3rem;
}

/* Inline violation reference — links to violations in report */
.violation-ref{
  display:inline-flex;
  align-items:stretch;
  border-radius:3px;
  overflow:hidden;
  border:1px solid #e8a87c;
  text-decoration:none;
  font-family:ui-monospace,monospace;
  font-size:.72em;
  vertical-align:baseline;
  line-height:1.4;
  position:relative;
  top:-.05em;
}
.violation-ref:hover{border-color:#e8500a;box-shadow:0 1px 3px rgba(232,80,10,.15)}
.violation-ref:focus-visible{outline:2px solid #e8500a;outline-offset:2px}
.violation-ref__rule{
  background:#e8500a;
  color:#fff;
  padding:.1rem .35rem;
  font-weight:600;
}

/* Evidence excerpt (multi-step) */
.evidence-excerpt{
  border:1px solid #e2e8f0;
  border-left:3px solid #1452cc;
  border-radius:0 4px 4px 0;
  overflow:hidden;
  font-size:.82rem;
}
.evidence-excerpt__rail{
  display:flex;
  flex-direction:column;
}
.evidence-excerpt__row{
  display:grid;
  grid-template-columns:2.5ch 1fr auto;
  column-gap:.75rem;
  align-items:baseline;
  padding:.35rem .6rem;
  border-bottom:1px solid #f0f2f5;
}
.evidence-excerpt__row:last-child{border-bottom:none}
.evidence-excerpt__row:hover{background:#f8faff}
.evidence-excerpt__num{
  font-family:ui-monospace,monospace;
  font-size:.68rem;
  color:#9ca3af;
  text-align:right;
  user-select:none;
}
.evidence-excerpt__spoken{
  font-family:ui-monospace,'Cascadia Code','Fira Code',monospace;
  font-size:.78rem;
  color:#1a1a2e;
  line-height:1.5;
}
.evidence-excerpt__pattern{
  font-size:.8rem;
  color:#4a5568;
  line-height:1.55;
  padding:.5rem .6rem;
  background:#f8f9fa;
  border-top:1px solid #e2e8f0;
  margin:0;
}

/* Steps to reproduce */
.steps-to-reproduce{
  margin:0;
  padding-left:1.5rem;
  font-size:.875rem;
  color:#374151;
  line-height:1.6;
  display:flex;
  flex-direction:column;
  gap:.35rem;
}
.steps-to-reproduce li{
  padding-left:.25rem;
}
.steps-to-reproduce li::marker{
  color:#6b7280;
  font-weight:600;
}

/* Pill (generic) */
.pill{
  display:inline-block;
  font-size:.72rem;
  font-weight:600;
  border-radius:999px;
  padding:.1rem .5rem;
  border:1px solid transparent;
  text-transform:capitalize;
}

/* ── Transcript ── */
.t-controls{
  display:flex;
  align-items:center;
  flex-wrap:wrap;
  gap:.6rem;
  margin-bottom:1rem;
}
.t-search input{
  padding:.35rem .6rem;
  font-size:.82rem;
  font-family:inherit;
  color:#1a1a2e;
  background:#f8f9fa;
  border:1px solid #dee2e6;
  border-radius:4px;
  min-width:200px;
}
.t-search input:focus-visible{outline:2px solid #1452cc;outline-offset:1px}
.t-chips{display:flex;flex-wrap:wrap;gap:.3rem}
.t-chip{
  display:inline-flex;
  align-items:center;
  gap:.35em;
  padding:.2rem .55rem;
  font-size:.75rem;
  font-family:inherit;
  color:#6b7280;
  background:transparent;
  border:1px solid #dee2e6;
  border-radius:999px;
  cursor:pointer;
  transition:all .1s;
}
.t-chip:hover{color:#1a1a2e;border-color:#9ca3af}
.t-chip:focus-visible{outline:2px solid #1452cc;outline-offset:1px}
.t-chip.is-active{color:#fff;background:#1a1a2e;border-color:#1a1a2e}
.t-chip__count{opacity:.55;font-variant-numeric:tabular-nums}
.t-status{font-size:.78rem;color:#6b7280;font-variant-numeric:tabular-nums;margin:0}

.t-body{display:flex;flex-direction:column}
.t-walk{border-top:1px solid #e2e8f0}
.t-walk[hidden]{display:none}
.t-walk__header{
  display:flex;
  align-items:baseline;
  gap:.5rem;
  padding:.5rem 0;
}
.t-walk__name{
  font-size:.68rem;
  font-weight:700;
  text-transform:uppercase;
  letter-spacing:.1em;
  color:#9ca3af;
  font-family:ui-monospace,monospace;
}
.t-walk__count{font-size:.68rem;color:#9ca3af;opacity:.65}

.t-rows{display:flex;flex-direction:column;padding-bottom:.5rem}
.t-row{
  display:grid;
  grid-template-columns:3ch 1fr auto;
  grid-template-rows:auto auto;
  column-gap:.9rem;
  align-items:baseline;
  padding:.25rem .15rem;
  border-radius:3px;
}
.t-row[hidden]{display:none}
.t-row:hover{background:#f8f9fa}
.t-row:target{background:#eff6ff;outline:1px solid #1452cc;outline-offset:2px}
.t-row--cited{
  border-left:2px solid #1452cc;
  padding-left:.45rem;
  margin-left:-.5rem;
}
.t-num{
  grid-column:1;grid-row:1;
  text-align:right;
  font-family:ui-monospace,monospace;
  font-size:.68rem;
  color:#9ca3af;
  user-select:none;
}
.t-num a{color:inherit;text-decoration:none}
.t-num a:hover{color:#1452cc}
.t-text{
  grid-column:2;grid-row:1;
  font-size:.875rem;
  line-height:1.5;
  color:#1a1a2e;
}
.t-actions{
  grid-column:3;grid-row:1;
  display:flex;align-items:center;gap:.3rem;
  white-space:nowrap;
}
.t-cited{
  font-size:.62rem;
  font-family:ui-monospace,monospace;
  text-transform:uppercase;
  letter-spacing:.06em;
  color:#1452cc;
  border:1px solid currentColor;
  border-radius:999px;
  padding:.05rem .35rem;
}
.t-markup-btn{
  padding:.05rem .25rem;
  font-family:ui-monospace,monospace;
  font-size:.68rem;
  color:#9ca3af;
  background:transparent;
  border:1px solid transparent;
  border-radius:3px;
  cursor:pointer;
}
.t-markup-btn:hover{border-color:#dee2e6;color:#4a5568}
.t-markup-btn:focus-visible{outline:2px solid #1452cc;outline-offset:1px}
.t-markup-btn[aria-expanded="true"]{color:#1452cc;border-color:#dee2e6}
.t-markup{
  grid-column:2/4;grid-row:2;
  margin-top:.3rem;
}
.t-markup[hidden]{display:none}
.t-markup pre{
  margin:0;padding:.55rem .7rem;
  background:#1a1a2e;
  border-radius:4px;
  font-size:.72rem;
  overflow-x:auto;
  line-height:1.45;
}
.t-markup code{color:#a8b2d8}

/* Limitations */
.limitations-list{
  margin-left:1.25rem;
  color:#6b7280;
  font-size:.875rem;
  display:flex;
  flex-direction:column;
  gap:.35rem;
}

/* Footer */
.site-footer{
  max-width:1100px;
  margin:0 auto 2rem;
  padding:0 1.25rem;
  display:flex;
  justify-content:space-between;
  flex-wrap:wrap;
  gap:.5rem;
  font-size:.78rem;
  color:#9ca3af;
}

/* Utility */
.sr-only{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}

/* Responsive */
@media(max-width:860px){
  .page{grid-template-columns:1fr;gap:1rem}
  .toc{position:static}
  .summary-grid{grid-template-columns:repeat(2,1fr)}
}
@media(max-width:540px){
  .site-header{padding:1rem}
  .site-header__verdict{display:none}
  .summary-grid{grid-template-columns:1fr 1fr}
}
`;
    }

    private getScripts(): string {
        return `
<div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="Screenshot preview">
  <div class="lightbox__content">
    <button type="button" class="lightbox__close" aria-label="Close">&times;</button>
    <img class="lightbox__img" src="" alt="">
    <div class="lightbox__meta"></div>
  </div>
</div>
<script>
(function(){
  // ── Transcript filter ──
  var input   = document.getElementById('t-filter');
  var status  = document.querySelector('.t-status');
  var chips   = [].slice.call(document.querySelectorAll('.t-chip'));
  var rows    = [].slice.call(document.querySelectorAll('.t-row'));
  var walks   = [].slice.call(document.querySelectorAll('.t-walk'));
  var walk    = 'all';

  function applyFilter(){
    var q = input ? input.value.trim().toLowerCase() : '';
    var shown = 0;
    rows.forEach(function(row){
      var text       = (row.querySelector('.t-text')||row).textContent.toLowerCase();
      var walkMatch  = walk === 'all' || row.dataset.walk === walk;
      var textMatch  = q === '' || text.indexOf(q) !== -1;
      var visible    = walkMatch && textMatch;
      row.hidden     = !visible;
      if(visible) shown++;
    });
    walks.forEach(function(w){
      w.hidden = w.querySelectorAll('.t-row:not([hidden])').length === 0;
    });
    if(status) status.textContent = (q||walk!=='all') ? shown+' step'+(shown===1?'':'s') : '';
  }

  function selectWalk(name){
    walk = name;
    chips.forEach(function(c){
      var on = c.dataset.walk === name;
      c.classList.toggle('is-active', on);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    applyFilter();
  }

  if(input) input.addEventListener('input', applyFilter);
  chips.forEach(function(c){ c.addEventListener('click', function(){ selectWalk(c.dataset.walk); }); });

  // Markup toggle
  document.querySelectorAll('.t-markup-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      var exp = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', exp ? 'false' : 'true');
      var panel = document.getElementById(btn.getAttribute('aria-controls'));
      if(panel) panel.hidden = exp;
    });
  });

  // Reveal target when navigating to a hash that the filter hides
  function revealTarget(){
    if(!location.hash) return;
    var target = document.getElementById(location.hash.slice(1));
    if(!target || !target.classList.contains('t-row')) return;
    if(target.hidden){ if(input) input.value=''; selectWalk('all'); }
    target.scrollIntoView({block:'center'});
  }
  window.addEventListener('hashchange', revealTarget);
  revealTarget();

  // ── Attachment tabs ──
  document.querySelectorAll('.v-tabs').forEach(function(tablist){
    var tabs = [].slice.call(tablist.querySelectorAll('.v-tab'));
    tabs.forEach(function(tab){
      tab.addEventListener('click', function(){
        tabs.forEach(function(t){
          t.classList.remove('is-active');
          t.setAttribute('aria-selected','false');
          t.setAttribute('tabindex','-1');
          var p = document.getElementById(t.getAttribute('aria-controls'));
          if(p) p.hidden = true;
        });
        tab.classList.add('is-active');
        tab.setAttribute('aria-selected','true');
        tab.removeAttribute('tabindex');
        var p = document.getElementById(tab.getAttribute('aria-controls'));
        if(p) p.hidden = false;
      });
      tab.addEventListener('keydown', function(e){
        var idx = tabs.indexOf(tab), next = idx;
        if(e.key==='ArrowRight'||e.key==='ArrowDown'){ next=(idx+1)%tabs.length; e.preventDefault(); }
        else if(e.key==='ArrowLeft'||e.key==='ArrowUp'){ next=(idx-1+tabs.length)%tabs.length; e.preventDefault(); }
        else if(e.key==='Home'){ next=0; e.preventDefault(); }
        else if(e.key==='End'){ next=tabs.length-1; e.preventDefault(); }
        if(next!==idx){ tabs[next].click(); tabs[next].focus(); }
      });
    });
  });

  // ── Lightbox ──
  var lb       = document.getElementById('lightbox');
  var lbImg    = lb && lb.querySelector('.lightbox__img');
  var lbMeta   = lb && lb.querySelector('.lightbox__meta');
  var lbClose  = lb && lb.querySelector('.lightbox__close');
  var lastFocus;

  function openLightbox(img){
    if(!lb||!lbImg) return;
    lastFocus = document.activeElement;
    lbImg.src = img.src; lbImg.alt = img.alt;
    if(lbMeta) lbMeta.textContent = img.naturalWidth+' × '+img.naturalHeight+' px';
    lb.classList.add('is-open');
    document.body.style.overflow='hidden';
    if(lbClose) lbClose.focus();
  }
  function closeLightbox(){
    if(!lb) return;
    lb.classList.remove('is-open');
    document.body.style.overflow='';
    if(lastFocus) lastFocus.focus();
  }

  document.querySelectorAll('.screenshot-img').forEach(function(img){
    img.addEventListener('click', function(){ openLightbox(img); });
  });
  document.querySelectorAll('.btn-zoom').forEach(function(btn){
    btn.addEventListener('click', function(){
      var img = btn.closest('.screenshot-wrap') && btn.closest('.screenshot-wrap').querySelector('.screenshot-img');
      if(img) openLightbox(img);
    });
  });
  if(lbClose) lbClose.addEventListener('click', closeLightbox);
  if(lb){
    lb.addEventListener('click', function(e){ if(e.target===lb) closeLightbox(); });
    document.addEventListener('keydown', function(e){ if(e.key==='Escape'&&lb.classList.contains('is-open')) closeLightbox(); });
  }
})();
</script>`;
    }
}

export function createHtmlReporter(): HtmlReporter {
    return new HtmlReporter();
}
