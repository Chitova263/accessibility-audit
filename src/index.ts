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

export { RULES, RULE_IDS, getRule, ruleSupportsScreenshot } from './analysis/rules/rule-catalog';
export type { RuleId, RuleDefinition } from './analysis/rules/rule-catalog';
export { runRules, getRuleById } from './analysis/rules/runner';
export type { RunResult } from './analysis/rules/runner';

export { summarizeViolations } from './analysis/utils/summarize-violations';
export type { ViolationTotals } from './analysis/utils/summarize-violations';
export { createScreenReaderContext } from './analysis/utils/tool-details';
export type { ContextSource } from './analysis/utils/tool-details';
export {
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

export * from './llm/prompt-builder';

// Primary API: AuditSession
export {
    AuditSession,
    type AuditSessionConfig,
    type AuditResult,
    type PageContext,
} from './screen-reader/audit-session';
export {
    BrowserTarget,
    DEFAULT_CDP_PORT,
    type BrowserTargetOptions,
    type BrowserSource,
} from './screen-reader/browser-target';
export { ScreenReaderSession } from './screen-reader/screen-reader-session';

// Screen reader types and utilities
export { Nvda, getScreenReaderDisplayName } from './screen-reader/drivers/nvda';
export type { ScreenReader, ScreenReaderType } from './screen-reader/drivers/nvda';

export { NavigationIterable } from './screen-reader/navigation-iterable';
export { VirtualCursor } from './screen-reader/virtual-cursor';
export type {
    NavigationItem,
    NavigatorConfig,
    NavigatorType,
    NavigationMode,
    NavigationEndContext,
    ScreenReaderProfile,
} from './screen-reader/types';
export { getProfile } from './screen-reader/config';
export { nvdaProfile } from './screen-reader/config/nvda';
export { createReader } from './screen-reader/drivers/factory';

export { HeadingNavigationStrategy } from './screen-reader/strategies/heading-navigation-strategy';
export { LandmarkNavigationStrategy } from './screen-reader/strategies/landmark-navigation-strategy';
export { ButtonNavigationStrategy } from './screen-reader/strategies/button-navigation-strategy';
export { LinkNavigationStrategy } from './screen-reader/strategies/link-navigation-strategy';
export { HeadingHierarchyNavigationStrategy } from './screen-reader/strategies/heading-hierarchy-navigation-strategy';
export { DownArrowNavigationStrategy } from './screen-reader/strategies/down-arrow-navigation-strategy';
export { TabNavigationStrategy } from './screen-reader/strategies/tab-navigation-strategy';
export type { NavigationStrategy } from './screen-reader/strategies/navigation-strategy';
