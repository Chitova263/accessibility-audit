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

export type { Rule, RuleMeta, RuleResult } from './core/rule';

export { RULES, RULE_IDS, getRule, ruleSupportsScreenshot } from './rules/rule-catalog';
export type { RuleId, RuleDefinition } from './rules/rule-catalog';

export { summarizeViolations } from './utils/summarize-violations';
export type { ViolationTotals } from './utils/summarize-violations';

export { RULES as ALL_RULES, runRules, getRuleById } from './rules/runner';
export type { RunResult } from './rules/runner';

export { createNvdaContext } from './utils/tool-details';
export type { ContextSource } from './utils/tool-details';

export { captureScreenshotToFile, captureViewportWithHighlight, ensureScreenshotsDir, isScreenshotSuccess } from './utils/screenshot-capture';
export type { ScreenshotOptions, Screenshot, ScreenshotSuccess, ScreenshotFailure, BoundingBox } from './utils/screenshot-capture';

// Heading Structure
export { rule as emptyHeadingRule } from './rules/heading-structure/empty-heading/empty-heading';
export { rule as headingLevelSkippedRule } from './rules/heading-structure/heading-level-skipped/heading-level-skipped';
export { rule as missingH1Rule } from './rules/heading-structure/missing-h1/missing-h1';
export { rule as multipleH1Rule } from './rules/heading-structure/multiple-h1/multiple-h1';

// Landmark Structure
export { rule as duplicateLandmarkRule } from './rules/landmark-structure/duplicate-landmark/duplicate-landmark';
export { rule as missingMainLandmarkRule } from './rules/landmark-structure/missing-main-landmark/missing-main-landmark';

// Focus and Keyboard
export { rule as buttonNotInTabOrderRule } from './rules/focus-and-keyboard/button-not-in-tab-order/button-not-in-tab-order';
export { rule as focusOrderAnomalyRule } from './rules/focus-and-keyboard/focus-order-anomaly/focus-order-anomaly';
export { rule as focusTrapRule } from './rules/focus-and-keyboard/focus-trap/focus-trap';
export { rule as linkNotInTabOrderRule } from './rules/focus-and-keyboard/link-not-in-tab-order/link-not-in-tab-order';
export { rule as positiveTabindexRule } from './rules/focus-and-keyboard/positive-tabindex/positive-tabindex';

// Link Text
export { rule as duplicateLinkTextRule } from './rules/link-text/duplicate-link-text/duplicate-link-text';
export { rule as genericLinkTextRule } from './rules/link-text/generic-link-text/generic-link-text';

// Content Structure
export { rule as contentDensityPerRegionRule } from './rules/content-structure/content-density-per-region/content-density-per-region';
export { rule as excessiveNavigationLinksRule } from './rules/content-structure/excessive-navigation-links/excessive-navigation-links';
export { rule as excessiveRepetitionRule } from './rules/content-structure/excessive-repetition/excessive-repetition';
export { rule as landmarkWithoutHeadingRule } from './rules/content-structure/landmark-without-heading/landmark-without-heading';
export { rule as largeContentGapRule } from './rules/content-structure/large-content-gap/large-content-gap';
export { rule as readingOrderLandmarkSequenceRule } from './rules/content-structure/reading-order-landmark-sequence/reading-order-landmark-sequence';
export { rule as repeatedPatternWithoutHeadingRule } from './rules/content-structure/repeated-pattern-without-heading/repeated-pattern-without-heading';
export { rule as stepsToMainContentRule } from './rules/content-structure/steps-to-main-content/steps-to-main-content';

// Interactive Elements
export { rule as ariaHiddenFocusableRule } from './rules/interactive-elements/aria-hidden-focusable/aria-hidden-focusable';
export { rule as emptyAccessibleNameRule } from './rules/interactive-elements/empty-accessible-name/empty-accessible-name';
export { rule as formFieldNoLabelRule } from './rules/interactive-elements/form-field-no-label/form-field-no-label';
export { rule as missingSkipLinkRule } from './rules/interactive-elements/missing-skip-link/missing-skip-link';

// Semantic
export { rule as filenameAsAltRule } from './rules/semantic/filename-as-alt/filename-as-alt';
export { rule as roleMismatchRule } from './rules/semantic/role-mismatch/role-mismatch';

// axe-core
export { rule as axeCoreRule } from './rules/axe-core/axe-core';
