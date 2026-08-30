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

export type { HtmlReporterOptions } from './reporters/html-reporter';
export { HtmlReporter, createHtmlReporter } from './reporters/html-reporter';

export type { JsonReporterOptions } from './reporters/json-reporter';
export { JsonReporter, createJsonReporter } from './reporters/json-reporter';

export { formatTranscriptAsText } from './transcript-text-formatter';

export {
    generateReportFromFiles,
    generateReport,
    type ReportFromFilesOptions,
    type ReportFromFilesResult,
} from './from-files';

import { HtmlReporter } from './reporters/html-reporter';
import { JsonReporter } from './reporters/json-reporter';
import type { Reporter } from './reporter';

const REPORTER_REGISTRY: Record<string, () => Reporter> = {
    html: () => new HtmlReporter(),
    json: () => new JsonReporter(),
};

export function getReporter(name: string): Reporter {
    const factory = REPORTER_REGISTRY[name.toLowerCase()];
    if (!factory) {
        const available = Object.keys(REPORTER_REGISTRY).join(', ');
        throw new Error(`Unknown reporter: ${name}. Available: ${available}`);
    }
    return factory();
}

export function registerReporter(name: string, factory: () => Reporter): void {
    REPORTER_REGISTRY[name.toLowerCase()] = factory;
}

export function listReporters(): string[] {
    return Object.keys(REPORTER_REGISTRY);
}
