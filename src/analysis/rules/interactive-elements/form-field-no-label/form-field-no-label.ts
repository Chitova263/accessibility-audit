/**
 * Rule: Form Field No Label
 *
 * Detects form fields that are missing accessible labels.
 *
 * Maps to WCAG 1.3.1 (Info and Relationships),
 * 3.3.2 (Labels or Instructions), and 4.1.2 (Name, Role, Value).
 */

import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { NvdaContext, NvdaViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { createNvdaContext } from '../../../utils/tool-details';
import { captureScreenshotToFile } from '../../../utils/screenshot-capture';
import { capitalize } from '../../../utils/string-utils';

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

export interface FormFieldNoLabelStats {
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
    itemText: string;
    identifier: string;
    timestamp: number;
    axNode: unknown;
    strategyType: string;
    backendNodeId?: number;
}

export class FormFieldNoLabelRule implements Rule<NvdaContext, FormFieldNoLabelStats> {
    readonly id = 'form-field-no-label';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '3.3.2', level: 'A' },
            related: [
                { criterion: '1.3.1', level: 'A' },
                { criterion: '4.1.2', level: 'A' },
            ],
        },
        impact: 'critical',
        summary: 'Form field has no accessible label',
    };

    async run(ctx: AuditContext): Promise<RuleResult<NvdaContext, FormFieldNoLabelStats>> {
        const { transcript, page, cdp, screenshotsDir } = ctx;
        const violations: NvdaViolation[] = [];
        const byRole: Record<string, { total: number; unlabeled: number }> = {};

        const formFields: FormFieldInfo[] = [];

        for (const result of transcript) {
            const strategyType = result.meta.type ?? result.meta.name;

            for (let stepIndex = 0; stepIndex < result.navigationSteps.length; stepIndex++) {
                const step = result.navigationSteps[stepIndex]!;
                const node = step.axNode;

                if (!node) continue;

                const role = node.role?.value;
                if (!role || !FORM_FIELD_ROLES.includes(role as (typeof FORM_FIELD_ROLES)[number])) {
                    continue;
                }

                formFields.push({
                    role,
                    name: node.name?.value ?? '',
                    stepIndex,
                    htmlSnippet: step.htmlSnippet,
                    spokenPhrases: step.spokenPhrases,
                    itemText: step.itemText,
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
                const context = createNvdaContext(
                    {
                        identifier: field.identifier,
                        spokenPhrases: field.spokenPhrases,
                        itemText: field.itemText,
                        axNode: field.axNode,
                    },
                    field.strategyType,
                    field.stepIndex
                );
                if (typeof field.backendNodeId === 'number') {
                    const filename = `${this.id}-${field.identifier}`;
                    context.screenshot = await captureScreenshotToFile(
                        page,
                        cdp,
                        field.backendNodeId,
                        screenshotsDir,
                        filename,
                        { label: `${this.id}: ${this.meta.summary}` }
                    );
                }
                violations.push(this.createViolation(field, context));
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

    private createViolation(field: FormFieldInfo, context: NvdaContext): NvdaViolation {
        const roleDesc = this.getRoleDescription(field.role);

        return {
            id: `unlabeled-form-field-${field.identifier}`,
            rule: {
                id: this.id,
                summary: this.meta.summary,
                wcag: this.meta.wcag,
                impact: this.meta.impact,
            },
            message: `${capitalize(roleDesc)} has no accessible label. Screen reader users will not know what information to enter. NVDA announced: "${field.itemText || '(nothing)'}"`,
            ...(field.htmlSnippet != null && { element: { htmlSnippet: field.htmlSnippet } }),
            tool: 'nvda-audit',
            timestamp: field.timestamp,
            context,
        };
    }
}

export const rule = new FormFieldNoLabelRule();
