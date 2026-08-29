/**
 * Analyzer: Keyboard Accessibility
 *
 * Detects interactive elements that are not keyboard accessible
 * by comparing browse mode results (B/K keys) with focus mode (Tab).
 *
 * If an element is reachable via quick navigation but not via Tab,
 * it may not be properly keyboard accessible.
 *
 * Maps to WCAG 2.1.1 (Keyboard).
 */

import type {
    StrategyResult,
    NavigationStep,
} from '../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';
import type { NvdaViolation, NvdaToolDetails } from '../violation';

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
}

export function analyzeKeyboardAccessibility(strategyResults: StrategyResult[]): KeyboardAccessibilityAnalyzerResult {
    const violations: NvdaViolation[] = [];
    const byIssue: Record<KeyboardIssue, number> = {
        'button-not-in-tab-order': 0,
        'link-not-in-tab-order': 0,
    };

    // Collect elements from each strategy type
    const buttonsByBrowse: ElementSignature[] = [];
    const linksByBrowse: ElementSignature[] = [];
    const elementsInTabOrder = new Set<string>();

    for (const result of strategyResults) {
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
                });
            }

            if (strategyType === 'link' && node?.role?.value === 'link') {
                linksByBrowse.push({
                    name: node.name?.value ?? '',
                    htmlSnippet: step.htmlSnippet,
                    step,
                    strategyType,
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
            violations.push(createNotInTabOrderViolation(button, 'button'));
        }
    }

    // Check: Links in browse mode but not in tab order
    for (const link of linksByBrowse) {
        const signature = createSignature(link.step);

        if (!elementsInTabOrder.has(signature) && !isLikelyInTabOrder(link, elementsInTabOrder)) {
            byIssue['link-not-in-tab-order']++;
            violations.push(createNotInTabOrderViolation(link, 'link'));
        }
    }

    return {
        violations,
        summary: {
            buttonsInBrowseMode: buttonsByBrowse.length,
            buttonsInFocusMode: countByRole(strategyResults, 'tab', 'button'),
            linksInBrowseMode: linksByBrowse.length,
            linksInFocusMode: countByRole(strategyResults, 'tab', 'link'),
            violationsFound: violations.length,
            byIssue,
        },
    };
}

/**
 * Create a signature for matching elements across strategies.
 * Uses name + snippet as identity since we don't have stable selectors.
 */
function createSignature(step: NavigationStep): string {
    const name = step.axNode?.name?.value ?? '';
    const snippet = step.htmlSnippet ?? '';
    return `${name}::${snippet}`.toLowerCase();
}

/**
 * Fuzzy check if element is likely in tab order.
 * Matches by name since HTML snippets might differ slightly.
 */
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

function createNotInTabOrderViolation(element: ElementSignature, role: 'button' | 'link'): NvdaViolation {
    const toolDetails: NvdaToolDetails = {
        spokenPhrases: element.step.spokenPhrases,
        itemText: element.step.itemText,
        navigationStrategy: element.strategyType,
        stepIndex: 0,
        axNode: element.step.axNode as NvdaToolDetails['axNode'],
    };

    const ruleId = role === 'button' ? 'button-not-in-tab-order' : 'link-not-in-tab-order';
    const keyUsed = role === 'button' ? 'B' : 'K';

    return {
        id: `${ruleId}-${element.step.identifier}`,
        ruleId,
        wcag: {
            primary: { criterion: '2.1.1', level: 'A' },
        },
        impact: 'serious',
        message: `${capitalize(role)} "${element.name || '(unnamed)'}" is reachable via ${keyUsed} key navigation but not in the Tab order. This ${role} may not be keyboard accessible.`,
        element: {
            htmlSnippet: element.htmlSnippet ?? undefined,
        },
        tool: 'nvda-audit',
        timestamp: element.step.timestamp,
        toolDetails,
    };
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
