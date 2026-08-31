import type { StrategyResult } from '../../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';

export interface LandmarkInfo {
    role: string;
    name: string;
    stepIndex: number;
    htmlSnippet: string | null;
    spokenPhrases: string[];
    itemText: string;
    identifier: string;
    timestamp: number;
    axNode: unknown;
    backendNodeId?: number;
}

/**
 * Collects all landmark nodes from the landmark navigation strategy in the transcript.
 */
export function collectLandmarks(transcript: StrategyResult[]): LandmarkInfo[] {
    const landmarks: LandmarkInfo[] = [];

    for (const result of transcript) {
        const strategyType = result.meta.type ?? result.meta.name;
        if (strategyType !== 'landmark') continue;

        for (let stepIndex = 0; stepIndex < result.navigationSteps.length; stepIndex++) {
            const step = result.navigationSteps[stepIndex]!;
            const node = step.axNode;

            if (!node) continue;

            const role = node.role?.value ?? '';
            const name = node.name?.value ?? '';

            landmarks.push({
                role,
                name,
                stepIndex,
                htmlSnippet: step.htmlSnippet,
                spokenPhrases: step.spokenPhrases,
                itemText: step.itemText,
                identifier: step.identifier,
                timestamp: step.timestamp,
                axNode: node,
                backendNodeId: node.backendDOMNodeId,
            });
        }
    }

    return landmarks;
}
