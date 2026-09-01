#!/usr/bin/env node
import { program } from 'commander';
import * as path from 'path';
import { generateReportFromFiles } from '../reporting';

program
    .name('a11y report')
    .description('Generate an accessibility report from existing audit data files')
    .requiredOption('--url <url>', 'Page URL for the report')
    .requiredOption('--title <title>', 'Page title for the report')
    .option('--dir <dir>', 'Audit run directory (sets default paths for all files below)')
    .option(
        '--llm-response <path>',
        'Path to LLM response JSON (default: <dir>/llm-response.json or ./llm-response.json)'
    )
    .option('--violations <path>', 'Path to violations JSON (default: <dir>/violations.json or ./violations.json)')
    .option('--transcript <path>', 'Path to transcript JSON (default: <dir>/transcript.json or ./transcript.json)')
    .option('-f, --format <format>', 'Output format: html or json', 'html')
    .option('-o, --output <path>', 'Output file path (default: <dir>/report.html or ./report.html)')
    .parse();

const options = program.opts<{
    url: string;
    title: string;
    dir?: string;
    llmResponse?: string;
    violations?: string;
    transcript?: string;
    format: 'html' | 'json';
    output?: string;
}>();

function resolvePath(explicit: string | undefined, filename: string): string {
    if (explicit) return explicit;
    if (options.dir) return path.join(path.resolve(options.dir), filename);
    return path.join('.', filename);
}

const llmResponsePath = resolvePath(options.llmResponse, 'llm-response.json');
const violationsPath = resolvePath(options.violations, 'violations.json');
const transcriptPath = resolvePath(options.transcript, 'transcript.json');
const outputPath = resolvePath(options.output, options.format === 'json' ? 'report.json' : 'report.html');

console.log('\n=== Generating Accessibility Report ===');
if (options.dir) console.log(`Run directory: ${options.dir}`);
console.log(`LLM Response: ${llmResponsePath}`);
console.log(`Violations: ${violationsPath}`);
console.log(`Transcript: ${transcriptPath}`);
console.log(`Page URL: ${options.url}`);
console.log(`Page Title: ${options.title}`);
console.log(`Format: ${options.format}`);
console.log(`Output: ${outputPath}`);

await generateReportFromFiles({
    llmResponsePath,
    violationsPath,
    transcriptPath,
    pageUrl: options.url,
    pageTitle: options.title,
    format: options.format,
    outputPath,
});

console.log(`\n✓ Report generated: ${outputPath}`);
