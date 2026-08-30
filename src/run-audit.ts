import { program } from 'commander';
import { NvdaScreenReader } from './screen-reader/nvda-screen-reader';
import { ChromeDevToolsProtocolConnection } from './chrome-dev-tools-protocol-connection';
import type { INavigationStrategy } from './screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';
import { PageSession } from './screen-reader/page-session';
import { HeadingNavigationStrategy } from './screen-reader/navigation-strategy/browse-mode-strategies/heading-navigation-strategy';
import { LandmarkNavigationStrategy } from './screen-reader/navigation-strategy/browse-mode-strategies/landmark-navigation-strategy';
import { ButtonNavigationStrategy } from './screen-reader/navigation-strategy/browse-mode-strategies/button-navigation-strategy';
import { LinkNavigationStrategy } from './screen-reader/navigation-strategy/browse-mode-strategies/link-navigation-strategy';
import { HeadingHierarchyNavigationStrategy } from './screen-reader/navigation-strategy/browse-mode-strategies/heading-hierarchy-navigation-strategy';
import { TabNavigationStrategy } from './screen-reader/navigation-strategy/focus-mode-strategies/tab-navigation-strategy';
import { ArrowNavigationStrategy } from './screen-reader/navigation-strategy/browse-mode-strategies/arrow-navigation-strategy';
import { collectViolations, runChecks, summarizeViolations } from './analysis';
import { createPromptBuilder } from './llm/prompt-builder';
import { formatTranscriptAsText } from './reporting';

program
    .name('run-audit')
    .description('Run accessibility audit on a given URL')
    .argument('<url>', 'URL to audit')
    .option('-o, --output-dir <dir>', 'Output directory for audit files', '.')
    .option('--max-steps <number>', 'Maximum steps per strategy', '500')
    .option('-v, --verbose', 'Enable verbose output')
    .action(() => {})
    .parse();

const url = program.processedArgs[0] as string;
const options = program.opts<{
    outputDir: string;
    maxSteps: string;
    verbose: boolean;
}>();

const maxSteps = parseInt(options.maxSteps, 10);
const outputDir = options.outputDir;

let chromeDevToolsProtocolConnection: ChromeDevToolsProtocolConnection | undefined = undefined;
try {
    console.log(`\n=== Starting Accessibility Audit ===`);
    console.log(`Target URL: ${url}`);
    if (options.verbose) {
        console.log(`Output directory: ${outputDir}`);
        console.log(`Max steps per strategy: ${maxSteps}`);
    }

    chromeDevToolsProtocolConnection = ChromeDevToolsProtocolConnection.createConnection();
    await chromeDevToolsProtocolConnection.connect();

    const strategies: INavigationStrategy[] = [
        new HeadingNavigationStrategy({ maxSteps: Math.min(100, maxSteps) }),
        new LandmarkNavigationStrategy({ maxSteps: Math.min(100, maxSteps) }),
        new ButtonNavigationStrategy({ maxSteps: Math.min(100, maxSteps) }),
        new LinkNavigationStrategy({ maxSteps }),
        new HeadingHierarchyNavigationStrategy({ maxSteps, level: 1 }),
        new HeadingHierarchyNavigationStrategy({ maxSteps, level: 2 }),
        new HeadingHierarchyNavigationStrategy({ maxSteps, level: 3 }),
        new HeadingHierarchyNavigationStrategy({ maxSteps, level: 4 }),
        new HeadingHierarchyNavigationStrategy({ maxSteps, level: 5 }),
        new HeadingHierarchyNavigationStrategy({ maxSteps, level: 6 }),
        new ArrowNavigationStrategy({ maxSteps }),
        new TabNavigationStrategy({ maxSteps }),
    ];

    const pageUrl = new URL(url);
    const page = await chromeDevToolsProtocolConnection.goToPage(pageUrl);
    const pageSession = new PageSession(pageUrl, new NvdaScreenReader(), strategies, page);
    await pageSession.startSession();
    const result = await pageSession.run();

    // Run every registered check. axe-core drives the live page, so this has to
    // happen before the connection is closed.
    const checkResults = await runChecks({ strategyResults: result.results, page: result.page });
    const allViolations = collectViolations(checkResults);

    // Write audit data to files
    const fs = await import('fs/promises');
    const path = await import('path');

    const violationsPath = path.join(outputDir, 'violations.json');
    const transcriptPath = path.join(outputDir, 'transcript.json');

    await fs.writeFile(violationsPath, JSON.stringify(allViolations, null, 2), 'utf-8');
    await fs.writeFile(transcriptPath, JSON.stringify(result.results, null, 2), 'utf-8');
    console.log('\nAudit data written to:');
    console.log(`  - ${violationsPath} (all violations for reporting)`);
    console.log(`  - ${transcriptPath} (strategy results for HTML report)`);

    const promptBuilder = createPromptBuilder({
        transcript: {
            includeHtmlSnippets: true,
            includeAxNodes: true,
            maxHtmlSnippetLength: 500,
        },
        violations: {
            includeHtmlSnippets: true,
            includeCorrelations: true,
            groupByRule: true,
            maxViolationsPerGroup: 5,
        },
    });

    await promptBuilder.withPage(result.page);
    const prompt = promptBuilder.withStrategyResults(result.results).withViolations(allViolations).build();

    await pageSession.endEndSession();
    await chromeDevToolsProtocolConnection.disconnect();

    console.log('\n=== LLM Prompt Generated ===');
    console.log(`Transcript: ${prompt.metadata.totalStrategies} strategies, ${prompt.metadata.totalSteps} steps`);
    console.log(`Violations: ${prompt.metadata.totalViolations} total`);
    console.log(`System prompt: ${prompt.metadata.systemPromptLength} chars`);
    console.log(`User prompt: ${prompt.metadata.userPromptLength} chars`);
    console.log(`Combined prompt: ${prompt.metadata.combinedPromptLength} chars`);
    console.log(`Estimated tokens: ~${prompt.metadata.estimatedTokens}`);

    // Write prompts to files
    const systemPromptPath = path.join(outputDir, 'llm-prompt-system.txt');
    const userPromptPath = path.join(outputDir, 'llm-prompt-user.txt');
    const combinedPromptPath = path.join(outputDir, 'llm-prompt-combined.txt');
    const transcriptReadablePath = path.join(outputDir, 'transcript-readable.txt');

    await fs.writeFile(systemPromptPath, prompt.system, 'utf-8');
    await fs.writeFile(userPromptPath, prompt.user, 'utf-8');
    await fs.writeFile(combinedPromptPath, prompt.combined, 'utf-8');

    // Write transcript in human-readable text format
    const transcriptData = promptBuilder.getTranscriptData();
    const transcriptText = formatTranscriptAsText(transcriptData);
    await fs.writeFile(transcriptReadablePath, transcriptText, 'utf-8');

    console.log('\nPrompts written to:');
    console.log(`  - ${systemPromptPath} (system prompt for API use)`);
    console.log(`  - ${userPromptPath} (user prompt for API use)`);
    console.log(`  - ${combinedPromptPath} (copy-paste this into AI chat)`);
    console.log(`  - ${transcriptReadablePath} (human-readable transcript)`);

    const totals = summarizeViolations(allViolations);

    console.log('\n=== Analysis Complete ===');
    console.log(`Total violations found: ${totals.total}`);
    console.log(`Checks run: ${checkResults.length}`);
    console.log(`  By tool:`, totals.byTool);

    console.log('\nViolations by check:');
    for (const { check, violations } of checkResults) {
        console.log(`  ${check.name}: ${violations.length}`);
    }

    console.log('\nViolations by impact:', totals.byImpact);
    console.log('Violations by rule:', totals.byRule);

    if (options.verbose) {
        // Output detailed violations
        console.log('\n=== Detailed Violations ===');
        console.log(JSON.stringify(allViolations, null, 2));
    }
} finally {
    chromeDevToolsProtocolConnection?.disconnect();
}
