/**
 * Shared helpers for rules that compare browse-mode element discovery
 * (B / K keys) against focus-mode Tab order.
 */

import type {
    StrategyResult,
    NavigationStep,
} from '../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';

export interface ElementSignature {
    name: string;
    htmlSnippet: string | null;
    step: NavigationStep;
    strategyType: string;
    backendNodeId?: number;
}

/**
 * Returns a stable, case-insensitive string key for a navigation step so that
 * elements discovered via different strategies can be compared.
 */
export function createSignature(step: NavigationStep): string {
    const name = step.axNode?.name?.value ?? '';
    const snippet = step.htmlSnippet ?? '';
    return `${name}::${snippet}`.toLowerCase();
}

/**
 * Fuzzy check: returns true when the element name appears anywhere inside one
 * of the tab-order signatures. Used as a fallback when the exact signature does
 * not match (e.g., slightly different HTML serialisation between strategies).
 */
export function isLikelyInTabOrder(element: ElementSignature, tabOrderSignatures: Set<string>): boolean {
    const elementName = element.name.toLowerCase().trim();
    if (!elementName) return false;

    for (const sig of tabOrderSignatures) {
        if (sig.includes(elementName)) {
            return true;
        }
    }
    return false;
}

/**
 * Counts elements matching a given role within a specific strategy type.
 * Useful for computing focus-mode counts (e.g., how many buttons were seen during Tab navigation).
 */
export function countByRole(transcript: StrategyResult[], strategyType: string, role: string): number {
    let count = 0;
    for (const result of transcript) {
        if ((result.meta.type ?? result.meta.name) !== strategyType) continue;
        for (const step of result.navigationSteps) {
            if (step.axNode?.role?.value === role) count++;
        }
    }
    return count;
}

/**
 * Iterates over a transcript and collects:
 *  - `elements`: every element whose strategy type and AX role match `strategyType` / `role`
 *  - `tabOrderSignatures`: the signature set of every element seen during `tab` navigation
 */
export function collectElementsByStrategy(
    transcript: StrategyResult[],
    strategyType: string,
    role: string
): { elements: ElementSignature[]; tabOrderSignatures: Set<string> } {
    const elements: ElementSignature[] = [];
    const tabOrderSignatures = new Set<string>();

    for (const result of transcript) {
        const currentStrategyType = result.meta.type ?? result.meta.name;

        for (const step of result.navigationSteps) {
            const node = step.axNode;
            const signature = createSignature(step);

            if (currentStrategyType === strategyType && node?.role?.value === role) {
                elements.push({
                    name: node.name?.value ?? '',
                    htmlSnippet: step.htmlSnippet,
                    step,
                    strategyType: currentStrategyType,
                    backendNodeId: node.backendDOMNodeId,
                });
            }

            if (currentStrategyType === 'tab') {
                tabOrderSignatures.add(signature);
            }
        }
    }

    return { elements, tabOrderSignatures };
}
