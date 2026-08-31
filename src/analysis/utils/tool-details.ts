import type { NvdaContext } from '../core/violation';

export interface ContextSource {
    identifier: string;
    spokenPhrases: string[];
    itemText: string;
    axNode?: unknown;
}

export function createNvdaContext(source: ContextSource, strategy: string, stepIndex: number): NvdaContext {
    const axNode = projectAxNode(source.axNode);
    return {
        source: {
            strategy,
            stepIndex,
            stepId: source.identifier,
            spokenPhrase: source.spokenPhrases.join(' ').trim() || source.itemText,
        },
        ...(axNode && { axNode }),
    };
}

function projectAxNode(node: unknown): NvdaContext['axNode'] | undefined {
    if (typeof node !== 'object' || node === null) return undefined;

    const axNode = node as {
        nodeId?: unknown;
        role?: { value?: unknown };
        name?: { value?: unknown };
        properties?: unknown;
    };

    const role = typeof axNode.role?.value === 'string' ? axNode.role.value : undefined;
    const name = typeof axNode.name?.value === 'string' ? axNode.name.value : undefined;

    const result: NvdaContext['axNode'] = {
        nodeId: typeof axNode.nodeId === 'string' ? axNode.nodeId : String(axNode.nodeId ?? ''),
    };

    if (role) result.role = role;
    if (name) result.name = name;
    if (axNode.properties) result.properties = axNode.properties;

    return result;
}
