import type { ScreenReaderContext } from '../core/violation';
import type { ScreenReaderName } from '../../screen-reader/drivers/types';

export interface ContextSource {
    identifier: string;
    spokenPhrases: string[];
    itemText: string;
    axNode?: unknown;
}

export function createScreenReaderContext(
    source: ContextSource,
    strategy: string,
    stepIndex: number,
    screenReader: ScreenReaderName
): ScreenReaderContext {
    const axNode = projectAxNode(source.axNode);
    return {
        source: {
            screenReader,
            strategy,
            stepIndex,
            stepId: source.identifier,
            spokenPhrase: source.spokenPhrases.join(' ').trim() || source.itemText,
        },
        ...(axNode && { axNode }),
    };
}

function projectAxNode(node: unknown): ScreenReaderContext['axNode'] | undefined {
    if (typeof node !== 'object' || node === null) return undefined;

    const axNode = node as {
        nodeId?: unknown;
        role?: { value?: unknown };
        name?: { value?: unknown };
        properties?: unknown;
    };

    const role = typeof axNode.role?.value === 'string' ? axNode.role.value : undefined;
    const name = typeof axNode.name?.value === 'string' ? axNode.name.value : undefined;

    const result: ScreenReaderContext['axNode'] = {
        nodeId: typeof axNode.nodeId === 'string' ? axNode.nodeId : String(axNode.nodeId ?? ''),
    };

    if (role) result.role = role;
    if (name) result.name = name;
    if (axNode.properties) result.properties = axNode.properties;

    return result;
}
