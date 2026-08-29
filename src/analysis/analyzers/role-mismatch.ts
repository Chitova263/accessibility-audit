/**
 * Analyzer: Role Mismatch
 *
 * Detects when the ARIA/AX role doesn't match the underlying HTML element.
 * For example: <a> with role="button" or <div> acting as a link.
 *
 * These mismatches can cause confusing behavior for screen reader users
 * when the announced role doesn't match expected keyboard interaction.
 *
 * Maps to WCAG 4.1.2 (Name, Role, Value).
 */

import type { StrategyResult } from '../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';
import type { NvdaViolation, NvdaToolDetails } from '../violation';
import type { TranscriptContext } from '../context';
import { createToolDetails as buildToolDetails } from '../tool-details';
import { ruleMetadata } from '../rule-catalog';

type RoleMismatchIssue =
    'link-as-button' | 'button-as-link' | 'div-as-interactive' | 'span-as-interactive' | 'element-role-override';

/** Expected role for common HTML elements */
const ELEMENT_EXPECTED_ROLES: Record<string, string[]> = {
    a: ['link'],
    button: ['button'],
    input: ['textbox', 'checkbox', 'radio', 'slider', 'spinbutton', 'combobox', 'searchbox'],
    select: ['combobox', 'listbox'],
    textarea: ['textbox'],
    img: ['img', 'image'],
    nav: ['navigation'],
    main: ['main'],
    header: ['banner'],
    footer: ['contentinfo'],
    aside: ['complementary'],
    form: ['form'],
    table: ['table'],
    ul: ['list'],
    ol: ['list'],
    li: ['listitem'],
};

/** Roles that indicate interactivity */
const INTERACTIVE_ROLES = [
    'button',
    'link',
    'checkbox',
    'radio',
    'textbox',
    'combobox',
    'listbox',
    'menuitem',
    'tab',
    'switch',
    'slider',
];

export interface RoleMismatchAnalyzerResult {
    violations: NvdaViolation[];
    summary: {
        totalElementsChecked: number;
        violationsFound: number;
        byIssue: Record<string, number>;
    };
}

interface ElementInfo {
    role: string;
    htmlTag: string | null;
    name: string;
    stepIndex: number;
    htmlSnippet: string | null;
    spokenPhrases: string[];
    itemText: string;
    identifier: string;
    timestamp: number;
    axNode: unknown;
    strategyType: string;
}

export function analyzeRoleMismatch({ strategyResults }: TranscriptContext): RoleMismatchAnalyzerResult {
    const violations: NvdaViolation[] = [];
    const byIssue: Record<string, number> = {};
    let totalChecked = 0;

    // Collect elements from all strategies
    const elements: ElementInfo[] = [];

    for (const result of strategyResults) {
        const strategyType = result.meta.type ?? result.meta.name;

        for (let stepIndex = 0; stepIndex < result.navigationSteps.length; stepIndex++) {
            const step = result.navigationSteps[stepIndex]!;
            const node = step.axNode;

            if (!node) continue;

            const role = node.role?.value;
            if (!role) continue;

            const htmlTag = extractHtmlTag(step.htmlSnippet);

            elements.push({
                role,
                htmlTag,
                name: node.name?.value ?? '',
                stepIndex,
                htmlSnippet: step.htmlSnippet,
                spokenPhrases: step.spokenPhrases,
                itemText: step.itemText,
                identifier: step.identifier,
                timestamp: step.timestamp,
                axNode: node,
                strategyType,
            });
        }
    }

    // Deduplicate
    const uniqueElements = deduplicateElements(elements);

    for (const element of uniqueElements) {
        if (!element.htmlTag) continue;

        totalChecked++;
        const mismatch = detectMismatch(element);

        if (mismatch) {
            byIssue[mismatch.issue] = (byIssue[mismatch.issue] ?? 0) + 1;
            violations.push(createMismatchViolation(element, mismatch));
        }
    }

    return {
        violations,
        summary: {
            totalElementsChecked: totalChecked,
            violationsFound: violations.length,
            byIssue,
        },
    };
}

interface MismatchInfo {
    issue: RoleMismatchIssue;
    description: string;
}

function detectMismatch(element: ElementInfo): MismatchInfo | null {
    const { role, htmlTag } = element;
    if (!htmlTag) return null;

    const tag = htmlTag.toLowerCase();
    const expectedRoles = ELEMENT_EXPECTED_ROLES[tag];

    // Case 1: <a> with role="button"
    if (tag === 'a' && role === 'button') {
        return {
            issue: 'link-as-button',
            description:
                'Link (<a>) has role="button". This can confuse users as Enter activates links but Enter/Space activate buttons.',
        };
    }

    // Case 2: <button> with role="link"
    if (tag === 'button' && role === 'link') {
        return {
            issue: 'button-as-link',
            description:
                'Button has role="link". Users expect links to navigate, but this button may perform an action instead.',
        };
    }

    // Case 3: <div> with interactive role
    if (tag === 'div' && INTERACTIVE_ROLES.includes(role)) {
        // Check if it has proper keyboard handling (we can't fully verify, but flag it)
        return {
            issue: 'div-as-interactive',
            description: `Non-interactive <div> has role="${role}". Custom interactive elements may lack proper keyboard support.`,
        };
    }

    // Case 4: <span> with interactive role
    if (tag === 'span' && INTERACTIVE_ROLES.includes(role)) {
        return {
            issue: 'span-as-interactive',
            description: `Non-interactive <span> has role="${role}". Custom interactive elements may lack proper keyboard support.`,
        };
    }

    // Case 5: Element has unexpected role (not in expected list)
    if (expectedRoles && !expectedRoles.includes(role) && INTERACTIVE_ROLES.includes(role)) {
        // Only flag if the override is to an interactive role
        return {
            issue: 'element-role-override',
            description: `<${tag}> has unexpected role="${role}". Expected one of: ${expectedRoles.join(', ')}.`,
        };
    }

    return null;
}

function extractHtmlTag(htmlSnippet: string | null): string | null {
    if (!htmlSnippet) return null;

    // Match opening tag: <tagname or <tagname>
    const match = htmlSnippet.match(/^<([a-z][a-z0-9-]*)/i);
    return match?.[1]?.toLowerCase() ?? null;
}

function deduplicateElements(elements: ElementInfo[]): ElementInfo[] {
    const seen = new Set<string>();
    const unique: ElementInfo[] = [];

    for (const el of elements) {
        const key = `${el.role}:${el.htmlTag}:${el.htmlSnippet ?? ''}`;
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(el);
        }
    }

    return unique;
}

function createToolDetails(element: ElementInfo): NvdaToolDetails {
    return buildToolDetails(element, element.strategyType, element.stepIndex);
}

function createMismatchViolation(element: ElementInfo, mismatch: MismatchInfo): NvdaViolation {
    return {
        id: `role-mismatch-${element.identifier}`,
        ...ruleMetadata('role-mismatch'),
        message: `${mismatch.description} Element: <${element.htmlTag}> with role="${element.role}"${element.name ? ` and name "${element.name}"` : ''}.`,
        element: {
            htmlSnippet: element.htmlSnippet ?? undefined,
        },
        tool: 'nvda-audit',
        timestamp: element.timestamp,
        toolDetails: createToolDetails(element),
    };
}
