/**
 * Rule Catalog
 *
 * Single source of truth for NVDA audit rule metadata: WCAG mapping, default
 * impact, and how the rule compares to axe-core. Violation factories read from
 * here rather than hardcoding the same values, so a rule's WCAG criterion is
 * defined in exactly one place.
 *
 * axe-core rules are deliberately absent: axe supplies its own ~90 rule IDs and
 * their metadata at runtime (see `analyzers/axe-core.ts`).
 */

import type { WcagCriterion } from '../core/violation';

/** Tool-native severity, ordered most to least severe. */
export type Impact = 'critical' | 'serious' | 'moderate' | 'minor';

export interface RuleDefinition {
    readonly wcag: {
        readonly primary: WcagCriterion;
        readonly related?: readonly WcagCriterion[];
    };
    /** Default impact. Rules that vary by context override it at the call site. */
    readonly impact: Impact;
    /** Equivalent axe-core rule IDs; empty when axe has no equivalent. */
    readonly axeEquivalent: readonly string[];
    readonly summary: string;
    /**
     * Whether this rule benefits from element screenshots in reports.
     * True for rules with specific DOM elements (headings, images, focusable elements).
     * False for structural/conceptual issues (focus traps, missing landmarks, meta tags).
     */
    readonly supportsScreenshot: boolean;
}

export const RULES = {
    'empty-accessible-name': {
        wcag: {
            primary: { criterion: '4.1.2', level: 'A' },
            related: [{ criterion: '1.1.1', level: 'A' }],
        },
        impact: 'serious',
        axeEquivalent: ['button-name', 'link-name', 'aria-command-name'],
        summary: 'Interactive element has no accessible name',
        supportsScreenshot: true,
    },

    'missing-h1': {
        wcag: {
            primary: { criterion: '1.3.1', level: 'A' },
            related: [{ criterion: '2.4.6', level: 'AA' }],
        },
        impact: 'serious',
        axeEquivalent: ['page-has-heading-one'],
        summary: 'Page has no H1 heading',
        supportsScreenshot: false, // absence of element
    },

    'multiple-h1': {
        wcag: { primary: { criterion: '1.3.1', level: 'A' } },
        impact: 'moderate',
        axeEquivalent: [],
        summary: 'Page has more than one H1',
        supportsScreenshot: true,
    },

    'heading-level-skipped': {
        wcag: { primary: { criterion: '1.3.1', level: 'A' } },
        impact: 'moderate',
        axeEquivalent: ['heading-order'],
        summary: 'Heading levels are skipped (e.g., H1 to H3)',
        supportsScreenshot: true,
    },

    'empty-heading': {
        wcag: {
            primary: { criterion: '1.3.1', level: 'A' },
            related: [{ criterion: '2.4.6', level: 'AA' }],
        },
        impact: 'serious',
        axeEquivalent: ['empty-heading'],
        summary: 'Heading has no text content',
        supportsScreenshot: true,
    },

    'missing-main-landmark': {
        wcag: {
            primary: { criterion: '1.3.1', level: 'A' },
            related: [{ criterion: '2.4.1', level: 'A' }],
        },
        impact: 'serious',
        axeEquivalent: ['landmark-one-main'],
        summary: 'Page has no main landmark',
        supportsScreenshot: false, // absence of element
    },

    'duplicate-landmark': {
        wcag: { primary: { criterion: '1.3.1', level: 'A' } },
        impact: 'moderate',
        axeEquivalent: ['landmark-unique'],
        summary: 'Multiple landmarks of same type without unique names',
        supportsScreenshot: true,
    },

    'generic-link-text': {
        wcag: { primary: { criterion: '2.4.4', level: 'A' } },
        impact: 'serious',
        axeEquivalent: [],
        summary: 'Link uses generic text like "click here" or "read more"',
        supportsScreenshot: true,
    },

    'duplicate-link-text': {
        wcag: { primary: { criterion: '2.4.4', level: 'A' } },
        impact: 'moderate',
        axeEquivalent: ['identical-links-same-purpose'],
        summary: 'Multiple links with same text but different destinations',
        supportsScreenshot: true,
    },

    'focus-trap': {
        wcag: { primary: { criterion: '2.1.2', level: 'A' } },
        impact: 'critical',
        axeEquivalent: [],
        summary: 'Keyboard focus trap where the user cannot escape using Tab',
        supportsScreenshot: false, // navigation flow issue
    },

    'button-not-in-tab-order': {
        wcag: { primary: { criterion: '2.1.1', level: 'A' } },
        impact: 'serious',
        axeEquivalent: [],
        summary: 'Button reachable via B key but not Tab',
        supportsScreenshot: true,
    },

    'link-not-in-tab-order': {
        wcag: { primary: { criterion: '2.1.1', level: 'A' } },
        impact: 'serious',
        axeEquivalent: [],
        summary: 'Link reachable via K key but not Tab',
        supportsScreenshot: true,
    },

    'filename-as-alt': {
        wcag: { primary: { criterion: '1.1.1', level: 'A' } },
        impact: 'serious',
        axeEquivalent: [],
        summary: 'Image has a filename as alt text (e.g., "IMG_1234.jpg")',
        supportsScreenshot: true,
    },

    'role-mismatch': {
        wcag: { primary: { criterion: '4.1.2', level: 'A' } },
        impact: 'moderate',
        axeEquivalent: ['aria-allowed-role'],
        summary: "Element's ARIA role doesn't match the underlying HTML element",
        supportsScreenshot: true,
    },

    'focus-order-anomaly': {
        wcag: { primary: { criterion: '2.4.3', level: 'A' } },
        impact: 'serious',
        axeEquivalent: [],
        summary: 'Focus jumps backwards or skips large sections',
        supportsScreenshot: false, // navigation flow issue
    },

    'positive-tabindex': {
        wcag: { primary: { criterion: '2.4.3', level: 'A' } },
        impact: 'serious',
        axeEquivalent: ['tabindex'],
        summary: 'Element has positive tabindex disrupting natural order',
        supportsScreenshot: true,
    },

    'missing-skip-link': {
        wcag: { primary: { criterion: '2.4.1', level: 'A' } },
        impact: 'serious',
        axeEquivalent: ['bypass', 'skip-link'],
        summary: 'No skip link found in the first tab stops',
        supportsScreenshot: false, // absence of element
    },

    'form-field-no-label': {
        wcag: {
            primary: { criterion: '3.3.2', level: 'A' },
            related: [
                { criterion: '1.3.1', level: 'A' },
                { criterion: '4.1.2', level: 'A' },
            ],
        },
        impact: 'critical',
        axeEquivalent: ['label', 'aria-input-field-name'],
        summary: 'Form field has no accessible label',
        supportsScreenshot: true,
    },

    'aria-hidden-focusable': {
        wcag: {
            primary: { criterion: '4.1.2', level: 'A' },
            related: [{ criterion: '1.3.1', level: 'A' }],
        },
        impact: 'critical',
        axeEquivalent: ['aria-hidden-focus'],
        summary: 'Focusable element has aria-hidden="true", creating silent focus',
        supportsScreenshot: true,
    },

    'excessive-navigation-links': {
        wcag: { primary: { criterion: '2.4.1', level: 'A' } },
        impact: 'moderate',
        axeEquivalent: [],
        summary: 'Page has an excessive number of links',
        supportsScreenshot: false, // structural/count issue
    },

    'large-content-gap': {
        wcag: {
            primary: { criterion: '1.3.1', level: 'A' },
            related: [{ criterion: '2.4.6', level: 'AA' }],
        },
        impact: 'moderate',
        axeEquivalent: [],
        summary: 'Long run of content with no heading between items',
        supportsScreenshot: false, // spans multiple elements
    },

    'landmark-without-heading': {
        wcag: {
            primary: { criterion: '1.3.1', level: 'A' },
            related: [{ criterion: '2.4.6', level: 'AA' }],
        },
        impact: 'moderate',
        axeEquivalent: [],
        summary: 'Landmark contains many items but no heading',
        supportsScreenshot: false, // structural issue
    },

    'repeated-pattern-without-heading': {
        wcag: {
            primary: { criterion: '1.3.1', level: 'A' },
            related: [{ criterion: '2.4.6', level: 'AA' }],
        },
        impact: 'minor',
        axeEquivalent: [],
        summary: 'Repeated content pattern with no heading introducing the group',
        supportsScreenshot: false, // spans multiple elements
    },

    'steps-to-main-content': {
        wcag: { primary: { criterion: '2.4.1', level: 'A' } },
        impact: 'moderate',
        axeEquivalent: [],
        summary: 'Main content reached only after excessive linear reading steps',
        supportsScreenshot: false, // navigation flow issue
    },

    'reading-order-landmark-sequence': {
        wcag: { primary: { criterion: '1.3.2', level: 'A' } },
        impact: 'serious',
        axeEquivalent: [],
        summary: 'Landmarks announced out of logical reading order',
        supportsScreenshot: false, // structural issue
    },

    'excessive-repetition': {
        wcag: { primary: { criterion: '1.3.1', level: 'A' } },
        impact: 'minor',
        axeEquivalent: [],
        summary: 'Same phrase announced many times consecutively',
        supportsScreenshot: false, // pattern issue
    },

    'content-density-per-region': {
        wcag: { primary: { criterion: '2.4.1', level: 'A' } },
        impact: 'moderate',
        axeEquivalent: [],
        summary: 'Landmark region contains an overwhelming number of items',
        supportsScreenshot: false, // structural/count issue
    },
} as const satisfies Record<string, RuleDefinition>;

export type RuleId = keyof typeof RULES;

export const RULE_IDS = Object.keys(RULES) as RuleId[];

/**
 * Check if a rule supports element screenshots.
 * Returns false for unknown rules (e.g., axe-core rules not in our catalog).
 */
export function ruleSupportsScreenshot(ruleId: string): boolean {
    if (ruleId in RULES) {
        return RULES[ruleId as RuleId].supportsScreenshot;
    }
    return true;
}

/**
 * Get the rule object for a violation.
 * Returns the full rule structure needed by the Violation type.
 *
 * @param ruleId
 * @param impactOverride for rules whose severity varies by context.
 */
export function getRule(
    ruleId: RuleId,
    impactOverride?: Impact
): {
    id: string;
    summary: string;
    wcag: { primary: WcagCriterion; related?: WcagCriterion[] };
    impact: Impact;
} {
    const rule: RuleDefinition = RULES[ruleId];
    const primary: WcagCriterion = { ...rule.wcag.primary };

    return {
        id: ruleId,
        summary: rule.summary,
        wcag: rule.wcag.related
            ? { primary, related: rule.wcag.related.map((criterion) => ({ ...criterion })) }
            : { primary },
        impact: impactOverride ?? rule.impact,
    };
}
