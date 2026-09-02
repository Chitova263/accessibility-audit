/**
 * Accessibility Audit Library
 *
 * Main entry point for library consumers.
 */

export {
    createPromptBuilder,
    buildAccessibilityPrompt,
    type AccessibilityPromptConfig,
    type BuiltPrompt,
} from './llm/prompt-builder';

export {
    // Rules runner
    runRules,
    getRuleById,
    ALL_RULES,
    type RunResult,
    // Utilities
    summarizeViolations,
    // Core types
    type Violation,
    type Rule,
    type RuleMeta,
    type RuleResult,
} from './analysis';

export { PageSession } from './screen-reader/page-session';
export { ChromeDevToolsProtocolConnection } from './chrome-dev-tools-protocol-connection';

// New screen reader architecture
export {
    Nvda,
    type ScreenReader,
    type ScreenReaderName,
    getScreenReaderDisplayName,
} from './screen-reader/drivers/nvda';
export { VirtualScreenReader } from './screen-reader/drivers/virtual';
export {
    createDriver,
    type ScreenReaderType,
    type DriverConfig,
    type CreateDriverOptions,
} from './screen-reader/drivers/factory';
export { ElementNavigator } from './screen-reader/navigators/element-navigator/element-navigator';
export { TabNavigator } from './screen-reader/navigators/tab-navigator/tab-navigator';
export { DownArrowNavigator } from './screen-reader/navigators/down-arrow-navigator/down-arrow-navigator';
export { Navigator } from './screen-reader/navigators/navigator';
export { nvdaKeyBindings, nvdaEndDetection } from './screen-reader/navigators/config/nvda';
export { virtualKeyBindings, virtualEndDetection } from './screen-reader/navigators/config/virtual';
export type {
    NavigationItem,
    NavigatorConfig,
    IElementNavigator,
    ScreenReaderConfig,
} from './screen-reader/navigators/types';

export type {
    INavigationStrategy,
    NavigationStep,
    StrategyResult,
    StrategyMetadata,
} from './screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';

export { HeadingNavigationStrategy } from './screen-reader/navigation-strategy/browse-mode-strategies/heading-navigation-strategy';
export { LandmarkNavigationStrategy } from './screen-reader/navigation-strategy/browse-mode-strategies/landmark-navigation-strategy';
export { ButtonNavigationStrategy } from './screen-reader/navigation-strategy/browse-mode-strategies/button-navigation-strategy';
export { LinkNavigationStrategy } from './screen-reader/navigation-strategy/browse-mode-strategies/link-navigation-strategy';
export { HeadingHierarchyNavigationStrategy } from './screen-reader/navigation-strategy/browse-mode-strategies/heading-hierarchy-navigation-strategy';
export { DownArrowNavigationStrategy } from './screen-reader/navigation-strategy/browse-mode-strategies/down-arrow-navigation-strategy';
export { TabNavigationStrategy } from './screen-reader/navigation-strategy/focus-mode-strategies/tab-navigation-strategy';

export { formatTranscriptAsText } from './reporting';

// Utilities
export { Logger, type LogLevel, type LoggerOptions, type ContextLogger } from './utils/logger';
