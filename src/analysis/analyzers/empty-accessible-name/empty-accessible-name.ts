/**
 * Analyzer: Empty Accessible Name
 *
 * Detects interactive elements that have no accessible name.
 * Maps to WCAG 4.1.2 (Name, Role, Value).
 *
 * When a button, link, or form control has no accessible name,
 * screen readers announce only the role (e.g., "button") with
 * no indication of purpose.
 */

import type { NavigationStep } from '../../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';
import type { NvdaViolation, NvdaContext } from '../../core/violation';
import type { AuditContext } from '../../core/context';
import { createNvdaContext } from '../../utils/tool-details';
import { getRule } from '../../registry/rule-catalog';
import { captureScreenshot } from '../../utils/screenshot-capture';
import { capitalize } from '../../utils/string-utils';

/** Roles that require an accessible name per WCAG 4.1.2 */
const ROLES_REQUIRING_NAME = [
    'button',
    'link',
    'textbox',
    'checkbox',
    'radio',
    'combobox',
    'listbox',
    'menuitem',
    'menuitemcheckbox',
    'menuitemradio',
    'option',
    'slider',
    'spinbutton',
    'switch',
    'tab',
    'treeitem',
    'searchbox',
    'img',
] as const;

export interface EmptyAccessibleNameAnalyzerResult {
    violations: NvdaViolation[];
    summary: {
        totalElementsChecked: number;
        violationsFound: number;
        byRole: Record<string, number>;
    };
}

export async function analyzeEmptyAccessibleNames(ctx: AuditContext): Promise<EmptyAccessibleNameAnalyzerResult> {
    const { transcript, page, cdp } = ctx;
    const violations: NvdaViolation[] = [];
    let totalChecked = 0;
    const byRole: Record<string, number> = {};

    for (const result of transcript) {
        for (let stepIndex = 0; stepIndex < result.navigationSteps.length; stepIndex++) {
            const step = result.navigationSteps[stepIndex]!;
            const node = step.axNode;

            if (!node) continue;

            const role = node.role?.value;
            if (!role || !ROLES_REQUIRING_NAME.includes(role as (typeof ROLES_REQUIRING_NAME)[number])) {
                continue;
            }

            totalChecked++;

            const name = node.name?.value ?? '';
            const isEmpty = name.trim() === '';

            if (isEmpty) {
                byRole[role] = (byRole[role] ?? 0) + 1;

                const context = createNvdaContext(step, result.meta.type ?? result.meta.name, stepIndex);

                // Capture screenshot if element has a backend node ID
                const backendNodeId = node.backendDOMNodeId;
                if (typeof backendNodeId === 'number') {
                    context.screenshot = (await captureScreenshot(page, cdp, backendNodeId)) ?? undefined;
                }

                violations.push(createViolation(step, role, context));
            }
        }
    }

    return {
        violations,
        summary: {
            totalElementsChecked: totalChecked,
            violationsFound: violations.length,
            byRole,
        },
    };
}

function createViolation(step: NavigationStep, role: string, context: NvdaContext): NvdaViolation {
    return {
        id: step.identifier,
        rule: getRule('empty-accessible-name'),
        message: `${capitalize(role)} has no accessible name. Screen readers will announce only "${role}" with no indication of purpose.`,
        element: step.htmlSnippet != null ? { htmlSnippet: step.htmlSnippet } : {},
        tool: 'nvda-audit',
        timestamp: step.timestamp,
        context,
    };
}
