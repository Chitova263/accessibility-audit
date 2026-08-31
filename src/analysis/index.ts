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

// Rule core types
export type { Rule, RuleMeta, RuleResult } from './core/rule';

// Rule catalog
export { RULES, RULE_IDS, getRule, ruleSupportsScreenshot } from './rules/rule-catalog';
export type { RuleId, RuleDefinition } from './rules/rule-catalog';

// Violation utilities
export { summarizeViolations } from './utils/summarize-violations';
export type { ViolationTotals } from './utils/summarize-violations';

// Rules runner
export { RULES as ALL_RULES, runRules, getRuleById } from './rules/runner';
export type { RunResult } from './rules/runner';

// Utils
export { createNvdaContext } from './utils/tool-details';
export type { ContextSource } from './utils/tool-details';

export { captureScreenshot } from './utils/screenshot-capture';
export type { ScreenshotOptions, Screenshot } from './utils/screenshot-capture';

// Individual rules
export { rule as ariaHiddenFocusableRule } from './rules/aria-hidden-focusable/aria-hidden-focusable';
export { rule as axeCoreRule } from './rules/axe-core/axe-core';
export { rule as buttonNotInTabOrderRule } from './rules/button-not-in-tab-order/button-not-in-tab-order';
export { rule as contentDensityPerRegionRule } from './rules/content-density-per-region/content-density-per-region';
export { rule as duplicateLandmarkRule } from './rules/duplicate-landmark/duplicate-landmark';
export { rule as duplicateLinkTextRule } from './rules/duplicate-link-text/duplicate-link-text';
export { rule as emptyAccessibleNameRule } from './rules/empty-accessible-name/empty-accessible-name';
export { rule as emptyHeadingRule } from './rules/empty-heading/empty-heading';
export { rule as excessiveNavigationLinksRule } from './rules/excessive-navigation-links/excessive-navigation-links';
export { rule as excessiveRepetitionRule } from './rules/excessive-repetition/excessive-repetition';
export { rule as filenameAsAltRule } from './rules/filename-as-alt/filename-as-alt';
export { rule as focusOrderAnomalyRule } from './rules/focus-order-anomaly/focus-order-anomaly';
export { rule as focusTrapRule } from './rules/focus-trap/focus-trap';
export { rule as formFieldNoLabelRule } from './rules/form-field-no-label/form-field-no-label';
export { rule as genericLinkTextRule } from './rules/generic-link-text/generic-link-text';
export { rule as headingLevelSkippedRule } from './rules/heading-level-skipped/heading-level-skipped';
export { rule as landmarkWithoutHeadingRule } from './rules/landmark-without-heading/landmark-without-heading';
export { rule as largeContentGapRule } from './rules/large-content-gap/large-content-gap';
export { rule as linkNotInTabOrderRule } from './rules/link-not-in-tab-order/link-not-in-tab-order';
export { rule as missingH1Rule } from './rules/missing-h1/missing-h1';
export { rule as missingMainLandmarkRule } from './rules/missing-main-landmark/missing-main-landmark';
export { rule as missingSkipLinkRule } from './rules/missing-skip-link/missing-skip-link';
export { rule as multipleH1Rule } from './rules/multiple-h1/multiple-h1';
export { rule as positiveTabindexRule } from './rules/positive-tabindex/positive-tabindex';
export { rule as readingOrderLandmarkSequenceRule } from './rules/reading-order-landmark-sequence/reading-order-landmark-sequence';
export { rule as repeatedPatternWithoutHeadingRule } from './rules/repeated-pattern-without-heading/repeated-pattern-without-heading';
export { rule as roleMismatchRule } from './rules/role-mismatch/role-mismatch';
export { rule as stepsToMainContentRule } from './rules/steps-to-main-content/steps-to-main-content';
