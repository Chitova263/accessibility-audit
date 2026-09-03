import type { StrategyResult } from '../../../screen-reader/strategies/navigation-strategy';
import type { AXNode } from '../../../types/cdp';
import { getRole, getName } from '../../../types/ax-utils';

export interface LandmarkInfo {
    role: string;
    name: string;
    stepIndex: number;
    htmlSnippet: string | null;
    spokenPhrases: string[];
    focusedElementText: string;
    identifier: string;
    timestamp: number;
    axNode: AXNode | undefined;
    backendNodeId?: number | undefined;
}

/**
 * Collects all landmark nodes from the landmark navigation strategy in the transcript.
 */
export function collectLandmarks(transcript: StrategyResult[]): LandmarkInfo[] {
    const landmarks: LandmarkInfo[] = [];

    for (const result of transcript) {
        const strategyType = result.meta.name;
        if (strategyType !== 'landmark') continue;

        for (let stepIndex = 0; stepIndex < result.navigationSteps.length; stepIndex++) {
            const step = result.navigationSteps[stepIndex]!;
            const node = step.axNode;

            if (!node) continue;

            const role = getRole(node) ?? '';
            const name = getName(node) ?? '';

            landmarks.push({
                role,
                name,
                stepIndex,
                htmlSnippet: step.htmlSnippet,
                spokenPhrases: step.spokenPhrases,
                focusedElementText: step.focusedElementText,
                identifier: step.identifier,
                timestamp: step.timestamp,
                axNode: node,
                backendNodeId: node.backendDOMNodeId,
            });
        }
    }

    return landmarks;
}
