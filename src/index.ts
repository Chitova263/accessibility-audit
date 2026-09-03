// Analysis - Core types
export type {
    Violation,
    ScreenReaderViolation,
    ScreenReaderContext,
    AxeViolation,
    AxeContext,
    AxeNode,
    WcagCriterion,
    Impact,
} from './analysis/core/violation';
export { isScreenReaderViolation } from './analysis/core/violation';
export type { AuditContext } from './analysis/core/context';
export type { Rule, RuleMeta, RuleResult } from './analysis/core/rule';

// Analysis - Rule catalog and runner
export { RULES, RULE_IDS, getRule, ruleSupportsScreenshot } from './analysis/rules/rule-catalog';
export type { RuleId, RuleDefinition } from './analysis/rules/rule-catalog';
export { RULES as ALL_RULES, runRules, getRuleById } from './analysis/rules/runner';
export type { RunResult } from './analysis/rules/runner';

// Analysis - Utilities
export { summarizeViolations } from './analysis/utils/summarize-violations';
export type { ViolationTotals } from './analysis/utils/summarize-violations';
export { createScreenReaderContext } from './analysis/utils/tool-details';
export type { ContextSource } from './analysis/utils/tool-details';
export {
    captureScreenshotToFile,
    captureViewportWithHighlight,
    ensureScreenshotsDir,
    isScreenshotSuccess,
} from './analysis/utils/screenshot-capture';
export type {
    ScreenshotOptions,
    Screenshot,
    ScreenshotSuccess,
    ScreenshotFailure,
    BoundingBox,
} from './analysis/utils/screenshot-capture';

// Analysis - Individual rules (Heading Structure)
export { rule as emptyHeadingRule } from './analysis/rules/heading-structure/empty-heading/empty-heading';
export { rule as headingLevelSkippedRule } from './analysis/rules/heading-structure/heading-level-skipped/heading-level-skipped';
export { rule as missingH1Rule } from './analysis/rules/heading-structure/missing-h1/missing-h1';
export { rule as multipleH1Rule } from './analysis/rules/heading-structure/multiple-h1/multiple-h1';

// Analysis - Individual rules (Landmark Structure)
export { rule as duplicateLandmarkRule } from './analysis/rules/landmark-structure/duplicate-landmark/duplicate-landmark';
export { rule as missingMainLandmarkRule } from './analysis/rules/landmark-structure/missing-main-landmark/missing-main-landmark';

// Analysis - Individual rules (Focus and Keyboard)
export { rule as buttonNotInTabOrderRule } from './analysis/rules/focus-and-keyboard/button-not-in-tab-order/button-not-in-tab-order';
export { rule as focusOrderAnomalyRule } from './analysis/rules/focus-and-keyboard/focus-order-anomaly/focus-order-anomaly';
export { rule as focusTrapRule } from './analysis/rules/focus-and-keyboard/focus-trap/focus-trap';
export { rule as linkNotInTabOrderRule } from './analysis/rules/focus-and-keyboard/link-not-in-tab-order/link-not-in-tab-order';
export { rule as positiveTabindexRule } from './analysis/rules/focus-and-keyboard/positive-tabindex/positive-tabindex';

// Analysis - Individual rules (Link Text)
export { rule as duplicateLinkTextRule } from './analysis/rules/link-text/duplicate-link-text/duplicate-link-text';
export { rule as genericLinkTextRule } from './analysis/rules/link-text/generic-link-text/generic-link-text';

// Analysis - Individual rules (Content Structure)
export { rule as contentDensityPerRegionRule } from './analysis/rules/content-structure/content-density-per-region/content-density-per-region';
export { rule as excessiveNavigationLinksRule } from './analysis/rules/content-structure/excessive-navigation-links/excessive-navigation-links';
export { rule as excessiveRepetitionRule } from './analysis/rules/content-structure/excessive-repetition/excessive-repetition';
export { rule as landmarkWithoutHeadingRule } from './analysis/rules/content-structure/landmark-without-heading/landmark-without-heading';
export { rule as largeContentGapRule } from './analysis/rules/content-structure/large-content-gap/large-content-gap';
export { rule as readingOrderLandmarkSequenceRule } from './analysis/rules/content-structure/reading-order-landmark-sequence/reading-order-landmark-sequence';
export { rule as repeatedPatternWithoutHeadingRule } from './analysis/rules/content-structure/repeated-pattern-without-heading/repeated-pattern-without-heading';
export { rule as stepsToMainContentRule } from './analysis/rules/content-structure/steps-to-main-content/steps-to-main-content';

// Analysis - Individual rules (Interactive Elements)
export { rule as ariaHiddenFocusableRule } from './analysis/rules/interactive-elements/aria-hidden-focusable/aria-hidden-focusable';
export { rule as emptyAccessibleNameRule } from './analysis/rules/interactive-elements/empty-accessible-name/empty-accessible-name';
export { rule as formFieldNoLabelRule } from './analysis/rules/interactive-elements/form-field-no-label/form-field-no-label';
export { rule as missingSkipLinkRule } from './analysis/rules/interactive-elements/missing-skip-link/missing-skip-link';

// Analysis - Individual rules (Semantic)
export { rule as filenameAsAltRule } from './analysis/rules/semantic/filename-as-alt/filename-as-alt';
export { rule as roleMismatchRule } from './analysis/rules/semantic/role-mismatch/role-mismatch';

// Analysis - axe-core
export { rule as axeCoreRule } from './analysis/rules/axe-core/axe-core';

// Reporting
export type { Reporter, ReportData, ReportOutput, ReportMeta, ReporterOptions } from './reporting/reporter';
export { generateFilename, formatTimestamp, escapeHtml, truncate } from './reporting/reporter';
export type { HtmlReporterOptions } from './reporting/reporters/html-reporter';
export { HtmlReporter, createHtmlReporter } from './reporting/reporters/html-reporter';
export type { JsonReporterOptions } from './reporting/reporters/json-reporter';
export { JsonReporter, createJsonReporter } from './reporting/reporters/json-reporter';
export { formatTranscriptAsText } from './reporting/transcript-text-formatter';
export {
    generateReportFromFiles,
    generateReport,
    type ReportFromFilesOptions,
    type ReportFromFilesResult,
} from './reporting/from-files';
export { getReporter } from './reporting/reporter-registry';

// LLM / Prompt Builder
export * from './llm/prompt-builder';

// Chrome DevTools Protocol
export * from './chrome-dev-tools-protocol-connection';

// Screen Reader Drivers
export {
    Nvda,
    type ScreenReader,
    type ScreenReaderName,
    getScreenReaderDisplayName,
} from './screen-reader/drivers/nvda';

// Screen Reader Navigators
export { BrowseModeElementNavigator } from './screen-reader/navigators/element-navigator/element-navigator';
export { TabNavigator } from './screen-reader/navigators/tab-navigator/tab-navigator';
export { DownArrowNavigator } from './screen-reader/navigators/down-arrow-navigator/down-arrow-navigator';
export { Navigator } from './screen-reader/navigators/navigator';
export type {
    NavigationItem,
    NavigatorConfig,
    ElementNavigator,
    NavigatorType,
    EndDetectionContext,
    ScreenReaderKeyBindings,
    ScreenReaderConfig,
} from './screen-reader/navigators/types';
export { nvdaKeyBindings, nvdaEndDetection } from './screen-reader/navigators/config/nvda';

// Page Session
export * from './screen-reader/page-session';

// Navigation Strategies
export { HeadingNavigationStrategy } from './screen-reader/navigation-strategy/browse-mode-strategies/heading-navigation-strategy';
export { LandmarkNavigationStrategy } from './screen-reader/navigation-strategy/browse-mode-strategies/landmark-navigation-strategy';
export { ButtonNavigationStrategy } from './screen-reader/navigation-strategy/browse-mode-strategies/button-navigation-strategy';
export { LinkNavigationStrategy } from './screen-reader/navigation-strategy/browse-mode-strategies/link-navigation-strategy';
export { HeadingHierarchyNavigationStrategy } from './screen-reader/navigation-strategy/browse-mode-strategies/heading-hierarchy-navigation-strategy';
export { DownArrowNavigationStrategy } from './screen-reader/navigation-strategy/browse-mode-strategies/down-arrow-navigation-strategy';
export { TabNavigationStrategy } from './screen-reader/navigation-strategy/focus-mode-strategies/tab-navigation-strategy';
export type { NavigationStrategy } from './screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';
