import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { ScreenReaderContext, ScreenReaderViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
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

export interface EmptyAccessibleNameStats {
    totalElementsChecked: number;
    violationsFound: number;
    byRole: Record<string, number>;
}

export class EmptyAccessibleNameRule implements Rule<ScreenReaderContext, EmptyAccessibleNameStats> {
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

        for (const result of transcript) {
            for (let stepIndex = 0; stepIndex < result.navigationSteps.length; stepIndex++) {
                const step = result.navigationSteps[stepIndex]!;
                const node = step.axNode;

                if (!node) continue;

                const role = getRole(node);
                if (!role || !ROLES_REQUIRING_NAME.includes(role as (typeof ROLES_REQUIRING_NAME)[number])) {
                    continue;
                }

                totalChecked++;
                const name = getName(node) ?? '';
                if (name.trim() !== '') continue;

                byRole[role] = (byRole[role] ?? 0) + 1;

                const context = createScreenReaderContext(step, result.meta.name, stepIndex, ctx.screenReader);

                violations.push(
                    buildViolation({
                        ruleId: 'empty-accessible-name',
                        impact: 'serious',
                        stepId: step.identifier,
                        message: `${capitalize(role)} has no accessible name. Screen readers will announce only "${role}" with no indication of purpose.`,
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
