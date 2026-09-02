/**
 * Reporter Interface and Base Types
 *
 * Pluggable architecture for generating accessibility audit reports
 * in various formats (HTML, JSON, PDF, etc.)
 */

import type { LlmCompleteResponse } from '../llm/prompt-builder';
import type { Violation } from '../analysis/core/violation';
import type { StrategyResult } from '../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';

export interface ReportMeta {
    /** Timestamp when audit was run (ms since epoch) */
    timestamp: number;

    /** Duration of the audit in milliseconds */
    duration?: number;

    /** Version of the audit tool */
    toolVersion?: string;

    /** Strategies that were executed */
    strategies?: string[];
}

export interface ReportData {
    /** LLM analysis response (validated by Zod schema) */
    analysis: LlmCompleteResponse;

    /** Raw violations from rule-based analyzers (screenshots embedded in context for NVDA violations) */
    violations: Violation[];

    /** Navigation strategy results (optional, for transcript inclusion) */
    transcript?: StrategyResult[] | undefined;

    /** Audit metadata */
    meta: ReportMeta;
}

export interface ReportOutput {
    /** Output format identifier (e.g., 'html', 'json', 'pdf') */
    format: string;

    /** The generated report content */
    content: string;

    /** Suggested filename for saving */
    filename: string;

    /** MIME type for the content */
    mimeType: string;
}

export interface ReporterOptions {
    /** Include transcript in report */
    includeTranscript?: boolean;

    /** Include HTML snippets in report */
    includeHtmlSnippets?: boolean;

    /** Custom title for the report */
    title?: string;

    /** Base path for resolving screenshot file paths (for file-based screenshots) */
    screenshotsBasePath?: string;
}

/**
 * Reporter interface.
 *
 * Implement this interface to create custom report formats.
 *
 * @example
 * ```typescript
 * class SlackReporter implements Reporter {
 *     readonly name = 'slack';
 *
 *     async generate(data: ReportData): Promise<ReportOutput> {
 *         // Generate Slack-formatted message
 *         return {
 *             format: 'json',
 *             content: JSON.stringify(slackPayload),
 *             filename: 'slack-report.json',
 *             mimeType: 'application/json',
 *         };
 *     }
 * }
 * ```
 */
export interface Reporter {
    /** Unique identifier for this reporter */
    readonly name: string;

    /**
     * Generate a report from audit data.
     *
     * @param data - Complete audit data including LLM analysis and violations
     * @param options - Reporter-specific options
     * @returns Generated report content and metadata
     */
    generate(data: ReportData, options?: ReporterOptions): Promise<ReportOutput>;
}

export function generateFilename(prefix: string, extension: string): string {
    const date = new Date();
    const timestamp = date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `${prefix}-${timestamp}.${extension}`;
}

export function formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
}

export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
}
