import type { Rule, RuleResult } from '../core/rule';
import type { AuditContext } from '../core/context';
import type { Violation } from '../core/violation';

// Heading Structure
import { rule as emptyHeading } from './heading-structure/empty-heading/empty-heading';
import { rule as headingLevelSkipped } from './heading-structure/heading-level-skipped/heading-level-skipped';
import { rule as missingH1 } from './heading-structure/missing-h1/missing-h1';
import { rule as multipleH1 } from './heading-structure/multiple-h1/multiple-h1';

// Landmark Structure
import { rule as duplicateLandmark } from './landmark-structure/duplicate-landmark/duplicate-landmark';
import { rule as missingMainLandmark } from './landmark-structure/missing-main-landmark/missing-main-landmark';

// Focus and Keyboard
import { rule as buttonNotInTabOrder } from './focus-and-keyboard/button-not-in-tab-order/button-not-in-tab-order';
import { rule as excessiveTabStopContent } from './focus-and-keyboard/excessive-tab-stop-content/excessive-tab-stop-content';
import { rule as focusOrderAnomaly } from './focus-and-keyboard/focus-order-anomaly/focus-order-anomaly';
import { rule as focusTrap } from './focus-and-keyboard/focus-trap/focus-trap';
import { rule as linkNotInTabOrder } from './focus-and-keyboard/link-not-in-tab-order/link-not-in-tab-order';
import { rule as positiveTabindex } from './focus-and-keyboard/positive-tabindex/positive-tabindex';

// Link Text
import { rule as duplicateLinkText } from './link-text/duplicate-link-text/duplicate-link-text';
import { rule as duplicateButtonText } from './link-text/duplicate-button-text/duplicate-button-text';
import { rule as fragmentedLinkText } from './link-text/fragmented-link-text/fragmented-link-text';
import { rule as genericLinkText } from './link-text/generic-link-text/generic-link-text';

// Content Structure
import { rule as contentDensityPerRegion } from './content-structure/content-density-per-region/content-density-per-region';
import { rule as excessiveNavigationLinks } from './content-structure/excessive-navigation-links/excessive-navigation-links';
import { rule as excessiveRepetition } from './content-structure/excessive-repetition/excessive-repetition';
import { rule as unexitedSubtreeRepetition } from './content-structure/unexited-subtree-repetition/unexited-subtree-repetition';
import { rule as excessiveBlankAnnouncements } from './content-structure/excessive-blank-announcements/excessive-blank-announcements';
import { rule as landmarkWithoutHeading } from './content-structure/landmark-without-heading/landmark-without-heading';
import { rule as largeContentGap } from './content-structure/large-content-gap/large-content-gap';
import { rule as readingOrderLandmarkSequence } from './content-structure/reading-order-landmark-sequence/reading-order-landmark-sequence';
import { rule as repeatedPatternWithoutHeading } from './content-structure/repeated-pattern-without-heading/repeated-pattern-without-heading';
import { rule as stepsToMainContent } from './content-structure/steps-to-main-content/steps-to-main-content';

// Interactive Elements
import { rule as ariaHiddenFocusable } from './interactive-elements/aria-hidden-focusable/aria-hidden-focusable';
import { rule as emptyAccessibleName } from './interactive-elements/empty-accessible-name/empty-accessible-name';
import { rule as formFieldNoLabel } from './interactive-elements/form-field-no-label/form-field-no-label';
import { rule as missingSkipLink } from './interactive-elements/missing-skip-link/missing-skip-link';
import { rule as nestedInteractiveElements } from './interactive-elements/nested-interactive-elements/nested-interactive-elements';

// Semantic
import { rule as filenameAsAlt } from './semantic/filename-as-alt/filename-as-alt';
import { rule as roleMismatch } from './semantic/role-mismatch/role-mismatch';

export const RULES: readonly Rule<unknown, unknown>[] = [
    // Heading Structure
    emptyHeading,
    headingLevelSkipped,
    missingH1,
    multipleH1,

    // Landmark Structure
    duplicateLandmark,
    missingMainLandmark,

    // Focus and Keyboard
    buttonNotInTabOrder,
    excessiveTabStopContent,
    focusOrderAnomaly,
    focusTrap,
    linkNotInTabOrder,
    positiveTabindex,

    // Link Text
    duplicateButtonText,
    duplicateLinkText,
    fragmentedLinkText,
    genericLinkText,

    // Content Structure
    contentDensityPerRegion,
    excessiveBlankAnnouncements,
    excessiveNavigationLinks,
    excessiveRepetition,
    unexitedSubtreeRepetition,
    landmarkWithoutHeading,
    largeContentGap,
    readingOrderLandmarkSequence,
    repeatedPatternWithoutHeading,
    stepsToMainContent,

    // Interactive Elements
    ariaHiddenFocusable,
    emptyAccessibleName,
    formFieldNoLabel,
    missingSkipLink,
    nestedInteractiveElements,

    // Semantic
    filenameAsAlt,
    roleMismatch,
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
