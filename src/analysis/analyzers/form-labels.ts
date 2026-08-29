/**
 * Analyzer: Form Labels
 *
 * Detects form fields that are missing accessible labels.
 * This is a specialized check for form-specific roles.
 *
 * Maps to WCAG 1.3.1 (Info and Relationships),
 * 3.3.2 (Labels or Instructions), and 4.1.2 (Name, Role, Value).
 */

import type { StrategyResult } from '../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';
import type { NvdaViolation, NvdaToolDetails } from '../violation';
import type { TranscriptContext } from '../context';
import { createToolDetails as buildToolDetails } from '../tool-details';
import { ruleMetadata } from '../rule-catalog';

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
}

export function analyzeFormLabels({ strategyResults }: TranscriptContext): FormLabelsAnalyzerResult {
    const violations: NvdaViolation[] = [];
    const byRole: Record<string, { total: number; unlabeled: number }> = {};

    // Collect form fields from all strategies (mainly Tab)
    const formFields: FormFieldInfo[] = [];

    for (const result of strategyResults) {
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
            });
        }
    }

    // Deduplicate
    const uniqueFields = deduplicateFields(formFields);

    // Analyze each field
    for (const field of uniqueFields) {
        // Initialize role stats
        if (!byRole[field.role]) {
            byRole[field.role] = { total: 0, unlabeled: 0 };
        }
        const roleStats = byRole[field.role]!;
        roleStats.total++;

        const hasLabel = field.name.trim() !== '';

        if (!hasLabel) {
            roleStats.unlabeled++;
            violations.push(createUnlabeledFieldViolation(field));
        }
    }

    const totalFormFields = uniqueFields.length;
    const fieldsWithoutLabels = violations.length;

    return {
        violations,
        summary: {
            totalFormFields,
            fieldsWithoutLabels,
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

function createToolDetails(field: FormFieldInfo): NvdaToolDetails {
    return buildToolDetails(field, field.strategyType, field.stepIndex);
}

function createUnlabeledFieldViolation(field: FormFieldInfo): NvdaViolation {
    const roleDesc = getRoleDescription(field.role);

    return {
        id: `unlabeled-form-field-${field.identifier}`,
        ...ruleMetadata('form-field-no-label'),
        message: `${capitalizeFirst(roleDesc)} has no accessible label. Screen reader users will not know what information to enter. NVDA announced: "${field.itemText || '(nothing)'}"`,
        element: {
            htmlSnippet: field.htmlSnippet ?? undefined,
        },
        tool: 'nvda-audit',
        timestamp: field.timestamp,
        toolDetails: createToolDetails(field),
    };
}

function capitalizeFirst(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
