import type {
    INavigationStrategy,
    NavigationStep,
    NavigationStrategyConfig,
    StrategyMetadata,
    StrategyResult,
} from './navigation-strategy';
import type { CDPSession, Page } from 'playwright';
import type { IScreenReader } from '../../screen-reader';
import { AxTreeCursor, extractLandmarkRole } from '../../ax-tree-cursor';

async function getOuterHtml(cdpSession: CDPSession, backendDOMNodeId: number): Promise<string> {
    try {
        const { outerHTML } = await cdpSession.send('DOM.getOuterHTML', { backendNodeId: backendDOMNodeId });
        return outerHTML;
    } catch {
        return '';
    }
}

export class LandmarkNavigationStrategy implements INavigationStrategy {
    public readonly meta: StrategyMetadata = {
        type: 'landmark',
        name: 'landmark',
        description: "Navigates through ARIA landmarks as a blind user would, using NVDA's landmark navigation (D key)",
    };
    public constructor(public readonly config: NavigationStrategyConfig) {}

    public async execute(
        sr: IScreenReader,
        page: Page,
        // @ts-ignore
        accessibilityTree: Protocol.Accessibility.getFullAXTreeReturnValue,
        cdpSession: CDPSession
    ): Promise<StrategyResult> {
        const cursor = new AxTreeCursor(accessibilityTree.nodes);
        const navigationSteps: NavigationStep[] = [];

        for (let steps = 0; steps < this.config.maxSteps; steps++) {
            await sr.clearSpokenPhraseLog();
            await sr.nextLandmark();

            const spokenPhrases = await sr.spokenPhraseLog();
            const itemText = await sr.itemText();

            // NVDA announces "No next landmark" when there are no more landmarks to navigate to
            const noMoreLandmarks = spokenPhrases.some((p) => p.toLowerCase().includes('no next landmark'));
            if (noMoreLandmarks) {
                return {
                    completionReason: 'end-of-landmarks',
                    meta: this.meta,
                    navigationSteps,
                };
            }

            // Try to match the spoken output to an AX node.
            // Extract the landmark role from what NVDA announced (e.g., "navigation landmark" → "navigation")
            // Then find the next AX node with that exact role (no name match required).
            let landmarkRole: string | null = null;
            for (const phrase of [itemText, ...spokenPhrases]) {
                landmarkRole = extractLandmarkRole(phrase);
                if (landmarkRole) break;
            }

            const matchResult = landmarkRole ? cursor.matchNextByRole(landmarkRole) : null;

            // Fetch the outer HTML for the matched AX node via its backendDOMNodeId
            const axNode = matchResult?.node;
            const htmlSnippet =
                axNode?.backendDOMNodeId != null ? await getOuterHtml(cdpSession, axNode.backendDOMNodeId) : null;

            navigationSteps.push({
                index: navigationSteps.length,
                axNode,
                htmlSnippet,
                identifier: crypto.randomUUID(),
                spokenPhrases,
                timestamp: Date.now(),
                itemText,
                itemTextLog: await sr.itemTextLog(),
            });
        }

        return {
            completionReason: 'completed',
            meta: this.meta,
            navigationSteps,
        };
    }
}
