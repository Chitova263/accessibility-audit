import type {
    INavigationStrategy,
    NavigationStep,
    NavigationStrategyConfig,
    StrategyMetadata,
    StrategyResult,
} from './navigation-strategy';
import type { CDPSession, Page } from 'playwright';
import type { IScreenReader } from '../../screen-reader';
import { AxTreeCursor } from '../../ax-tree-cursor';

async function getOuterHtml(cdpSession: CDPSession, backendDOMNodeId: number): Promise<string> {
    try {
        const { outerHTML } = await cdpSession.send('DOM.getOuterHTML', { backendNodeId: backendDOMNodeId });
        return outerHTML;
    } catch {
        return '';
    }
}

export class ButtonNavigationStrategy implements INavigationStrategy {
    public readonly meta: StrategyMetadata = {
        type: 'button',
        name: 'button',
        description: "Navigates through buttons as a blind user would, using NVDA's button navigation (B key)",
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
            await sr.nextButton();

            const spokenPhrases = await sr.spokenPhraseLog();
            const itemText = await sr.itemText();

            // NVDA announces "no next button" when there are no more buttons to navigate to
            const noMoreButtons = spokenPhrases.some((p) => p.toLowerCase().includes('no next button'));
            if (noMoreButtons) {
                return {
                    completionReason: 'end-of-buttons',
                    meta: this.meta,
                    navigationSteps,
                };
            }

            // Try to match the spoken output to an AX node.
            // Use itemText first as it's usually the accessible name,
            // fall back to spoken phrases if needed.
            let matchResult = cursor.matchNext(itemText, 'button');
            if (!matchResult && spokenPhrases.length > 0) {
                for (const phrase of spokenPhrases) {
                    matchResult = cursor.matchNext(phrase, 'button');
                    if (matchResult) break;
                }
            }

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
