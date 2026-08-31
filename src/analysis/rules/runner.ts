import type { Rule, RuleResult } from '../core/rule';
import type { AuditContext } from '../core/context';
import type { Violation } from '../core/violation';

import { rule as ariaHiddenFocusable } from './aria-hidden-focusable/aria-hidden-focusable';
import { rule as axeCore } from './axe-core/axe-core';
import { rule as buttonNotInTabOrder } from './button-not-in-tab-order/button-not-in-tab-order';
import { rule as contentDensityPerRegion } from './content-density-per-region/content-density-per-region';
import { rule as duplicateLandmark } from './duplicate-landmark/duplicate-landmark';
import { rule as duplicateLinkText } from './duplicate-link-text/duplicate-link-text';
import { rule as emptyAccessibleName } from './empty-accessible-name/empty-accessible-name';
import { rule as emptyHeading } from './empty-heading/empty-heading';
import { rule as excessiveNavigationLinks } from './excessive-navigation-links/excessive-navigation-links';
import { rule as excessiveRepetition } from './excessive-repetition/excessive-repetition';
import { rule as filenameAsAlt } from './filename-as-alt/filename-as-alt';
import { rule as focusOrderAnomaly } from './focus-order-anomaly/focus-order-anomaly';
import { rule as focusTrap } from './focus-trap/focus-trap';
import { rule as formFieldNoLabel } from './form-field-no-label/form-field-no-label';
import { rule as genericLinkText } from './generic-link-text/generic-link-text';
import { rule as headingLevelSkipped } from './heading-level-skipped/heading-level-skipped';
import { rule as landmarkWithoutHeading } from './landmark-without-heading/landmark-without-heading';
import { rule as largeContentGap } from './large-content-gap/large-content-gap';
import { rule as linkNotInTabOrder } from './link-not-in-tab-order/link-not-in-tab-order';
import { rule as missingH1 } from './missing-h1/missing-h1';
import { rule as missingMainLandmark } from './missing-main-landmark/missing-main-landmark';
import { rule as missingSkipLink } from './missing-skip-link/missing-skip-link';
import { rule as multipleH1 } from './multiple-h1/multiple-h1';
import { rule as positiveTabindex } from './positive-tabindex/positive-tabindex';
import { rule as readingOrderLandmarkSequence } from './reading-order-landmark-sequence/reading-order-landmark-sequence';
import { rule as repeatedPatternWithoutHeading } from './repeated-pattern-without-heading/repeated-pattern-without-heading';
import { rule as roleMismatch } from './role-mismatch/role-mismatch';
import { rule as stepsToMainContent } from './steps-to-main-content/steps-to-main-content';

export const RULES: readonly Rule<unknown, unknown>[] = [
    ariaHiddenFocusable,
    axeCore,
    buttonNotInTabOrder,
    contentDensityPerRegion,
    duplicateLandmark,
    duplicateLinkText,
    emptyAccessibleName,
    emptyHeading,
    excessiveNavigationLinks,
    excessiveRepetition,
    filenameAsAlt,
    focusOrderAnomaly,
    focusTrap,
    formFieldNoLabel,
    genericLinkText,
    headingLevelSkipped,
    landmarkWithoutHeading,
    largeContentGap,
    linkNotInTabOrder,
    missingH1,
    missingMainLandmark,
    missingSkipLink,
    multipleH1,
    positiveTabindex,
    readingOrderLandmarkSequence,
    repeatedPatternWithoutHeading,
    roleMismatch,
    stepsToMainContent,
];

export interface RunResult {
    violations: Violation[];
    byRule: Map<string, RuleResult<unknown, unknown>>;
}

export async function runRules(
    ctx: AuditContext,
    rules: readonly Rule<unknown, unknown>[] = RULES
): Promise<RunResult> {
    const violations: Violation[] = [];
    const byRule = new Map<string, RuleResult<unknown, unknown>>();

    for (const rule of rules) {
        const result = await rule.run(ctx);
        byRule.set(rule.id, result);
        violations.push(...result.violations);
    }

    return { violations, byRule };
}

export function getRuleById(id: string): Rule<unknown, unknown> | undefined {
    return RULES.find((r) => r.id === id);
}
