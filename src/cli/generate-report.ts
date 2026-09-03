#!/usr/bin/env node
import { program } from 'commander';
import * as path from 'path';
import { generateReportFromFiles } from '../reporting/from-files';
import { Logger } from '../utils/logger';
import { reportOptionsSchema, parseOptions } from './schemas';

program
    .name('a11y report')
    .description('Generate an accessibility report from existing audit data files')
    .option('--dir <dir>', 'Audit run directory (sets default paths for all files below)')
    .option('--llm-response <path>', 'Path to LLM response JSON')
    .option('--violations <path>', 'Path to violations JSON')
    .option('--transcript <path>', 'Path to transcript JSON')
    .option('-f, --format <format>', 'Output format: html or json')
    .option('-o, --output <path>', 'Output file path')
    .option('-v, --verbose', 'Enable verbose output')
    .parse();

const options = parseOptions(reportOptionsSchema, program.opts(), 'a11y report');

Logger.setLevel(options.verbose ? 'debug' : 'info');

function resolvePath(explicit: string | undefined, filename: string): string {
    if (explicit) return explicit;
    if (options.dir) return path.join(path.resolve(options.dir), filename);
    return path.join('.', filename);
}

const llmResponsePath = resolvePath(options.llmResponse, 'llm-response.json');
const violationsPath = resolvePath(options.violations, 'violations.json');
const transcriptPath = resolvePath(options.transcript, 'transcript.json');
const outputPath = resolvePath(options.output, options.format === 'json' ? 'report.json' : 'report.html');

Logger.section('Generating Accessibility Report');
if (options.dir) Logger.info(`Run directory: ${options.dir}`);
Logger.info(`LLM Response: ${llmResponsePath}`);
Logger.info(`Violations: ${violationsPath}`);
Logger.info(`Transcript: ${transcriptPath}`);
Logger.debug(`Format: ${options.format}`);
Logger.debug(`Output: ${outputPath}`);

await generateReportFromFiles({
    llmResponsePath,
    violationsPath,
    transcriptPath,
    format: options.format,
    outputPath,
});

Logger.info(`Report generated: ${outputPath}`);
