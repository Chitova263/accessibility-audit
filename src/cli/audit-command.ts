#!/usr/bin/env node
import { program } from 'commander';
import { AuditSession } from '../screen-reader/audit-session';
import { DEFAULT_CDP_PORT, type BrowserSource } from '../screen-reader/browser-target';
import type { NavigationStrategy } from '../screen-reader/strategies/navigation-strategy';
import { TabNavigationStrategy } from '../screen-reader/strategies/tab-navigation-strategy';
import { summarizeViolations } from '../analysis/utils/summarize-violations';
import { createPromptBuilder } from '../llm/prompt-builder';
import { formatTranscriptAsText } from '../reporting/transcript-text-formatter';
import { Logger } from '../utils/logger';
import { resolveOutputDir } from '../utils/output-dir';
import { parseAuditInput } from './schemas';
import { HeadingHierarchyNavigationStrategy } from '../screen-reader/strategies/heading-hierarchy-navigation-strategy';
import { LinkNavigationStrategy } from '../screen-reader/strategies/link-navigation-strategy';
import { ButtonNavigationStrategy } from '../screen-reader/strategies/button-navigation-strategy';
import { LandmarkNavigationStrategy } from '../screen-reader/strategies/landmark-navigation-strategy';
import { HeadingNavigationStrategy } from '../screen-reader/strategies/heading-navigation-strategy';
import { DownArrowNavigationStrategy } from '../screen-reader/strategies/down-arrow-navigation-strategy';

program
    .name('ally audit')
    .description('Run accessibility audit on a given URL')
    .argument('<url>', 'URL to audit')
    .option('-o, --output-dir <dir>', 'Output directory for audit files')
    .option('--max-steps <number>', 'Maximum steps per strategy')
    .option('-r, --reader <type>', 'Screen reader: nvda, virtual, or voiceover (required)')
    .option('--launch', 'Start a dedicated browser instead of attaching to a running Chrome')
    .option('--port <number>', `Chrome remote-debugging port to attach to (default: ${DEFAULT_CDP_PORT})`)
    .option('-v, --verbose', 'Enable verbose output')
    .action(() => {})
    .parse();

const { url, options } = parseAuditInput(program.processedArgs[0] as string | undefined, program.opts());

Logger.setLevel(options.verbose ? 'debug' : 'info');

const browserSource: BrowserSource = options.launch
    ? { mode: 'launch' }
    : { mode: 'connect', ...(options.port !== undefined ? { port: options.port } : {}) };

const outputDir = await resolveOutputDir({
    ...(options.outputDir ? { explicitDir: options.outputDir } : {}),
    url,
});

let session: AuditSession | undefined;

try {
    Logger.section('Starting Accessibility Audit');
    Logger.info(`Target URL: ${url}`);
    Logger.info(`Screen reader: ${options.reader}`);
    Logger.info(
        browserSource.mode === 'launch'
            ? 'Browser: launching a dedicated instance'
            : `Browser: attaching to Chrome on port ${options.port ?? DEFAULT_CDP_PORT}`
    );
    Logger.debug(`Output directory: ${outputDir}`);
    Logger.debug(`Max steps per strategy: ${options.maxSteps}`);

    const strategies: NavigationStrategy[] = [
        new HeadingNavigationStrategy({ maxSteps: Math.min(100, options.maxSteps) }),
        new LandmarkNavigationStrategy({ maxSteps: Math.min(100, options.maxSteps) }),
        new ButtonNavigationStrategy({ maxSteps: Math.min(100, options.maxSteps) }),
        new LinkNavigationStrategy({ maxSteps: options.maxSteps }),
        new HeadingHierarchyNavigationStrategy({ maxSteps: options.maxSteps, level: 1 }),
        new HeadingHierarchyNavigationStrategy({ maxSteps: options.maxSteps, level: 2 }),
        new HeadingHierarchyNavigationStrategy({ maxSteps: options.maxSteps, level: 3 }),
        new HeadingHierarchyNavigationStrategy({ maxSteps: options.maxSteps, level: 4 }),
        new HeadingHierarchyNavigationStrategy({ maxSteps: options.maxSteps, level: 5 }),
        new HeadingHierarchyNavigationStrategy({ maxSteps: options.maxSteps, level: 6 }),
        new DownArrowNavigationStrategy({ maxSteps: 1000 }),
        new TabNavigationStrategy({ maxSteps: options.maxSteps }),
    ];

    session = await AuditSession.create({
        url,
        screenReader: options.reader,
        strategies,
        outputDir,
        browser: browserSource,
    });

    const result = await session.run();

    const fs = await import('fs/promises');
    const path = await import('path');

    const violationsPath = path.join(outputDir, 'violations.json');
    const transcriptPath = path.join(outputDir, 'transcript.json');

    await fs.writeFile(violationsPath, JSON.stringify(result.violations, null, 2), 'utf-8');
    await fs.writeFile(transcriptPath, JSON.stringify(result.transcript, null, 2), 'utf-8');

    Logger.info('Audit data written:');
    Logger.info(`  - ${violationsPath}`);
    Logger.info(`  - ${transcriptPath}`);

    const promptBuilder = createPromptBuilder({
        screenReader: options.reader,
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

    promptBuilder.withPageContext({ url: result.url, title: result.title });
    const prompt = promptBuilder.withStrategyResults(result.transcript).withViolations(result.violations).build();

    Logger.section('LLM Prompt Generated');
    Logger.info(`Transcript: ${prompt.metadata.totalStrategies} strategies, ${prompt.metadata.totalSteps} steps`);
    Logger.info(`Violations: ${prompt.metadata.totalViolations} total`);
    Logger.debug(`System prompt: ${prompt.metadata.systemPromptLength} chars`);
    Logger.debug(`User prompt: ${prompt.metadata.userPromptLength} chars`);
    Logger.debug(`Combined prompt: ${prompt.metadata.combinedPromptLength} chars`);
    Logger.debug(`Estimated tokens: ~${prompt.metadata.estimatedTokens}`);

    const systemPromptPath = path.join(outputDir, 'llm-prompt-system.txt');
    const userPromptPath = path.join(outputDir, 'llm-prompt-user.txt');
    const combinedPromptPath = path.join(outputDir, 'llm-prompt-combined.txt');
    const transcriptReadablePath = path.join(outputDir, 'transcript-readable.txt');

    await fs.writeFile(systemPromptPath, prompt.system, 'utf-8');
    await fs.writeFile(userPromptPath, prompt.user, 'utf-8');
    await fs.writeFile(combinedPromptPath, prompt.combined, 'utf-8');

    const transcriptData = promptBuilder.getTranscriptData();
    const transcriptText = formatTranscriptAsText(transcriptData);
    await fs.writeFile(transcriptReadablePath, transcriptText, 'utf-8');

    Logger.info('Prompts written:');
    Logger.info(`  - ${systemPromptPath}`);
    Logger.info(`  - ${userPromptPath}`);
    Logger.info(`  - ${combinedPromptPath}`);
    Logger.info(`  - ${transcriptReadablePath}`);

    const totals = summarizeViolations(result.violations);

    Logger.section('Analysis Complete');
    Logger.info(`Total violations found: ${totals.total}`);
    Logger.info('Violations by impact:', totals.byImpact);
    Logger.debug('By tool:', totals.byTool);
    Logger.debug('Violations by rule:', totals.byRule);

    if (options.verbose) {
        Logger.section('Detailed Violations');
        console.log(JSON.stringify(result.violations, null, 2));
    }
} catch (error) {
    // Setup failures (no browser on the port, unreachable URL) are user-actionable,
    // so lead with the message and keep the stack for --verbose.
    Logger.error(error instanceof Error ? error.message : 'Audit failed', options.verbose ? error : undefined);
    process.exit(1);
} finally {
    await session?.close();
}
