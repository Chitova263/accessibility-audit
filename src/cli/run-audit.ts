#!/usr/bin/env node
import { program } from 'commander';
import { createDriver } from '../screen-reader/drivers/factory';
import { Navigator } from '../screen-reader/navigators/navigator';
import { ChromeDevToolsProtocolConnection } from '../chrome-dev-tools-protocol-connection';
import type { INavigationStrategy } from '../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';
import { PageSession } from '../screen-reader/page-session';
import { HeadingNavigationStrategy } from '../screen-reader/navigation-strategy/browse-mode-strategies/heading-navigation-strategy';
import { LandmarkNavigationStrategy } from '../screen-reader/navigation-strategy/browse-mode-strategies/landmark-navigation-strategy';
import { ButtonNavigationStrategy } from '../screen-reader/navigation-strategy/browse-mode-strategies/button-navigation-strategy';
import { LinkNavigationStrategy } from '../screen-reader/navigation-strategy/browse-mode-strategies/link-navigation-strategy';
import { HeadingHierarchyNavigationStrategy } from '../screen-reader/navigation-strategy/browse-mode-strategies/heading-hierarchy-navigation-strategy';
import { TabNavigationStrategy } from '../screen-reader/navigation-strategy/focus-mode-strategies/tab-navigation-strategy';
import { DownArrowNavigationStrategy } from '../screen-reader/navigation-strategy/browse-mode-strategies/down-arrow-navigation-strategy';
import { runRules, summarizeViolations } from '../analysis';
import { ensureScreenshotsDir } from '../analysis/utils/screenshot-capture';
import { createPromptBuilder } from '../llm/prompt-builder';
import { formatTranscriptAsText } from '../reporting';
import { Logger } from '../utils/logger';
import { resolveOutputDir } from '../utils/output-dir';
import { parseAuditInput } from './schemas';

program
    .name('a11y audit')
    .description('Run accessibility audit on a given URL')
    .argument('<url>', 'URL to audit')
    .option('-o, --output-dir <dir>', 'Output directory for audit files')
    .option('--max-steps <number>', 'Maximum steps per strategy')
    .option('-r, --reader <type>', 'Screen reader: nvda, virtual, or voiceover (required)')
    .option('-s, --speech', 'Enable NVDA speech audio output')
    .option('-v, --verbose', 'Enable verbose output')
    .action(() => {})
    .parse();

const { url, options } = parseAuditInput(program.processedArgs[0], program.opts());

Logger.setLevel(options.verbose ? 'debug' : 'info');

const outputDir = await resolveOutputDir({
    ...(options.outputDir ? { explicitDir: options.outputDir } : {}),
    url,
});

let chromeDevToolsProtocolConnection: ChromeDevToolsProtocolConnection | undefined = undefined;

try {
    Logger.section('Starting Accessibility Audit');
    Logger.info(`Target URL: ${url}`);
    Logger.info(`Screen reader: ${options.reader}`);
    if (options.reader === 'nvda' || options.reader === 'voiceover') {
        Logger.info(`Speech: ${options.speech ? 'on' : 'off'}`);
    }
    Logger.debug(`Output directory: ${outputDir}`);
    Logger.debug(`Max steps per strategy: ${options.maxSteps}`);

    chromeDevToolsProtocolConnection = ChromeDevToolsProtocolConnection.createConnection();
    await chromeDevToolsProtocolConnection.connect();
    Logger.debug('Chrome DevTools Protocol connection established');

    const strategies: INavigationStrategy[] = [
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

    const pageUrl = new URL(url);
    const page = await chromeDevToolsProtocolConnection.goToPage(pageUrl);
    Logger.info('Page loaded');

    const driver = await createDriver({ type: options.reader, page, speech: options.speech });

    const navigator = Navigator.fromConfig({
        reader: driver.reader,
        keyBindings: driver.keyBindings,
        endDetection: driver.endDetection,
    });

    const pageSession = new PageSession(pageUrl, driver.reader, navigator, strategies, page);
    await pageSession.startSession();
    const result = await pageSession.run();

    const cdp = await result.page.context().newCDPSession(result.page);

    await cdp.send('DOM.enable');

    const screenshotsDir = await ensureScreenshotsDir(outputDir);

    // axe-core drives the live page, so rules must run before the connection is closed.
    Logger.section('Running Analysis Rules');
    const { violations: allViolations, byRule } = await runRules({
        transcript: result.results,
        page: result.page,
        cdp,
        screenshotsDir,
        screenReader: options.reader,
    });

    const fs = await import('fs/promises');
    const path = await import('path');

    const violationsPath = path.join(outputDir, 'violations.json');
    const transcriptPath = path.join(outputDir, 'transcript.json');

    await fs.writeFile(violationsPath, JSON.stringify(allViolations, null, 2), 'utf-8');
    await fs.writeFile(transcriptPath, JSON.stringify(result.results, null, 2), 'utf-8');

    Logger.info('Audit data written:');
    Logger.info(`  - ${violationsPath}`);
    Logger.info(`  - ${transcriptPath}`);

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

    await pageSession.endSession();

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

    const totals = summarizeViolations(allViolations);

    Logger.section('Analysis Complete');
    Logger.info(`Total violations found: ${totals.total}`);
    Logger.info(`Rules run: ${byRule.size}`);
    Logger.debug('By tool:', totals.byTool);
    Logger.info('Violations by impact:', totals.byImpact);
    Logger.debug('Violations by rule:', totals.byRule);

    if (options.verbose) {
        Logger.section('Detailed Violations');
        console.log(JSON.stringify(allViolations, null, 2));
    }
} catch (error) {
    Logger.error('Audit failed', error);
    process.exit(1);
} finally {
    if (chromeDevToolsProtocolConnection?.isConnected()) {
        chromeDevToolsProtocolConnection?.disconnect();
    }
}
