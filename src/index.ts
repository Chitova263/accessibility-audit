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
import { collectViolations, runChecks, summarizeViolations } from './analysis';
import { createPromptBuilder } from './llm/prompt-builder';
import { formatTranscriptAsText, generateReportFromFiles } from './reporting';
import { ArrowNavigationStrategy } from './screen-reader/navigation-strategy/browse-mode-strategies/arrow-navigation-strategy';

await generateReportFromFiles({
    llmResponsePath: './llm-response.json',
    violationsPath: './violations.json',
    transcriptPath: './transcript.json',
    pageUrl: 'https://www.swisscom.ch/tv-subscription-center-web/step/1',
    pageTitle: 'TV Subscription Center',
    format: 'html',
    outputPath: './report.html',
});

let chromeDevToolsProtocolConnection: ChromeDevToolsProtocolConnection | undefined = undefined;
try {
    chromeDevToolsProtocolConnection = ChromeDevToolsProtocolConnection.createConnection();
    await chromeDevToolsProtocolConnection.connect();
    const strategies: INavigationStrategy[] = [
        new HeadingNavigationStrategy({ maxSteps: 100 }),
        new LandmarkNavigationStrategy({ maxSteps: 100 }),
        new ButtonNavigationStrategy({ maxSteps: 100 }),
        new LinkNavigationStrategy({ maxSteps: 500 }),
        new HeadingHierarchyNavigationStrategy({ maxSteps: 500, level: 1 }),
        new HeadingHierarchyNavigationStrategy({ maxSteps: 500, level: 2 }),
        new HeadingHierarchyNavigationStrategy({ maxSteps: 500, level: 3 }),
        new HeadingHierarchyNavigationStrategy({ maxSteps: 500, level: 4 }),
        new HeadingHierarchyNavigationStrategy({ maxSteps: 500, level: 5 }),
        new HeadingHierarchyNavigationStrategy({ maxSteps: 500, level: 6 }),
        new ArrowNavigationStrategy({ maxSteps: 500 }),
        new TabNavigationStrategy({ maxSteps: 500 }),
    ];
    const url = 'https://www.swisscom.ch/de/privatkunden/mobile-handy-abo.html';
    let chTvSubscriptionCenterWebStep1 = 'https://www.swisscom.ch/tv-subscription-center-web/step/1';
    const pageUrl = new URL('https://www.swisscom.ch/myswisscom/benefits/overview');
    const pageSession = new PageSession(pageUrl, new NvdaScreenReader(), strategies, chromeDevToolsProtocolConnection);
    await pageSession.startSession();
    const result = await pageSession.run();

    // Run every registered check. axe-core drives the live page, so this has to
    // happen before the connection is closed.
    const checkResults = await runChecks({ strategyResults: result.results, page: result.page });
    const allViolations = collectViolations(checkResults);

    // Write audit data to files
    const fs = await import('fs/promises');
    await fs.writeFile('violations.json', JSON.stringify(allViolations, null, 2), 'utf-8');
    await fs.writeFile('transcript.json', JSON.stringify(result.results, null, 2), 'utf-8');
    console.log('\nAudit data written to:');
    console.log('  - llm-response.json (LLM analysis result)');
    console.log('  - violations.json (all violations for reporting)');
    console.log('  - transcript.json (strategy results for HTML report)');

    // ==========================================================================
    // Build LLM Prompt (for reference/debugging)
    // ==========================================================================

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
    await fs.writeFile('llm-prompt-system.txt', prompt.system, 'utf-8');
    await fs.writeFile('llm-prompt-user.txt', prompt.user, 'utf-8');
    await fs.writeFile('llm-prompt-combined.txt', prompt.combined, 'utf-8');

    // Write transcript in human-readable text format
    const transcriptData = promptBuilder.getTranscriptData();
    const transcriptText = formatTranscriptAsText(transcriptData);
    await fs.writeFile('transcript-readable.txt', transcriptText, 'utf-8');

    console.log('\nPrompts written to:');
    console.log('  - llm-prompt-system.txt (system prompt for API use)');
    console.log('  - llm-prompt-user.txt (user prompt for API use)');
    console.log('  - llm-prompt-combined.txt (copy-paste this into AI chat)');
    console.log('  - transcript-readable.txt (human-readable transcript)');

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

    // Output detailed violations
    console.log('\n=== Detailed Violations ===');
    console.log(JSON.stringify(allViolations, null, 2));
} finally {
    chromeDevToolsProtocolConnection?.disconnect();
}
