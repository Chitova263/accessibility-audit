/**
 * Rule Catalog
 *
 * Single source of truth for rule metadata: WCAG mapping, summary, and how the
 * rule compares to axe-core. Violation factories read from here rather than
 * hardcoding the same values, so a rule's WCAG criterion is defined in exactly
 * one place.
 *
 * Impact is NOT defined here — it's a property of each violation, not the rule.
 * Rules specify impact when calling buildViolation().
 *
 * axe-core rules are deliberately absent: axe supplies its own ~90 rule IDs and
 * their metadata at runtime (see `analyzers/axe-core.ts`).
 */

import type { WcagCriterion, ScreenReaderContext, ScreenReaderViolation } from '../core/violation';
import type { ScreenReaderName } from '../../screen-reader/drivers/types';

export type Impact = 'critical' | 'serious' | 'moderate' | 'minor';

export interface RuleDefinition {
    readonly wcag: {
        readonly primary: WcagCriterion;
        readonly related?: readonly WcagCriterion[];
    };
    readonly axeEquivalent: readonly string[];
    readonly summary: string;
    /** True for rules with specific DOM elements; false for structural issues */
    readonly supportsScreenshot: boolean;
}

export const RULES = {
    'empty-accessible-name': {
        wcag: {
            primary: { criterion: '4.1.2', level: 'A' },
            related: [{ criterion: '1.1.1', level: 'A' }],
        },
        axeEquivalent: ['button-name', 'link-name', 'aria-command-name'],
        summary: 'Interactive element has no accessible name',
        supportsScreenshot: true,
    },

    'missing-h1': {
        wcag: {
            primary: { criterion: '1.3.1', level: 'A' },
            related: [{ criterion: '2.4.6', level: 'AA' }],
        },
        axeEquivalent: ['page-has-heading-one'],
        summary: 'Page has no H1 heading',
        supportsScreenshot: false, // absence of element
    },

    'multiple-h1': {
        wcag: { primary: { criterion: '1.3.1', level: 'A' } },
        axeEquivalent: [],
        summary: 'Page has more than one H1',
        supportsScreenshot: true,
    },

    'heading-level-skipped': {
        wcag: { primary: { criterion: '1.3.1', level: 'A' } },
        axeEquivalent: ['heading-order'],
        summary: 'Heading levels are skipped (e.g., H1 to H3)',
        supportsScreenshot: true,
    },

    'empty-heading': {
        wcag: {
            primary: { criterion: '1.3.1', level: 'A' },
            related: [{ criterion: '2.4.6', level: 'AA' }],
        },
        axeEquivalent: ['empty-heading'],
        summary: 'Heading has no text content',
        supportsScreenshot: true,
    },

    'missing-main-landmark': {
        wcag: {
            primary: { criterion: '1.3.1', level: 'A' },
            related: [{ criterion: '2.4.1', level: 'A' }],
        },
        axeEquivalent: ['landmark-one-main'],
        summary: 'Page has no main landmark',
        supportsScreenshot: false, // absence of element
    },

    'duplicate-landmark': {
        wcag: { primary: { criterion: '1.3.1', level: 'A' } },
        axeEquivalent: ['landmark-unique'],
        summary: 'Multiple landmarks of same type without unique names',
        supportsScreenshot: true,
    },

    'generic-link-text': {
        wcag: { primary: { criterion: '2.4.4', level: 'A' } },
        axeEquivalent: [],
        summary: 'Link uses generic text like "click here" or "read more"',
        supportsScreenshot: true,
    },

    'duplicate-link-text': {
        wcag: { primary: { criterion: '2.4.4', level: 'A' } },
        axeEquivalent: ['identical-links-same-purpose'],
        summary: 'Multiple links with same text but different destinations',
        supportsScreenshot: true,
    },

    'fragmented-link-text': {
        wcag: { primary: { criterion: '2.4.4', level: 'A' } },
        axeEquivalent: [],
        summary: 'Link text is fragmented into individual characters',
        supportsScreenshot: false, // pattern across multiple elements
    },

    'focus-trap': {
        wcag: { primary: { criterion: '2.1.2', level: 'A' } },
        axeEquivalent: [],
        summary: 'Keyboard focus trap where the user cannot escape using Tab',
        supportsScreenshot: false, // navigation flow issue
    },

    'button-not-in-tab-order': {
        wcag: { primary: { criterion: '2.1.1', level: 'A' } },
        axeEquivalent: [],
        summary: 'Button reachable via B key but not Tab',
        supportsScreenshot: true,
    },

    'link-not-in-tab-order': {
        wcag: { primary: { criterion: '2.1.1', level: 'A' } },
        axeEquivalent: [],
        summary: 'Link reachable via K key but not Tab',
        supportsScreenshot: true,
    },

    'filename-as-alt': {
        wcag: { primary: { criterion: '1.1.1', level: 'A' } },
        axeEquivalent: [],
        summary: 'Image has a filename as alt text (e.g., "IMG_1234.jpg")',
        supportsScreenshot: true,
    },

    'role-mismatch': {
        wcag: { primary: { criterion: '4.1.2', level: 'A' } },
        axeEquivalent: ['aria-allowed-role'],
        summary: "Element's ARIA role doesn't match the underlying HTML element",
        supportsScreenshot: true,
    },

    'focus-order-anomaly': {
        wcag: { primary: { criterion: '2.4.3', level: 'A' } },
        axeEquivalent: [],
        summary: 'Focus jumps backwards or skips large sections',
        supportsScreenshot: false, // navigation flow issue
    },

    'positive-tabindex': {
        wcag: { primary: { criterion: '2.4.3', level: 'A' } },
        axeEquivalent: ['tabindex'],
        summary: 'Element has positive tabindex disrupting natural order',
        supportsScreenshot: true,
    },

    'missing-skip-link': {
        wcag: { primary: { criterion: '2.4.1', level: 'A' } },
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
        axeEquivalent: ['label', 'aria-input-field-name'],
        summary: 'Form field has no accessible label',
        supportsScreenshot: true,
    },

    'aria-hidden-focusable': {
        wcag: {
            primary: { criterion: '4.1.2', level: 'A' },
            related: [{ criterion: '1.3.1', level: 'A' }],
        },
        axeEquivalent: ['aria-hidden-focus'],
        summary: 'Focusable element has aria-hidden="true", creating silent focus',
        supportsScreenshot: true,
    },

    'nested-interactive-elements': {
        wcag: { primary: { criterion: '4.1.1', level: 'A' } },
        axeEquivalent: [],
        summary: 'Interactive elements are improperly nested',
        supportsScreenshot: true,
    },

    'excessive-navigation-links': {
        wcag: { primary: { criterion: '2.4.1', level: 'A' } },
        axeEquivalent: [],
        summary: 'Page has an excessive number of links',
        supportsScreenshot: false, // structural/count issue
    },

    'large-content-gap': {
        wcag: {
            primary: { criterion: '1.3.1', level: 'A' },
            related: [{ criterion: '2.4.6', level: 'AA' }],
        },
        axeEquivalent: [],
        summary: 'Long run of content with no heading between items',
        supportsScreenshot: false, // spans multiple elements
    },

    'landmark-without-heading': {
        wcag: {
            primary: { criterion: '1.3.1', level: 'A' },
            related: [{ criterion: '2.4.6', level: 'AA' }],
        },
        axeEquivalent: [],
        summary: 'Landmark contains many items but no heading',
        supportsScreenshot: false, // structural issue
    },

    'repeated-pattern-without-heading': {
        wcag: {
            primary: { criterion: '1.3.1', level: 'A' },
            related: [{ criterion: '2.4.6', level: 'AA' }],
        },
        axeEquivalent: [],
        summary: 'Repeated content pattern with no heading introducing the group',
        supportsScreenshot: false, // spans multiple elements
    },

    'steps-to-main-content': {
        wcag: { primary: { criterion: '2.4.1', level: 'A' } },
        axeEquivalent: [],
        summary: 'Main content reached only after excessive linear reading steps',
        supportsScreenshot: false, // navigation flow issue
    },

    'reading-order-landmark-sequence': {
        wcag: { primary: { criterion: '1.3.2', level: 'A' } },
        axeEquivalent: [],
        summary: 'Landmarks announced out of logical reading order',
        supportsScreenshot: false, // structural issue
    },

    'excessive-repetition': {
        wcag: { primary: { criterion: '1.3.1', level: 'A' } },
        axeEquivalent: [],
        summary: 'Same phrase announced many times consecutively',
        supportsScreenshot: false, // pattern issue
    },

    'unexited-subtree-repetition': {
        wcag: { primary: { criterion: '4.1.2', level: 'A' } },
        axeEquivalent: [],
        summary: 'Button with unnamed child nodes causes repeated NVDA announcements during linear reading',
        supportsScreenshot: true, // element (the button) can be captured
    },

    'excessive-blank-announcements': {
        wcag: { primary: { criterion: '1.3.1', level: 'A' } },
        axeEquivalent: [],
        summary: 'Long run of blank announcements in linear reading',
        supportsScreenshot: false, // no element to capture
    },

    'content-density-per-region': {
        wcag: { primary: { criterion: '2.4.1', level: 'A' } },
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
 * Returns the rule structure needed by the Violation type (without impact).
 *
 * Impact is specified per-violation via buildViolation(), not from the catalog.
 */
export function getRule(ruleId: RuleId): {
    id: string;
    summary: string;
    wcag: { primary: WcagCriterion; related?: WcagCriterion[] };
} {
    const rule: RuleDefinition = RULES[ruleId];
    const primary: WcagCriterion = { ...rule.wcag.primary };

    return {
        id: ruleId,
        summary: rule.summary,
        wcag: rule.wcag.related
            ? { primary, related: rule.wcag.related.map((criterion) => ({ ...criterion })) }
            : { primary },
    };
}

export interface BuildViolationOptions {
    /** Rule ID from the catalog */
    ruleId: RuleId;
    /** Severity of this specific violation */
    impact: Impact;
    /** Unique identifier for this violation (will be prefixed with ruleId) */
    stepId: string;
    /** Human-readable description of the violation */
    message: string;
    /** When the violation was detected */
    timestamp: number;
    /** Screen reader context for this violation */
    context: ScreenReaderContext;
    /** HTML snippet of the element, if available */
    htmlSnippet?: string | null;
    /** Which screen reader found this (used for tool field) */
    screenReader: ScreenReaderName;
}

/**
 * Build a violation with metadata from the catalog.
 *
 * This is the primary way to create violations. It:
 * - Reads WCAG mapping and summary from the catalog (single source of truth)
 * - Sets the `tool` field from the screen reader name
 * - Generates a consistent violation ID format
 * - Handles optional htmlSnippet
 */
export function buildViolation(options: BuildViolationOptions): ScreenReaderViolation {
    const { ruleId, impact, stepId, message, timestamp, context, htmlSnippet, screenReader } = options;
    const rule = getRule(ruleId);

    return {
        id: `${ruleId}-${stepId}`,
        rule: {
            ...rule,
            impact,
        },
        message,
        ...(htmlSnippet != null && { element: { htmlSnippet } }),
        tool: screenReader,
        timestamp,
        context,
    };
}
