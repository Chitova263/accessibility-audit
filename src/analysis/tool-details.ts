/**
 * NVDA Tool Details
 *
 * Builds the tool-specific half of a violation. Every NVDA analyzer routes
 * through here so that `toolDetails` has one shape across all of them.
 *
 * The AX node is projected rather than passed through: a raw CDP `AXNode` holds
 * `role`/`name` as `AXValue` objects (`{ type, value }`) and carries `childIds`,
 * `backendDOMNodeId` and other fields that have no place in a violation. Casting
 * it straight into `NvdaToolDetails` type-checks only because the analyzers hold
 * it as `unknown`, and it ships the wrong shape.
 */

import type { NvdaToolDetails } from './violation';

/**
 * The fields needed from whatever the analyzer is holding — satisfied by a
 * `NavigationStep` as well as by the per-analyzer info structs.
 */
export interface ToolDetailsSource {
    spokenPhrases: string[];
    itemText: string;
    axNode: unknown;
}

export function createToolDetails(
    source: ToolDetailsSource,
    navigationStrategy: string,
    stepIndex: number
): NvdaToolDetails {
    return {
        spokenPhrases: source.spokenPhrases,
        itemText: source.itemText,
        navigationStrategy,
        stepIndex,
        axNode: projectAxNode(source.axNode),
    };
}

/** Flatten a CDP AXNode down to the fields a violation reports. */
function projectAxNode(node: unknown): NvdaToolDetails['axNode'] {
    if (typeof node !== 'object' || node === null) return undefined;

    const axNode = node as {
        nodeId?: unknown;
        role?: { value?: unknown } | undefined;
        name?: { value?: unknown } | undefined;
        properties?: unknown;
    };

    return {
        nodeId: typeof axNode.nodeId === 'string' ? axNode.nodeId : String(axNode.nodeId ?? ''),
        role: typeof axNode.role?.value === 'string' ? axNode.role.value : undefined,
        name: typeof axNode.name?.value === 'string' ? axNode.name.value : undefined,
        properties: axNode.properties,
    };
}
