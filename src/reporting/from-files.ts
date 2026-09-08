/**
 * Generate reports from saved audit data files.
 *
 * Workflow:
 * 1. Run audit, save prompt to file
 * 2. Paste prompt in chat app, get response
 * 3. Save LLM response JSON to file
 * 4. Call generateReportFromFiles() to create reports
 */

import { readFile, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { parseLlmResponse, type LlmCompleteResponse } from '../llm/prompt-builder/schemas';
import type { Violation } from '../analysis/core/violation';
import type { ReportData, ReportOutput } from './reporter';
import type { StrategyResult } from '../screen-reader/strategies/navigation-strategy';
import { getReporter } from './reporter-registry';

export interface ReportFromFilesOptions {
    llmResponsePath: string;
    /** Screenshots embedded in violations */
    violationsPath?: string;
    transcriptPath?: string;
    format?: 'html' | 'json';
    outputPath?: string;
    /** Defaults to violations file directory */
    screenshotsBasePath?: string;
}

export interface ReportFromFilesResult {
    report: ReportOutput;
    analysis: LlmCompleteResponse;
    writtenTo: string | undefined;
}

/**
 * Generate a report from saved LLM response JSON.
 *
 * @example
 * ```typescript
 * // Minimal - just the LLM response
 * const result = await generateReportFromFiles({
 *     llmResponsePath: './llm-response.json',
 * });
 * console.log(result.report.content);
 *
 * // Full options with violations and transcript
 * const result = await generateReportFromFiles({
 *     llmResponsePath: './llm-response.json',
 *     violationsPath: './violations.json',
 *     transcriptPath: './transcript.json',
 *     format: 'html',
 *     outputPath: './report.html',
 * });
 * ```
 */
export async function generateReportFromFiles(options: ReportFromFilesOptions): Promise<ReportFromFilesResult> {
    const llmJson = await readFile(options.llmResponsePath, 'utf-8');
    const llmData = JSON.parse(llmJson) as unknown;
    const analysis = parseLlmResponse(llmData);

    let violations: Violation[] = [];
    if (options.violationsPath) {
        const violationsJson = await readFile(options.violationsPath, 'utf-8');
        violations = JSON.parse(violationsJson) as Violation[];
    }

    let transcript: StrategyResult[] | undefined;
    if (options.transcriptPath) {
        const transcriptJson = await readFile(options.transcriptPath, 'utf-8');
        transcript = JSON.parse(transcriptJson) as StrategyResult[];
    }

    const reportData: ReportData = {
        analysis,
        violations,
        transcript,
        meta: {
            timestamp: Date.now(),
        },
    };

    const format = options.format ?? 'html';
    const reporter = getReporter(format);

    const screenshotsBasePath =
        options.screenshotsBasePath ??
        (options.violationsPath ? dirname(resolve(options.violationsPath)) : process.cwd());

    const report = await reporter.generate(reportData, { screenshotsBasePath });

    let writtenTo: string | undefined;
    if (options.outputPath) {
        await writeFile(options.outputPath, report.content, 'utf-8');
        writtenTo = options.outputPath;
    }

    return {
        report,
        analysis,
        writtenTo,
    };
}

export async function generateReport(options: {
    analysis: unknown;
    violations?: Violation[];
    transcript?: StrategyResult[];
    format?: 'html' | 'json';
    screenshotsBasePath?: string;
}): Promise<ReportOutput> {
    const analysis = isLlmCompleteResponse(options.analysis) ? options.analysis : parseLlmResponse(options.analysis);

    const reportData: ReportData = {
        analysis,
        violations: options.violations ?? [],
        transcript: options.transcript,
        meta: {
            timestamp: Date.now(),
        },
    };

    const reporter = getReporter(options.format ?? 'html');
    return reporter.generate(
        reportData,
        options.screenshotsBasePath ? { screenshotsBasePath: options.screenshotsBasePath } : undefined
    );
}

function isLlmCompleteResponse(value: unknown): value is LlmCompleteResponse {
    return typeof value === 'object' && value !== null && 'issues' in value && 'summary' in value;
}
