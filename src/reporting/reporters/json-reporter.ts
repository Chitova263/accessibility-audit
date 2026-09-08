import type { Reporter, ReportData, ReportOutput, ReporterOptions } from '../reporter';
import { generateFilename } from '../reporter';
import { isLlmFinding, isLlmEnhancement } from '../../llm/prompt-builder';

export interface JsonReporterOptions extends ReporterOptions {
    pretty?: boolean;
    indent?: number;
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
            const findings = data.analysis.issues.filter(isLlmFinding);
            const enhancements = data.analysis.issues.filter(isLlmEnhancement);
            output = {
                meta: data.meta,
                summary: data.analysis.summary,
                counts: {
                    findings: findings.length,
                    enhancements: enhancements.length,
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
