import type { ScreenReaderContext } from '../core/violation';
import type { ScreenReaderType } from '../../screen-reader/screen-reader-type';

export interface ContextSource {
    identifier: string;
    spokenPhrases: string[];
    focusedElementText: string;
    axNode?: unknown;
}

export function createScreenReaderContext(
    source: ContextSource,
    strategy: string,
    stepIndex: number,
    screenReader: ScreenReaderType
): ScreenReaderContext {
    const axNode = projectAxNode(source.axNode);
    return {
        source: {
            screenReader,
            strategy,
            stepIndex,
            stepId: source.identifier,
            spokenPhrase: source.spokenPhrases.join(' ').trim() || source.focusedElementText,
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
        backendDOMNodeId?: unknown;
    };

    const role = typeof axNode.role?.value === 'string' ? axNode.role.value : undefined;
    const name = typeof axNode.name?.value === 'string' ? axNode.name.value : undefined;

    const result: ScreenReaderContext['axNode'] = {
        nodeId:
            typeof axNode.nodeId === 'string'
                ? axNode.nodeId
                : typeof axNode.nodeId === 'number'
                  ? String(axNode.nodeId)
                  : '',
    };

    if (role) result.role = role;
    if (name) result.name = name;
    if (axNode.properties) result.properties = axNode.properties;
    if (typeof axNode.backendDOMNodeId === 'number') result.backendDOMNodeId = axNode.backendDOMNodeId;

    return result;
}
