/**
 * JSON Reporter
 *
 * Simple reference implementation that outputs raw JSON.
 * Useful for machine consumption or piping to other tools.
 */

import type { Reporter, ReportData, ReportOutput, ReporterOptions } from '../reporter';
import { generateFilename } from '../reporter';

// =============================================================================
// JSON Reporter Options
// =============================================================================

export interface JsonReporterOptions extends ReporterOptions {
    /** Pretty print with indentation */
    pretty?: boolean;

    /** Indentation spaces (when pretty = true) */
    indent?: number;

    /** Only include summary, not full details */
    summaryOnly?: boolean;
}

const DEFAULT_OPTIONS: Required<JsonReporterOptions> = {
    includeTranscript: false,
    includeHtmlSnippets: true,
    title: 'Accessibility Audit Report',
    pretty: true,
    indent: 2,
    summaryOnly: false,
};

// =============================================================================
// JSON Reporter Implementation
// =============================================================================

export class JsonReporter implements Reporter {
    readonly name = 'json';

    async generate(data: ReportData, options?: JsonReporterOptions): Promise<ReportOutput> {
        const opts = { ...DEFAULT_OPTIONS, ...options };

        let output: object;

        if (opts.summaryOnly) {
            output = {
                page: data.page,
                meta: data.meta,
                summary: data.analysis.analysis.summary,
                counts: {
                    findings: data.analysis.analysis.findings.length,
                    enhancements: data.analysis.enhancements.length,
                    violations: data.violations.length,
                },
            };
        } else {
            output = {
                page: data.page,
                meta: data.meta,
                analysis: data.analysis,
                violations: data.violations,
                strategyResults: opts.includeTranscript ? data.strategyResults : undefined,
            };
        }

        const content = opts.pretty ? JSON.stringify(output, null, opts.indent) : JSON.stringify(output);

        return {
            format: 'json',
            content,
            filename: generateFilename('accessibility-report', 'json'),
            mimeType: 'application/json',
        };
    }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a JSON reporter instance.
 */
export function createJsonReporter(): JsonReporter {
    return new JsonReporter();
}
