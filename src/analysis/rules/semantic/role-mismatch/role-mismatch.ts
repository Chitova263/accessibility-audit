/**
 * Rule: Role Mismatch
 *
 * Detects when the ARIA/AX role doesn't match the underlying HTML element.
 * For example: <a> with role="button" or <div> acting as a link.
 *
 * Maps to WCAG 4.1.2 (Name, Role, Value).
 */

import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { ScreenReaderContext, ScreenReaderViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { buildViolation } from '../../rule-catalog';
import { createScreenReaderContext } from '../../../utils/tool-details';
import type { AXNode } from '../../../../types/cdp';
import { getRole, getName } from '../../../../types/ax-utils';

type RoleMismatchIssue =
    'link-as-button' | 'button-as-link' | 'div-as-interactive' | 'span-as-interactive' | 'element-role-override';

/** Expected roles for common HTML elements */
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

export interface RoleMismatchStats {
    totalElementsChecked: number;
    violationsFound: number;
    byIssue: Record<string, number>;
}

interface ElementInfo {
    role: string;
    htmlTag: string | null;
    name: string;
    stepIndex: number;
    htmlSnippet: string | null;
    spokenPhrases: string[];
    focusedElementText: string;
    identifier: string;
    timestamp: number;
    axNode: AXNode | undefined;
    strategyType: string;
    backendNodeId?: number | undefined;
}

interface MismatchInfo {
    issue: RoleMismatchIssue;
    description: string;
}

export class RoleMismatchRule implements Rule<ScreenReaderContext, RoleMismatchStats> {
    readonly id = 'role-mismatch';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '4.1.2', level: 'A' },
        },
        summary: "Element's ARIA role doesn't match the underlying HTML element",
    };

    async run(ctx: AuditContext): Promise<RuleResult<ScreenReaderContext, RoleMismatchStats>> {
        const { transcript } = ctx;
        const violations: ScreenReaderViolation[] = [];
        const byIssue: Record<string, number> = {};
        let totalChecked = 0;

        const elements: ElementInfo[] = [];

        for (const result of transcript) {
            const strategyType = result.meta.name;

            for (let stepIndex = 0; stepIndex < result.navigationSteps.length; stepIndex++) {
                const step = result.navigationSteps[stepIndex]!;
                const node = step.axNode;

                if (!node) continue;

                const role = getRole(node);
                if (!role) continue;

                elements.push({
                    role,
                    htmlTag: this.extractHtmlTag(step.htmlSnippet),
                    name: getName(node) ?? '',
                    stepIndex,
                    htmlSnippet: step.htmlSnippet,
                    spokenPhrases: step.spokenPhrases,
                    focusedElementText: step.focusedElementText,
                    identifier: step.identifier,
                    timestamp: step.timestamp,
                    axNode: node,
                    strategyType,
                    backendNodeId: node.backendDOMNodeId,
                });
            }
        }

        const uniqueElements = this.deduplicateElements(elements);

        for (const element of uniqueElements) {
            if (!element.htmlTag) continue;

            totalChecked++;
            const mismatch = this.detectMismatch(element);

            if (mismatch) {
                byIssue[mismatch.issue] = (byIssue[mismatch.issue] ?? 0) + 1;
                const context = createScreenReaderContext(
                    {
                        identifier: element.identifier,
                        spokenPhrases: element.spokenPhrases,
                        focusedElementText: element.focusedElementText,
                        axNode: element.axNode,
                    },
                    element.strategyType,
                    element.stepIndex,
                    ctx.screenReader
                );
                violations.push(
                    buildViolation({
                        ruleId: 'role-mismatch',
                        impact: 'moderate',
                        stepId: `role-mismatch-${element.identifier}`,
                        message: `${mismatch.description} Element: <${element.htmlTag}> with role="${element.role}"${element.name ? ` and name "${element.name}"` : ''}.`,
                        timestamp: element.timestamp,
                        context,
                        htmlSnippet: element.htmlSnippet,
                        screenReader: ctx.screenReader,
                    })
                );
            }
        }

        return {
            violations,
            stats: {
                totalElementsChecked: totalChecked,
                violationsFound: violations.length,
                byIssue,
            },
        };
    }

    private detectMismatch(element: ElementInfo): MismatchInfo | null {
        const { role, htmlTag } = element;
        if (!htmlTag) return null;

        const tag = htmlTag.toLowerCase();
        const expectedRoles = ELEMENT_EXPECTED_ROLES[tag];

        if (tag === 'a' && role === 'button') {
            return {
                issue: 'link-as-button',
                description:
                    'Link (<a>) has role="button". This can confuse users as Enter activates links but Enter/Space activate buttons.',
            };
        }

        if (tag === 'button' && role === 'link') {
            return {
                issue: 'button-as-link',
                description:
                    'Button has role="link". Users expect links to navigate, but this button may perform an action instead.',
            };
        }

        if (tag === 'div' && INTERACTIVE_ROLES.includes(role)) {
            return {
                issue: 'div-as-interactive',
                description: `Non-interactive <div> has role="${role}". Custom interactive elements may lack proper keyboard support.`,
            };
        }

        if (tag === 'span' && INTERACTIVE_ROLES.includes(role)) {
            return {
                issue: 'span-as-interactive',
                description: `Non-interactive <span> has role="${role}". Custom interactive elements may lack proper keyboard support.`,
            };
        }

        if (expectedRoles && !expectedRoles.includes(role) && INTERACTIVE_ROLES.includes(role)) {
            return {
                issue: 'element-role-override',
                description: `<${tag}> has unexpected role="${role}". Expected one of: ${expectedRoles.join(', ')}.`,
            };
        }

        return null;
    }

    private extractHtmlTag(htmlSnippet: string | null): string | null {
        if (!htmlSnippet) return null;
        const match = htmlSnippet.match(/^<([a-z][a-z0-9-]*)/i);
        return match?.[1]?.toLowerCase() ?? null;
    }

    private deduplicateElements(elements: ElementInfo[]): ElementInfo[] {
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
}

export const rule = new RoleMismatchRule();
