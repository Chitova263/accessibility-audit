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
    analyzeAriaHiddenFocusable,
    analyzeArrowNavigation,
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
    type ArrowNavigationAnalysisResult,
    type Violation,
} from './analysis';

export { PageSession } from './screen-reader/page-session';
export { NvdaScreenReader } from './screen-reader/nvda-screen-reader';
export { ChromeDevToolsProtocolConnection } from './chrome-dev-tools-protocol-connection';

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
export { ArrowNavigationStrategy } from './screen-reader/navigation-strategy/browse-mode-strategies/arrow-navigation-strategy';
export { TabNavigationStrategy } from './screen-reader/navigation-strategy/focus-mode-strategies/tab-navigation-strategy';

export { formatTranscriptAsText } from './reporting';
