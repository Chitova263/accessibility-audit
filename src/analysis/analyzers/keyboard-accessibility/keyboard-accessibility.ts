/**
 * Analyzer: Keyboard Accessibility
 *
 * Detects interactive elements that are not keyboard accessible
 * by comparing browse mode results (B/K keys) with focus mode (Tab).
 *
 * Maps to WCAG 2.1.1 (Keyboard).
 */

import type {
    StrategyResult,
    NavigationStep,
} from '../../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';
import type { NvdaViolation, NvdaContext } from '../../core/violation';
import type { AuditContext } from '../../core/context';
import { createNvdaContext } from '../../utils/tool-details';
import { getRule } from '../../registry/rule-catalog';
import { captureScreenshot } from '../../utils/screenshot-capture';
import { capitalize } from '../../utils/string-utils';

type KeyboardIssue = 'button-not-in-tab-order' | 'link-not-in-tab-order';

export interface KeyboardAccessibilityAnalyzerResult {
    violations: NvdaViolation[];
    summary: {
        buttonsInBrowseMode: number;
        buttonsInFocusMode: number;
        linksInBrowseMode: number;
        linksInFocusMode: number;
        violationsFound: number;
        byIssue: Record<KeyboardIssue, number>;
    };
}

interface ElementSignature {
    name: string;
    htmlSnippet: string | null;
    step: NavigationStep;
    strategyType: string;
    backendNodeId?: number;
}

export async function analyzeKeyboardAccessibility(ctx: AuditContext): Promise<KeyboardAccessibilityAnalyzerResult> {
    const { transcript, page, cdp } = ctx;
    const violations: NvdaViolation[] = [];
    const byIssue: Record<KeyboardIssue, number> = {
        'button-not-in-tab-order': 0,
        'link-not-in-tab-order': 0,
    };

    // Collect elements from each strategy type
    const buttonsByBrowse: ElementSignature[] = [];
    const linksByBrowse: ElementSignature[] = [];
    const elementsInTabOrder = new Set<string>();

    for (const result of transcript) {
        const strategyType = result.meta.type ?? result.meta.name;

        for (const step of result.navigationSteps) {
            const node = step.axNode;
            const signature = createSignature(step);

            if (strategyType === 'button' && node?.role?.value === 'button') {
                buttonsByBrowse.push({
                    name: node.name?.value ?? '',
                    htmlSnippet: step.htmlSnippet,
                    step,
                    strategyType,
                    backendNodeId: node.backendDOMNodeId,
                });
            }

            if (strategyType === 'link' && node?.role?.value === 'link') {
                linksByBrowse.push({
                    name: node.name?.value ?? '',
                    htmlSnippet: step.htmlSnippet,
                    step,
                    strategyType,
                    backendNodeId: node.backendDOMNodeId,
                });
            }

            if (strategyType === 'tab') {
                elementsInTabOrder.add(signature);
            }
        }
    }

    // Check: Buttons in browse mode but not in tab order
    for (const button of buttonsByBrowse) {
        const signature = createSignature(button.step);

        if (!elementsInTabOrder.has(signature) && !isLikelyInTabOrder(button, elementsInTabOrder)) {
            byIssue['button-not-in-tab-order']++;
            const context = createNvdaContext(button.step, button.strategyType, 0);
            if (typeof button.backendNodeId === 'number') {
                context.screenshot = (await captureScreenshot(page, cdp, button.backendNodeId)) ?? undefined;
            }
            violations.push(createNotInTabOrderViolation(button, 'button', context));
        }
    }

    // Check: Links in browse mode but not in tab order
    for (const link of linksByBrowse) {
        const signature = createSignature(link.step);

        if (!elementsInTabOrder.has(signature) && !isLikelyInTabOrder(link, elementsInTabOrder)) {
            byIssue['link-not-in-tab-order']++;
            const context = createNvdaContext(link.step, link.strategyType, 0);
            if (typeof link.backendNodeId === 'number') {
                context.screenshot = (await captureScreenshot(page, cdp, link.backendNodeId)) ?? undefined;
            }
            violations.push(createNotInTabOrderViolation(link, 'link', context));
        }
    }

    return {
        violations,
        summary: {
            buttonsInBrowseMode: buttonsByBrowse.length,
            buttonsInFocusMode: countByRole(transcript, 'tab', 'button'),
            linksInBrowseMode: linksByBrowse.length,
            linksInFocusMode: countByRole(transcript, 'tab', 'link'),
            violationsFound: violations.length,
            byIssue,
        },
    };
}

function createSignature(step: NavigationStep): string {
    const name = step.axNode?.name?.value ?? '';
    const snippet = step.htmlSnippet ?? '';
    return `${name}::${snippet}`.toLowerCase();
}

function isLikelyInTabOrder(element: ElementSignature, tabOrderSignatures: Set<string>): boolean {
    const elementName = element.name.toLowerCase().trim();
    if (!elementName) return false;

    for (const sig of tabOrderSignatures) {
        if (sig.includes(elementName)) {
            return true;
        }
    }
    return false;
}

function countByRole(results: StrategyResult[], strategyType: string, role: string): number {
    let count = 0;
    for (const result of results) {
        if ((result.meta.type ?? result.meta.name) !== strategyType) continue;
        for (const step of result.navigationSteps) {
            if (step.axNode?.role?.value === role) count++;
        }
    }
    return count;
}

function createNotInTabOrderViolation(
    element: ElementSignature,
    role: 'button' | 'link',
    context: NvdaContext
): NvdaViolation {
    const ruleId = role === 'button' ? 'button-not-in-tab-order' : 'link-not-in-tab-order';
    const keyUsed = role === 'button' ? 'B' : 'K';

    return {
        id: `${ruleId}-${element.step.identifier}`,
        rule: getRule(ruleId),
        message: `${capitalize(role)} "${element.name || '(unnamed)'}" is reachable via ${keyUsed} key navigation but not in the Tab order. This ${role} may not be keyboard accessible.`,
        ...(element.htmlSnippet != null ? { element: { htmlSnippet: element.htmlSnippet } } : {}),
        tool: 'nvda-audit',
        timestamp: element.step.timestamp,
        context,
    };
}
