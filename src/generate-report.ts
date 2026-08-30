import { program } from 'commander';
import { generateReportFromFiles } from './reporting';

program
    .name('generate-report')
    .description('Generate an accessibility report from existing audit data files')
    .requiredOption('--url <url>', 'Page URL for the report')
    .requiredOption('--title <title>', 'Page title for the report')
    .option('--llm-response <path>', 'Path to LLM response JSON', './llm-response.json')
    .option(
        '--violations <path>',
        'Path to violations JSON (screenshots embedded in NVDA violations)',
        './violations.json'
    )
    .option('--transcript <path>', 'Path to transcript JSON', './transcript.json')
    .option('-f, --format <format>', 'Output format: html or json', 'html')
    .option('-o, --output <path>', 'Output file path', './report.html')
    .parse();

const options = program.opts<{
    url: string;
    title: string;
    llmResponse: string;
    violations: string;
    transcript: string;
    format: 'html' | 'json';
    output: string;
}>();

console.log('\n=== Generating Accessibility Report ===');
console.log(`LLM Response: ${options.llmResponse}`);
console.log(`Violations: ${options.violations}`);
console.log(`Transcript: ${options.transcript}`);
console.log(`Page URL: ${options.url}`);
console.log(`Page Title: ${options.title}`);
console.log(`Format: ${options.format}`);
console.log(`Output: ${options.output}`);

await generateReportFromFiles({
    llmResponsePath: options.llmResponse,
    violationsPath: options.violations,
    transcriptPath: options.transcript,
    pageUrl: options.url,
    pageTitle: options.title,
    format: options.format,
    outputPath: options.output,
});

console.log(`\n✓ Report generated: ${options.output}`);
