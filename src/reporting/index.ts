/**
 * Reporting Module
 *
 * Pluggable reporter architecture for generating accessibility audit reports.
 *
 * @example
 * ```typescript
 * import { createHtmlReporter, ReportData } from './reporting';
 *
 * const reporter = createHtmlReporter();
 * const output = await reporter.generate(reportData, { theme: 'dark' });
 *
 * await fs.writeFile(output.filename, output.content);
 * ```
 */

// =============================================================================
// Core Types & Interface
// =============================================================================

export type { Reporter, ReportData, ReportOutput, ReportPage, ReportMeta, ReporterOptions } from './reporter';

export {
    generateFilename,
    formatTimestamp,
    formatDuration,
    getSeverityColor,
    getAssessmentColor,
    getConfidenceColor,
    escapeHtml,
    truncate,
} from './reporter';

// =============================================================================
// Built-in Reporters
// =============================================================================

// HTML Reporter
export type { HtmlReporterOptions } from './reporters/html-reporter';
export { HtmlReporter, createHtmlReporter } from './reporters/html-reporter';

// JSON Reporter
export type { JsonReporterOptions } from './reporters/json-reporter';
export { JsonReporter, createJsonReporter } from './reporters/json-reporter';

// Transcript Text Formatter
export { formatTranscriptAsText } from './transcript-text-formatter';

// Generate reports from saved files
export {
    generateReportFromFiles,
    generateReport,
    type ReportFromFilesOptions,
    type ReportFromFilesResult,
} from './from-files';

// =============================================================================
// Reporter Registry (for dynamic reporter selection)
// =============================================================================

import { HtmlReporter } from './reporters/html-reporter';
import { JsonReporter } from './reporters/json-reporter';
import type { Reporter } from './reporter';

/**
 * Registry of built-in reporters.
 */
const REPORTER_REGISTRY: Record<string, () => Reporter> = {
    html: () => new HtmlReporter(),
    json: () => new JsonReporter(),
};

/**
 * Get a reporter by name.
 *
 * @param name - Reporter name ('html', 'json', etc.)
 * @returns Reporter instance
 * @throws Error if reporter not found
 */
export function getReporter(name: string): Reporter {
    const factory = REPORTER_REGISTRY[name.toLowerCase()];
    if (!factory) {
        const available = Object.keys(REPORTER_REGISTRY).join(', ');
        throw new Error(`Unknown reporter: ${name}. Available: ${available}`);
    }
    return factory();
}

/**
 * Register a custom reporter.
 *
 * @param name - Unique name for the reporter
 * @param factory - Factory function that creates the reporter
 *
 * @example
 * ```typescript
 * registerReporter('slack', () => new SlackReporter());
 *
 * const reporter = getReporter('slack');
 * ```
 */
export function registerReporter(name: string, factory: () => Reporter): void {
    REPORTER_REGISTRY[name.toLowerCase()] = factory;
}

/**
 * List available reporter names.
 */
export function listReporters(): string[] {
    return Object.keys(REPORTER_REGISTRY);
}
