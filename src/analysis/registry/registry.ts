/**
 * Check Registry
 *
 * Every check takes the same input — an `AuditContext` — and returns violations.
 * That uniformity is what lets callers iterate the set instead of hand-wiring
 * each analyzer, and it is why axe-core needs no special handling despite being
 * the only check that reads the live page.
 *
 * A "check" is one unit of work that produces violations. Most map 1:1 to an
 * analyzer module; `arrow-navigation` contributes four, one per sub-analyzer, so
 * that each reports separately.
 *
 * Analyzer options are bound here, at registration.
 *
 * Each check also returns its analyzer's summary. That summary carries what the
 * violations cannot: how much was examined (`totalElementsChecked`), what passed
 * (`skipLinkFound`), the page's shape (`headingSequence`), and findings the
 * analyzer deliberately suppressed. A violation list alone can say "3 problems";
 * only the summary can say "3 of 47 buttons unnamed".
 */

import type { AuditContext } from '../core/context';
import type { Violation } from '../core/violation';
import type { RuleId } from './rule-catalog';

import { analyzeAriaHiddenFocusable } from '../analyzers/aria-hidden-focusable/aria-hidden-focusable';
import {
    analyzeContentDensityPerRegion,
    analyzeExcessiveRepetition,
    analyzeReadingOrderLandmarkSequence,
    analyzeStepsToMainContent,
} from '../analyzers/arrow-navigation/arrow-navigation';
import { analyzeWithAxeCore } from '../analyzers/axe-core/axe-core';
import { analyzeContentGrouping } from '../analyzers/content-grouping/content-grouping';
import { analyzeEmptyAccessibleNames } from '../analyzers/empty-accessible-name/empty-accessible-name';
import { analyzeFocusOrder } from '../analyzers/focus-order/focus-order';
import { analyzeFocusTraps } from '../analyzers/focus-trap/focus-trap';
import { analyzeFormLabels } from '../analyzers/form-labels/form-labels';
import { analyzeHeadingStructure } from '../analyzers/heading-structure/heading-structure';
import { analyzeImageAltText } from '../analyzers/image-alt-text/image-alt-text';
import { analyzeKeyboardAccessibility } from '../analyzers/keyboard-accessibility/keyboard-accessibility';
import { analyzeLandmarkStructure } from '../analyzers/landmark-structure/landmark-structure';
import { analyzeLinkText } from '../analyzers/link-text/link-text';
import { analyzeNavigationSize } from '../analyzers/navigation-size/navigation-size';
import { analyzeRoleMismatch } from '../analyzers/role-mismatch/role-mismatch';
import { analyzeSkipLink } from '../analyzers/skip-link/skip-link';

/**
 * What every analyzer function already returns.
 *
 * `summary` stays `unknown` because its shape is defined per analyzer — several
 * are declared interfaces, so a `Record<string, unknown>` would not accept them.
 * Call the analyzer directly when you want the typed version.
 */
export interface CheckOutput {
    violations: Violation[];
    summary: unknown;
}

export interface Check {
    /** Stable kebab-case identifier. */
    id: string;
    /** Label for logs and reports. */
    name: string;
    /**
     * Rule IDs this check can raise. Empty for axe-core, which brings its own
     * rule catalogue at runtime.
     */
    rules: readonly RuleId[];
    run(context: AuditContext): CheckOutput | Promise<CheckOutput>;
}

export interface CompletedCheck {
    check: Check;
    violations: Violation[];
    /** The analyzer's own summary. Narrow it against that analyzer's result type. */
    summary: unknown;
}

export const CHECKS: readonly Check[] = [
    {
        id: 'empty-accessible-name',
        name: 'Empty Accessible Names',
        rules: ['empty-accessible-name'],
        run: (context) => analyzeEmptyAccessibleNames(context),
    },
    {
        id: 'heading-structure',
        name: 'Heading Structure',
        rules: ['missing-h1', 'multiple-h1', 'heading-level-skipped', 'empty-heading'],
        run: (context) => analyzeHeadingStructure(context),
    },
    {
        id: 'landmark-structure',
        name: 'Landmark Structure',
        rules: ['missing-main-landmark', 'duplicate-landmark'],
        run: (context) => analyzeLandmarkStructure(context),
    },
    {
        id: 'link-text',
        name: 'Link Text',
        rules: ['generic-link-text', 'duplicate-link-text'],
        run: (context) => analyzeLinkText(context),
    },
    {
        id: 'focus-trap',
        name: 'Focus Traps',
        rules: ['focus-trap'],
        run: (context) => analyzeFocusTraps(context),
    },
    {
        id: 'keyboard-accessibility',
        name: 'Keyboard Accessibility',
        rules: ['button-not-in-tab-order', 'link-not-in-tab-order'],
        run: (context) => analyzeKeyboardAccessibility(context),
    },
    {
        id: 'image-alt-text',
        name: 'Image Alt Text',
        rules: ['filename-as-alt'],
        run: (context) => analyzeImageAltText(context),
    },
    {
        id: 'role-mismatch',
        name: 'Role Mismatch',
        rules: ['role-mismatch'],
        run: (context) => analyzeRoleMismatch(context),
    },
    {
        id: 'focus-order',
        name: 'Focus Order',
        rules: ['focus-order-anomaly', 'positive-tabindex'],
        run: (context) => analyzeFocusOrder(context),
    },
    {
        id: 'skip-link',
        name: 'Skip Link',
        rules: ['missing-skip-link'],
        run: (context) => analyzeSkipLink(context),
    },
    {
        id: 'form-labels',
        name: 'Form Labels',
        rules: ['form-field-no-label'],
        run: (context) => analyzeFormLabels(context),
    },
    {
        id: 'aria-hidden-focusable',
        name: 'Aria Hidden Focusable',
        rules: ['aria-hidden-focusable'],
        run: (context) => analyzeAriaHiddenFocusable(context),
    },
    {
        id: 'navigation-size',
        name: 'Navigation Size',
        rules: ['excessive-navigation-links'],
        run: (context) => analyzeNavigationSize(context),
    },
    {
        id: 'content-grouping',
        name: 'Content Grouping',
        rules: ['large-content-gap', 'landmark-without-heading', 'repeated-pattern-without-heading'],
        run: (context) => analyzeContentGrouping(context),
    },
    {
        id: 'steps-to-main-content',
        name: 'Steps To Main Content',
        // Also raises missing-main-landmark when linear reading never reaches main.
        rules: ['steps-to-main-content', 'missing-main-landmark'],
        run: (context) => analyzeStepsToMainContent(context),
    },
    {
        id: 'reading-order-landmark-sequence',
        name: 'Reading Order Landmark Sequence',
        rules: ['reading-order-landmark-sequence'],
        run: (context) => analyzeReadingOrderLandmarkSequence(context),
    },
    {
        id: 'excessive-repetition',
        name: 'Excessive Repetition',
        rules: ['excessive-repetition'],
        run: (context) => analyzeExcessiveRepetition(context),
    },
    {
        id: 'content-density-per-region',
        name: 'Content Density Per Region',
        rules: ['content-density-per-region'],
        run: (context) => analyzeContentDensityPerRegion(context),
    },
    {
        id: 'axe-core',
        name: 'axe-core',
        rules: [],
        run: (context) => analyzeWithAxeCore(context),
    },
];

/**
 * Run checks in registration order.
 *
 * Sequential rather than parallel: axe-core drives the live page, and keeping
 * the order stable keeps violation ordering reproducible between runs.
 */
export async function runChecks(context: AuditContext, checks: readonly Check[] = CHECKS): Promise<CompletedCheck[]> {
    const completed: CompletedCheck[] = [];

    for (const check of checks) {
        const { violations, summary } = await check.run(context);
        completed.push({ check, violations, summary });
    }

    return completed;
}

export function collectViolations(completed: readonly CompletedCheck[]): Violation[] {
    return completed.flatMap((result) => result.violations);
}

export interface ViolationTotals {
    total: number;
    byTool: Record<string, number>;
    byImpact: Record<string, number>;
    byRule: Record<string, number>;
}

export function summarizeViolations(violations: readonly Violation[]): ViolationTotals {
    const totals: ViolationTotals = { total: violations.length, byTool: {}, byImpact: {}, byRule: {} };

    for (const violation of violations) {
        totals.byTool[violation.tool] = (totals.byTool[violation.tool] ?? 0) + 1;
        totals.byImpact[violation.rule.impact] = (totals.byImpact[violation.rule.impact] ?? 0) + 1;
        totals.byRule[violation.rule.id] = (totals.byRule[violation.rule.id] ?? 0) + 1;
    }

    return totals;
}
