// Core types
export type {
    Violation,
    NvdaViolation,
    NvdaContext,
    AxeViolation,
    AxeContext,
    AxeNode,
    WcagCriterion,
    Impact,
} from './core/violation';
export { isNvdaViolation } from './core/violation';

export type { AuditContext } from './core/context';

// Rule catalog
export { RULES, RULE_IDS, getRule, ruleSupportsScreenshot } from './registry/rule-catalog';
export type { RuleId, RuleDefinition } from './registry/rule-catalog';

// Check registry
export { CHECKS, runChecks, collectViolations, summarizeViolations } from './registry/registry';
export type { Check, CheckOutput, CompletedCheck, ViolationTotals } from './registry/registry';

// Utils
export { createNvdaContext } from './utils/tool-details';
export type { ContextSource } from './utils/tool-details';

export { captureScreenshot } from './utils/screenshot-capture';
export type { ScreenshotOptions, Screenshot } from './utils/screenshot-capture';

// Analyzers
export { analyzeEmptyAccessibleNames } from './analyzers/empty-accessible-name/empty-accessible-name';
export type { EmptyAccessibleNameAnalyzerResult } from './analyzers/empty-accessible-name/empty-accessible-name';

export { analyzeHeadingStructure } from './analyzers/heading-structure/heading-structure';
export type { HeadingStructureAnalyzerResult } from './analyzers/heading-structure/heading-structure';

export { analyzeLandmarkStructure } from './analyzers/landmark-structure/landmark-structure';
export type { LandmarkStructureAnalyzerResult } from './analyzers/landmark-structure/landmark-structure';

export { analyzeLinkText } from './analyzers/link-text/link-text';
export type { LinkTextAnalyzerResult } from './analyzers/link-text/link-text';

export { analyzeFocusTraps } from './analyzers/focus-trap/focus-trap';
export type { FocusTrapAnalyzerResult } from './analyzers/focus-trap/focus-trap';

export { analyzeKeyboardAccessibility } from './analyzers/keyboard-accessibility/keyboard-accessibility';
export type { KeyboardAccessibilityAnalyzerResult } from './analyzers/keyboard-accessibility/keyboard-accessibility';

export { analyzeImageAltText } from './analyzers/image-alt-text/image-alt-text';
export type { ImageAltTextAnalyzerResult } from './analyzers/image-alt-text/image-alt-text';

export { analyzeRoleMismatch } from './analyzers/role-mismatch/role-mismatch';
export type { RoleMismatchAnalyzerResult } from './analyzers/role-mismatch/role-mismatch';

export { analyzeFocusOrder } from './analyzers/focus-order/focus-order';
export type { FocusOrderAnalyzerResult } from './analyzers/focus-order/focus-order';

export { analyzeSkipLink } from './analyzers/skip-link/skip-link';
export type { SkipLinkAnalyzerResult } from './analyzers/skip-link/skip-link';

export { analyzeFormLabels } from './analyzers/form-labels/form-labels';
export type { FormLabelsAnalyzerResult } from './analyzers/form-labels/form-labels';

export { analyzeAriaHiddenFocusable } from './analyzers/aria-hidden-focusable/aria-hidden-focusable';
export type { AriaHiddenFocusableAnalyzerResult } from './analyzers/aria-hidden-focusable/aria-hidden-focusable';

export { analyzeNavigationSize } from './analyzers/navigation-size/navigation-size';
export type { NavigationSizeAnalyzerResult } from './analyzers/navigation-size/navigation-size';

export { analyzeContentGrouping } from './analyzers/content-grouping/content-grouping';
export type {
    ContentGroupingAnalyzerResult,
    ContentGroupingOptions,
} from './analyzers/content-grouping/content-grouping';

export { analyzeWithAxeCore } from './analyzers/axe-core/axe-core';
export type { AxeCoreAnalyzerResult } from './analyzers/axe-core/axe-core';

export {
    analyzeStepsToMainContent,
    analyzeReadingOrderLandmarkSequence,
    analyzeExcessiveRepetition,
    analyzeContentDensityPerRegion,
    analyzeArrowNavigation,
} from './analyzers/arrow-navigation/arrow-navigation';
export type {
    StepsToMainContentResult,
    StepsToMainContentSummary,
    ReadingOrderLandmarkSequenceResult,
    ReadingOrderLandmarkSequenceSummary,
    ExcessiveRepetitionResult,
    ExcessiveRepetitionSummary,
    RepetitionInfo,
    ContentDensityPerRegionResult,
    ContentDensityPerRegionSummary,
    RegionDensity,
    ArrowNavigationAnalysisResult,
} from './analyzers/arrow-navigation/arrow-navigation';
