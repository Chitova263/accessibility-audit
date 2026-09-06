import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { ScreenReaderContext, ScreenReaderViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { buildViolation } from '../../rule-catalog';
import { createScreenReaderContext } from '../../../utils/tool-details';
import { capitalize } from '../../../utils/string-utils';
import { getScreenReaderDisplayName } from '../../../../screen-reader/screen-reader-type';
import type { AXNode } from '../../../../types/cdp';
import { getRole, getName } from '../../../../types/ax-utils';

/** Form field roles that require labels */
const FORM_FIELD_ROLES = [
    'textbox',
    'searchbox',
    'combobox',
    'listbox',
    'spinbutton',
    'slider',
    'checkbox',
    'radio',
    'switch',
] as const;

interface FormFieldNoLabelStats {
    totalFormFields: number;
    fieldsWithoutLabels: number;
    byRole: Record<string, { total: number; unlabeled: number }>;
}

interface FormFieldInfo {
    role: string;
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

class FormFieldNoLabelRule implements Rule<ScreenReaderContext, FormFieldNoLabelStats> {
    readonly id = 'form-field-no-label';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '3.3.2', level: 'A' },
            related: [
                { criterion: '1.3.1', level: 'A' },
                { criterion: '4.1.2', level: 'A' },
            ],
        },
        summary: 'Form field has no accessible label',
    };

    async run(ctx: AuditContext): Promise<RuleResult<ScreenReaderContext, FormFieldNoLabelStats>> {
        const { transcript } = ctx;
        const violations: ScreenReaderViolation[] = [];
        const byRole: Record<string, { total: number; unlabeled: number }> = {};

        const formFields: FormFieldInfo[] = [];

        for (const result of transcript) {
            const strategyType = result.meta.name;

            for (let stepIndex = 0; stepIndex < result.navigationSteps.length; stepIndex++) {
                const step = result.navigationSteps[stepIndex]!;
                const node = step.axNode;

                if (!node) continue;

                const role = getRole(node);
                if (!role || !FORM_FIELD_ROLES.includes(role as (typeof FORM_FIELD_ROLES)[number])) {
                    continue;
                }

                formFields.push({
                    role,
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

        const uniqueFields = this.deduplicateFields(formFields);

        for (const field of uniqueFields) {
            if (!byRole[field.role]) {
                byRole[field.role] = { total: 0, unlabeled: 0 };
            }
            const roleStats = byRole[field.role]!;
            roleStats.total++;

            const hasLabel = field.name.trim() !== '';

            if (!hasLabel) {
                roleStats.unlabeled++;
                const context = createScreenReaderContext(
                    {
                        identifier: field.identifier,
                        spokenPhrases: field.spokenPhrases,
                        focusedElementText: field.focusedElementText,
                        axNode: field.axNode,
                    },
                    field.strategyType,
                    field.stepIndex,
                    ctx.screenReader
                );
                const roleDesc = this.getRoleDescription(field.role);
                const screenReaderDisplayName = getScreenReaderDisplayName(ctx.screenReader);

                violations.push(
                    buildViolation({
                        ruleId: 'form-field-no-label',
                        impact: 'critical',
                        stepId: `unlabeled-form-field-${field.identifier}`,
                        message: `${capitalize(roleDesc)} has no accessible label. Screen reader users will not know what information to enter. ${screenReaderDisplayName} announced: "${field.focusedElementText || '(nothing)'}"`,
                        timestamp: field.timestamp,
                        context,
                        htmlSnippet: field.htmlSnippet,
                        screenReader: ctx.screenReader,
                    })
                );
            }
        }

        return {
            violations,
            stats: {
                totalFormFields: uniqueFields.length,
                fieldsWithoutLabels: violations.length,
                byRole,
            },
        };
    }

    private deduplicateFields(fields: FormFieldInfo[]): FormFieldInfo[] {
        const seen = new Set<string>();
        const unique: FormFieldInfo[] = [];

        for (const field of fields) {
            const key = `${field.role}:${field.name}:${field.htmlSnippet ?? ''}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(field);
            }
        }

        return unique;
    }

    private getRoleDescription(role: string): string {
        const descriptions: Record<string, string> = {
            textbox: 'text input',
            searchbox: 'search field',
            combobox: 'dropdown/combo box',
            listbox: 'list box',
            spinbutton: 'number input',
            slider: 'slider',
            checkbox: 'checkbox',
            radio: 'radio button',
            switch: 'toggle switch',
        };
        return descriptions[role] ?? role;
    }
}

export const rule = new FormFieldNoLabelRule();
