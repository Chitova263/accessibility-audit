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
import {
    analyzeAriaHiddenFocusable,
    analyzeContentGrouping,
    analyzeEmptyAccessibleNames,
    analyzeFocusOrder,
    analyzeFocusTraps,
    analyzeFormLabels,
    analyzeHeadingStructure,
    analyzeImageAltText,
    analyzeKeyboardAccessibility,
    analyzeLandmarkStructure,
    analyzeLinkText,
    analyzeNavigationSize,
    analyzeRoleMismatch,
    analyzeSkipLink,
    analyzeWithAxeCore,
} from './analysis';
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
    const pageUrl = new URL(url);
    const pageSession = new PageSession(pageUrl, new NvdaScreenReader(), strategies, chromeDevToolsProtocolConnection);
    await pageSession.startSession();
    const result = await pageSession.run();

    // Run axe-core analysis on the page (must be before disconnect)
    const axeCoreResults = await analyzeWithAxeCore(result.page);

    // Run all NVDA analyzers on the results
    const analysisResults = {
        emptyAccessibleNames: analyzeEmptyAccessibleNames(result.results),
        headingStructure: analyzeHeadingStructure(result.results),
        landmarkStructure: analyzeLandmarkStructure(result.results),
        linkText: analyzeLinkText(result.results),
        focusTraps: analyzeFocusTraps(result.results),
        keyboardAccessibility: analyzeKeyboardAccessibility(result.results),
        imageAltText: analyzeImageAltText(result.results),
        roleMismatch: analyzeRoleMismatch(result.results),
        focusOrder: analyzeFocusOrder(result.results),
        skipLink: analyzeSkipLink(result.results),
        formLabels: analyzeFormLabels(result.results),
        ariaHiddenFocusable: analyzeAriaHiddenFocusable(result.results),
        navigationSize: analyzeNavigationSize(result.results),
        contentGrouping: analyzeContentGrouping(result.results),
        axeCore: axeCoreResults,
    };

    // Collect all NVDA violations
    const nvdaViolations = [
        ...analysisResults.emptyAccessibleNames.violations,
        ...analysisResults.headingStructure.violations,
        ...analysisResults.landmarkStructure.violations,
        ...analysisResults.linkText.violations,
        ...analysisResults.focusTraps.violations,
        ...analysisResults.keyboardAccessibility.violations,
        ...analysisResults.imageAltText.violations,
        ...analysisResults.roleMismatch.violations,
        ...analysisResults.focusOrder.violations,
        ...analysisResults.skipLink.violations,
        ...analysisResults.formLabels.violations,
        ...analysisResults.ariaHiddenFocusable.violations,
        ...analysisResults.navigationSize.violations,
        ...analysisResults.contentGrouping.violations,
    ];

    // Combine all violations
    const allViolations = [...nvdaViolations, ...analysisResults.axeCore.violations];

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

    console.log('\n=== Analysis Complete ===');
    console.log(`Total violations found: ${allViolations.length}`);
    console.log(`  NVDA violations: ${nvdaViolations.length}`);
    console.log(`  axe-core violations: ${analysisResults.axeCore.violations.length}`);

    console.log('\nNVDA violations by analyzer:');
    console.log(`  Empty Accessible Names: ${analysisResults.emptyAccessibleNames.violations.length}`);
    console.log(`  Heading Structure: ${analysisResults.headingStructure.violations.length}`);
    console.log(`  Landmark Structure: ${analysisResults.landmarkStructure.violations.length}`);
    console.log(`  Link Text: ${analysisResults.linkText.violations.length}`);
    console.log(`  Focus Traps: ${analysisResults.focusTraps.violations.length}`);
    console.log(`  Keyboard Accessibility: ${analysisResults.keyboardAccessibility.violations.length}`);
    console.log(`  Image Alt Text: ${analysisResults.imageAltText.violations.length}`);
    console.log(`  Role Mismatch: ${analysisResults.roleMismatch.violations.length}`);
    console.log(`  Focus Order: ${analysisResults.focusOrder.violations.length}`);
    console.log(`  Skip Link: ${analysisResults.skipLink.violations.length}`);
    console.log(`  Form Labels: ${analysisResults.formLabels.violations.length}`);
    console.log(`  Aria Hidden Focusable: ${analysisResults.ariaHiddenFocusable.violations.length}`);
    console.log(`  Navigation Size: ${analysisResults.navigationSize.violations.length}`);
    console.log(`  Content Grouping: ${analysisResults.contentGrouping.violations.length}`);

    console.log('\naxe-core summary:');
    console.log(`  By impact:`, analysisResults.axeCore.summary.byImpact);
    console.log(`  By rule:`, analysisResults.axeCore.summary.byRule);

    // Output detailed violations
    console.log('\n=== Detailed Violations ===');
    console.log(JSON.stringify(allViolations, null, 2));
} finally {
    chromeDevToolsProtocolConnection?.disconnect();
}
