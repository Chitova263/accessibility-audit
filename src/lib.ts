/**
 * Accessibility Audit Library
 *
 * Main entry point for library consumers.
 */

// =============================================================================
// Audit (high-level API)
// =============================================================================
export { auditPage, quickAudit, type AuditConfig, type AuditResult } from './audit';

// =============================================================================
// LLM Client
// =============================================================================
export {
    createAnthropicClient,
    LlmError,
    type LlmClient,
    type LlmRequest,
    type LlmResponse,
    type LlmErrorCode,
    type AnthropicClientConfig,
} from './llm/client';

// =============================================================================
// Prompt Builder
// =============================================================================
export {
    createPromptBuilder,
    buildAccessibilityPrompt,
    type AccessibilityPromptConfig,
    type BuiltPrompt,
} from './llm/prompt-builder';

// =============================================================================
// Analysis
// =============================================================================
export {
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
    type Violation,
} from './analysis';

// =============================================================================
// Screen Reader & Navigation
// =============================================================================
export { PageSession } from './screen-reader/page-session';
export { NvdaScreenReader } from './screen-reader/nvda-screen-reader';
export { ChromeDevToolsProtocolConnection } from './chrome-dev-tools-protocol-connection';

export type {
    INavigationStrategy,
    NavigationStep,
    StrategyResult,
    StrategyMetadata,
} from './screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';

// Navigation Strategies
export { HeadingNavigationStrategy } from './screen-reader/navigation-strategy/browse-mode-strategies/heading-navigation-strategy';
export { LandmarkNavigationStrategy } from './screen-reader/navigation-strategy/browse-mode-strategies/landmark-navigation-strategy';
export { ButtonNavigationStrategy } from './screen-reader/navigation-strategy/browse-mode-strategies/button-navigation-strategy';
export { LinkNavigationStrategy } from './screen-reader/navigation-strategy/browse-mode-strategies/link-navigation-strategy';
export { HeadingHierarchyNavigationStrategy } from './screen-reader/navigation-strategy/browse-mode-strategies/heading-hierarchy-navigation-strategy';
export { ArrowNavigationStrategy } from './screen-reader/navigation-strategy/browse-mode-strategies/arrow-navigation-strategy';
export { TabNavigationStrategy } from './screen-reader/navigation-strategy/focus-mode-strategies/tab-navigation-strategy';

// =============================================================================
// Reporting
// =============================================================================
export { formatTranscriptAsText } from './reporting';
