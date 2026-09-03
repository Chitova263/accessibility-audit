export {
    createPromptBuilder,
    buildAccessibilityPrompt,
    type AccessibilityPromptConfig,
    type BuiltPrompt,
} from './llm/prompt-builder';

export { runRules, getRuleById, type RunResult } from './analysis/rules/runner';

export { summarizeViolations } from './analysis/utils/summarize-violations';

export type { Violation } from './analysis/core/violation';
export type { Rule, RuleMeta, RuleResult } from './analysis/core/rule';

export { AuditSession, type AuditSessionConfig, type AuditResult } from './screen-reader/audit-session';
export {
    BrowserTarget,
    DEFAULT_CDP_PORT,
    type BrowserTargetOptions,
    type BrowserSource,
} from './screen-reader/browser-target';
export { ScreenReaderSession } from './screen-reader/screen-reader-session';

export { Nvda, getScreenReaderDisplayName } from './screen-reader/drivers/nvda';
export type { ScreenReader, ScreenReaderType } from './screen-reader/drivers/nvda';
export { VirtualScreenReader } from './screen-reader/drivers/virtual';
export { createReader } from './screen-reader/drivers/factory';
export { getProfile } from './screen-reader/config';
export { NavigationIterable } from './screen-reader/navigation-iterable';
export { VirtualCursor } from './screen-reader/virtual-cursor';
export { nvdaProfile } from './screen-reader/config/nvda';
export { virtualProfile } from './screen-reader/config/virtual';
export type { NavigationItem, NavigatorConfig, NavigationMode, ScreenReaderProfile } from './screen-reader/types';

export type {
    NavigationStrategy,
    NavigationStep,
    StrategyResult,
    NavigationStrategyMetadata,
} from './screen-reader/strategies/navigation-strategy';

export { HeadingNavigationStrategy } from './screen-reader/strategies/heading-navigation-strategy';
export { LandmarkNavigationStrategy } from './screen-reader/strategies/landmark-navigation-strategy';
export { ButtonNavigationStrategy } from './screen-reader/strategies/button-navigation-strategy';
export { LinkNavigationStrategy } from './screen-reader/strategies/link-navigation-strategy';
export { HeadingHierarchyNavigationStrategy } from './screen-reader/strategies/heading-hierarchy-navigation-strategy';
export { DownArrowNavigationStrategy } from './screen-reader/strategies/down-arrow-navigation-strategy';
export { TabNavigationStrategy } from './screen-reader/strategies/tab-navigation-strategy';

export { formatTranscriptAsText } from './reporting/transcript-text-formatter';

export { Logger, type LogLevel, type LoggerOptions, type ContextLogger } from './utils/logger';
