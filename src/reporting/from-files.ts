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
import type { StrategyResult } from '../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';
import { getReporter } from './index';

export interface ReportFromFilesOptions {
    /** Path to LLM response JSON file (required) */
    llmResponsePath: string;

    /** Path to violations JSON file (screenshots embedded in NVDA violations) */
    violationsPath?: string;

    /** Path to strategy results / transcript JSON file (optional) */
    transcriptPath?: string;

    /** Output format: 'html' | 'json' */
    format?: 'html' | 'json';

    /** Output file path (optional - if not provided, returns content only) */
    outputPath?: string;

    /** Base path for resolving screenshot file paths (defaults to violations file directory) */
    screenshotsBasePath?: string;
}

export interface ReportFromFilesResult {
    /** Generated report */
    report: ReportOutput;

    /** Parsed LLM analysis */
    analysis: LlmCompleteResponse;

    /** Path where report was written (if outputPath was provided) */
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
 *     pageUrl: 'https://example.com',
 *     pageTitle: 'Example Page',
 *     format: 'html',
 *     outputPath: './report.html',
 * });
 * ```
 */
export async function generateReportFromFiles(options: ReportFromFilesOptions): Promise<ReportFromFilesResult> {
    // Read and parse LLM response
    const llmJson = await readFile(options.llmResponsePath, 'utf-8');
    const llmData = JSON.parse(llmJson) as unknown;
    const analysis = parseLlmResponse(llmData);

    // Read violations if provided (screenshots are now embedded in NVDA violations)
    let violations: Violation[] = [];
    if (options.violationsPath) {
        const violationsJson = await readFile(options.violationsPath, 'utf-8');
        violations = JSON.parse(violationsJson) as Violation[];
    }

    // Read transcript/strategy results if provided
    let transcript: StrategyResult[] | undefined;
    if (options.transcriptPath) {
        const transcriptJson = await readFile(options.transcriptPath, 'utf-8');
        transcript = JSON.parse(transcriptJson) as StrategyResult[];
    }

    // Build report data
    const reportData: ReportData = {
        analysis,
        violations,
        transcript,
        meta: {
            timestamp: Date.now(),
        },
    };

    // Generate report
    const format = options.format ?? 'html';
    const reporter = getReporter(format);

    // Determine base path for screenshots:
    // 1. Explicitly provided screenshotsBasePath
    // 2. Directory containing violations file
    // 3. Current working directory
    const screenshotsBasePath =
        options.screenshotsBasePath ??
        (options.violationsPath ? dirname(resolve(options.violationsPath)) : process.cwd());

    const report = await reporter.generate(reportData, { screenshotsBasePath });

    // Write to file if outputPath provided
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

/**
 * Generate a report from already-loaded data.
 *
 * @example
 * ```typescript
 * const analysis = JSON.parse(await fs.readFile('./response.json', 'utf-8'));
 * const result = await generateReport({
 *     analysis,
 *     violations: myViolations,
 *     transcript: myTranscript,
 *     pageUrl: 'https://example.com',
 * });
 * ```
 */
export async function generateReport(options: {
    /** LLM analysis (already parsed or raw JSON) */
    analysis: LlmCompleteResponse | unknown;

    /** Violations array (screenshots referenced by path in NVDA violations) */
    violations?: Violation[];

    /** Strategy results / transcript data */
    transcript?: StrategyResult[];

    /** Output format */
    format?: 'html' | 'json';

    /** Base path for resolving screenshot file paths */
    screenshotsBasePath?: string;
}): Promise<ReportOutput> {
    // Parse if needed
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

// Type guard for LlmCompleteResponse
function isLlmCompleteResponse(value: unknown): value is LlmCompleteResponse {
    return typeof value === 'object' && value !== null && 'analysis' in value && 'enhancements' in value;
}
