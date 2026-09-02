import type { Reporter, ReportData, ReportOutput, ReporterOptions } from '../reporter';
import { generateFilename } from '../reporter';

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
    screenshotsBasePath: process.cwd(),
    pretty: true,
    indent: 2,
    summaryOnly: false,
};

export class JsonReporter implements Reporter {
    readonly name = 'json';

    async generate(data: ReportData, options?: JsonReporterOptions): Promise<ReportOutput> {
        const opts = { ...DEFAULT_OPTIONS, ...options };

        let output: object;

        if (opts.summaryOnly) {
            output = {
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
                meta: data.meta,
                analysis: data.analysis,
                violations: data.violations,
                transcript: opts.includeTranscript ? data.transcript : undefined,
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

export function createJsonReporter(): JsonReporter {
    return new JsonReporter();
}
