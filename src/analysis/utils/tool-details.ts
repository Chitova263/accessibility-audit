import type { NvdaContext } from '../core/violation';

export interface ContextSource {
    identifier: string;
    spokenPhrases: string[];
    itemText: string;
    axNode?: unknown;
}

export function createNvdaContext(source: ContextSource, strategy: string, stepIndex: number): NvdaContext {
    return {
        step: {
            strategy,
            index: stepIndex,
            id: source.identifier,
            spokenPhrase: source.spokenPhrases.join(' ').trim() || source.itemText,
        },
        axNode: projectAxNode(source.axNode),
    };
}

function projectAxNode(node: unknown): NvdaContext['axNode'] {
    if (typeof node !== 'object' || node === null) return undefined;

    const axNode = node as {
        nodeId?: unknown;
        role?: { value?: unknown };
        name?: { value?: unknown };
        properties?: unknown;
    };

    return {
        nodeId: typeof axNode.nodeId === 'string' ? axNode.nodeId : String(axNode.nodeId ?? ''),
        role: typeof axNode.role?.value === 'string' ? axNode.role.value : undefined,
        name: typeof axNode.name?.value === 'string' ? axNode.name.value : undefined,
        properties: axNode.properties,
    };
}
