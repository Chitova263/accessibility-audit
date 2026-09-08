import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { ScreenReaderContext, ScreenReaderViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import type { NavigationStep } from '../../../../screen-reader/strategies/navigation-strategy';
import { buildViolation } from '../../rule-catalog';
import { createScreenReaderContext } from '../../../utils/tool-details';
import { capitalize } from '../../../utils/string-utils';
import { getRole, getName } from '../../../../types/ax-utils';

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

/**
 * Roles that don't inherently require a name, but DO require one when they
 * have click handlers (announced as "clickable" by NVDA).
 */
const GENERIC_ROLES_CLICKABLE = ['generic', 'group', 'section', 'article'] as const;

interface EmptyAccessibleNameStats {
    totalElementsChecked: number;
    violationsFound: number;
    byRole: Record<string, number>;
}

/**
 * Checks if a step represents a clickable element based on the screen reader announcement.
 * NVDA announces "clickable" for elements with click handlers.
 */
function isClickableAnnouncement(step: NavigationStep): boolean {
    const text = step.focusedElementText.toLowerCase();
    return text.includes('clickable');
}

class EmptyAccessibleNameRule implements Rule<ScreenReaderContext, EmptyAccessibleNameStats> {
    readonly id = 'empty-accessible-name';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '4.1.2', level: 'A' },
            related: [{ criterion: '1.1.1', level: 'A' }],
        },
        summary: 'Interactive element has no accessible name',
    };

    async run(ctx: AuditContext): Promise<RuleResult<ScreenReaderContext, EmptyAccessibleNameStats>> {
        const { transcript } = ctx;
        const violations: ScreenReaderViolation[] = [];
        let totalChecked = 0;
        const byRole: Record<string, number> = {};
        const seen = new Set<string>();

        for (const result of transcript) {
            for (let stepIndex = 0; stepIndex < result.navigationSteps.length; stepIndex++) {
                const step = result.navigationSteps[stepIndex]!;
                const node = step.axNode;

                if (!node) continue;

                const role = getRole(node);
                if (!role) continue;

                const name = getName(node) ?? '';
                const isNameEmpty = name.trim() === '';

                // Check 1: Standard interactive roles that always require a name
                const isStandardInteractive = ROLES_REQUIRING_NAME.includes(
                    role as (typeof ROLES_REQUIRING_NAME)[number]
                );

                // Check 2: Generic roles that are clickable and have no name
                const isClickableGeneric =
                    GENERIC_ROLES_CLICKABLE.includes(role as (typeof GENERIC_ROLES_CLICKABLE)[number]) &&
                    isClickableAnnouncement(step);

                if (!isStandardInteractive && !isClickableGeneric) {
                    continue;
                }

                totalChecked++;

                if (!isNameEmpty) continue;

                // Dedupe by backendDOMNodeId to avoid flagging the same element across strategies
                const nodeId = node.backendDOMNodeId;
                if (nodeId !== undefined) {
                    if (seen.has(String(nodeId))) continue;
                    seen.add(String(nodeId));
                }

                byRole[role] = (byRole[role] ?? 0) + 1;

                const context = createScreenReaderContext(step, result.meta.name, stepIndex, ctx.screenReader);

                const roleLabel = isClickableGeneric ? 'Clickable element' : capitalize(role);
                const announcement = isClickableGeneric ? 'clickable' : role;

                violations.push(
                    buildViolation({
                        ruleId: 'empty-accessible-name',
                        impact: 'serious',
                        stepId: step.identifier,
                        message: `${roleLabel} has no accessible name. Screen readers will announce only "${announcement}" with no indication of purpose.`,
                        timestamp: step.timestamp,
                        context,
                        htmlSnippet: step.htmlSnippet,
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
                byRole,
            },
        };
    }
}

export const rule = new EmptyAccessibleNameRule();
