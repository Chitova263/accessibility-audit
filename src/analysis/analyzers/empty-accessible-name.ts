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

import type {
    StrategyResult,
    NavigationStep,
} from '../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';
import type { NvdaViolation, NvdaToolDetails } from '../violation';
import type { TranscriptContext } from '../context';
import { createToolDetails } from '../tool-details';
import { ruleMetadata } from '../rule-catalog';

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

export function analyzeEmptyAccessibleNames({ strategyResults }: TranscriptContext): EmptyAccessibleNameAnalyzerResult {
    const violations: NvdaViolation[] = [];
    let totalChecked = 0;
    const byRole: Record<string, number> = {};

    for (const result of strategyResults) {
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

                violations.push(createViolation(step, role, result.meta.type ?? result.meta.name, stepIndex));
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

function createViolation(
    step: NavigationStep,
    role: string,
    navigationStrategy: string,
    stepIndex: number
): NvdaViolation {
    const toolDetails = createToolDetails(step, navigationStrategy, stepIndex);

    return {
        id: step.identifier,
        ...ruleMetadata('empty-accessible-name'),
        message: `${capitalizeFirst(role)} has no accessible name. Screen readers will announce only "${role}" with no indication of purpose.`,
        element: {
            htmlSnippet: step.htmlSnippet ?? undefined,
        },
        tool: 'nvda-audit',
        timestamp: step.timestamp,
        toolDetails,
    };
}

function capitalizeFirst(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
