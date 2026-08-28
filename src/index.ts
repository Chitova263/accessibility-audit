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
        new TabNavigationStrategy({ maxSteps: 500 }),
    ];
    const url = 'https://www.swisscom.ch/de/privatkunden/mobile-handy-abo.html';
    const pageUrl = new URL('https://www.swisscom.ch/tv-subscription-center-web/step/1');
    const pageSession = new PageSession(pageUrl, new NvdaScreenReader(), strategies, chromeDevToolsProtocolConnection);
    await pageSession.startSession();
    const result = await pageSession.run();

    // Run axe-core analysis on the page (must be before disconnect)
    const axeCoreResults = await analyzeWithAxeCore(result.page);

    await pageSession.endEndSession();
    await chromeDevToolsProtocolConnection.disconnect();

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
    ];

    // Combine all violations
    const allViolations = [...nvdaViolations, ...analysisResults.axeCore.violations];

    console.log('=== Analysis Complete ===');
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

    console.log('\naxe-core summary:');
    console.log(`  By impact:`, analysisResults.axeCore.summary.byImpact);
    console.log(`  By rule:`, analysisResults.axeCore.summary.byRule);

    // Output detailed violations
    console.log('\n=== Detailed Violations ===');
    console.log(JSON.stringify(allViolations, null, 2));
} finally {
    chromeDevToolsProtocolConnection?.disconnect();
}
