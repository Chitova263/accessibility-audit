/**
 * Analyzer: Form Labels
 *
 * Detects form fields that are missing accessible labels.
 *
 * Maps to WCAG 1.3.1 (Info and Relationships),
 * 3.3.2 (Labels or Instructions), and 4.1.2 (Name, Role, Value).
 */

import type { NvdaViolation, NvdaContext } from '../../core/violation';
import type { AuditContext } from '../../core/context';
import { createNvdaContext } from '../../utils/tool-details';
import { getRule } from '../../registry/rule-catalog';
import { captureScreenshot } from '../../utils/screenshot-capture';
import { capitalize } from '../../utils/string-utils';

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

export interface FormLabelsAnalyzerResult {
    violations: NvdaViolation[];
    summary: {
        totalFormFields: number;
        fieldsWithoutLabels: number;
        byRole: Record<string, { total: number; unlabeled: number }>;
    };
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

export async function analyzeFormLabels(ctx: AuditContext): Promise<FormLabelsAnalyzerResult> {
    const { transcript, page, cdp } = ctx;
    const violations: NvdaViolation[] = [];
    const byRole: Record<string, { total: number; unlabeled: number }> = {};

    // Collect form fields from all strategies (mainly Tab)
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

    // Deduplicate
    const uniqueFields = deduplicateFields(formFields);

    // Analyze each field
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
                context.screenshot = (await captureScreenshot(page, cdp, field.backendNodeId)) ?? undefined;
            }
            violations.push(createUnlabeledFieldViolation(field, context));
        }
    }

    return {
        violations,
        summary: {
            totalFormFields: uniqueFields.length,
            fieldsWithoutLabels: violations.length,
            byRole,
        },
    };
}

function deduplicateFields(fields: FormFieldInfo[]): FormFieldInfo[] {
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

function getRoleDescription(role: string): string {
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

function createUnlabeledFieldViolation(field: FormFieldInfo, context: NvdaContext): NvdaViolation {
    const roleDesc = getRoleDescription(field.role);

    return {
        id: `unlabeled-form-field-${field.identifier}`,
        rule: getRule('form-field-no-label'),
        message: `${capitalize(roleDesc)} has no accessible label. Screen reader users will not know what information to enter. NVDA announced: "${field.itemText || '(nothing)'}"`,
        ...(field.htmlSnippet != null && { element: { htmlSnippet: field.htmlSnippet } }),
        tool: 'nvda-audit',
        timestamp: field.timestamp,
        context,
    };
}
