import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { NvdaContext, NvdaViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { createNvdaContext } from '../../../utils/tool-details';
import { captureScreenshotToFile } from '../../../utils/screenshot-capture';
import { capitalize } from '../../../utils/string-utils';

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

export class EmptyAccessibleNameRule implements Rule<NvdaContext, EmptyAccessibleNameStats> {
    readonly id = 'empty-accessible-name';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '4.1.2', level: 'A' },
            related: [{ criterion: '1.1.1', level: 'A' }],
        },
        impact: 'serious',
        summary: 'Interactive element has no accessible name',
    };

    async run(ctx: AuditContext): Promise<RuleResult<NvdaContext, EmptyAccessibleNameStats>> {
        const { transcript, page, cdp, screenshotsDir } = ctx;
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
                if (name.trim() !== '') continue;

                byRole[role] = (byRole[role] ?? 0) + 1;

                const context = createNvdaContext(step, result.meta.type ?? result.meta.name, stepIndex);

                const backendNodeId = node.backendDOMNodeId;
                if (typeof backendNodeId === 'number') {
                    const filename = `${this.id}-${step.identifier}`;
                    context.screenshot = await captureScreenshotToFile(
                        page,
                        cdp,
                        backendNodeId,
                        screenshotsDir,
                        filename,
                        { label: `${this.id}: ${this.meta.summary}` }
                    );
                }

                violations.push(this.createViolation(step, role, context));
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

    private createViolation(
        step: { identifier: string; htmlSnippet?: string | null; timestamp: number },
        role: string,
        context: NvdaContext
    ): NvdaViolation {
        return {
            id: step.identifier,
            rule: {
                id: this.id,
                summary: this.meta.summary,
                wcag: this.meta.wcag,
                impact: this.meta.impact,
            },
            message: `${capitalize(role)} has no accessible name. Screen readers will announce only "${role}" with no indication of purpose.`,
            element: step.htmlSnippet != null ? { htmlSnippet: step.htmlSnippet } : {},
            tool: 'nvda-audit',
            timestamp: step.timestamp,
            context,
        };
    }
}

export const rule = new EmptyAccessibleNameRule();
