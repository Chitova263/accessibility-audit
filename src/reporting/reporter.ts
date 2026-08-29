/**
 * Reporter Interface and Base Types
 *
 * Pluggable architecture for generating accessibility audit reports
 * in various formats (HTML, JSON, PDF, etc.)
 */

import type { LlmCompleteResponse } from '../llm/prompt-builder';
import type { Violation } from '../analysis/violation';
import type { StrategyResult } from '../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';

// =============================================================================
// Report Data Types
// =============================================================================

/**
 * Page information for the report.
 */
export interface ReportPage {
    /** URL of the audited page */
    url: string;

    /** Page title */
    title: string;
}

/**
 * Metadata about the audit run.
 */
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

/**
 * Complete data passed to reporters.
 */
export interface ReportData {
    /** Page that was audited */
    page: ReportPage;

    /** LLM analysis response (validated by Zod schema) */
    analysis: LlmCompleteResponse;

    /** Raw violations from rule-based analyzers */
    violations: Violation[];

    /** Navigation strategy results (optional, for transcript inclusion) */
    strategyResults?: StrategyResult[] | undefined;

    /** Audit metadata */
    meta: ReportMeta;
}

// =============================================================================
// Report Output Types
// =============================================================================

/**
 * Output from a reporter.
 */
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

// =============================================================================
// Reporter Interface
// =============================================================================

/**
 * Configuration options for reporters.
 * Extended by specific reporter implementations.
 */
export interface ReporterOptions {
    /** Include transcript in report */
    includeTranscript?: boolean;

    /** Include HTML snippets in report */
    includeHtmlSnippets?: boolean;

    /** Custom title for the report */
    title?: string;
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

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a filename with timestamp.
 */
export function generateFilename(prefix: string, extension: string): string {
    const date = new Date();
    const timestamp = date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `${prefix}-${timestamp}.${extension}`;
}

/**
 * Format a timestamp as a human-readable string.
 */
export function formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
}

/**
 * Format duration in milliseconds to human-readable string.
 */
export function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
}

/**
 * Get severity color for styling.
 */
export function getSeverityColor(severity: string): string {
    const colors: Record<string, string> = {
        critical: '#d32f2f',
        serious: '#f57c00',
        moderate: '#fbc02d',
        minor: '#388e3c',
    };
    return colors[severity.toLowerCase()] ?? '#757575';
}

/**
 * Get assessment color for styling.
 */
export function getAssessmentColor(assessment: string): string {
    const colors: Record<string, string> = {
        good: '#388e3c',
        'needs-review': '#f57c00',
        problematic: '#d32f2f',
    };
    return colors[assessment.toLowerCase()] ?? '#757575';
}

/**
 * Get confidence badge color.
 */
export function getConfidenceColor(confidence: string): string {
    const colors: Record<string, string> = {
        high: '#388e3c',
        medium: '#f57c00',
        low: '#d32f2f',
        confirmed: '#388e3c',
        likely: '#f57c00',
        uncertain: '#d32f2f',
    };
    return colors[confidence.toLowerCase()] ?? '#757575';
}

/**
 * Escape HTML special characters.
 */
export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Truncate text with ellipsis.
 */
export function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
}
