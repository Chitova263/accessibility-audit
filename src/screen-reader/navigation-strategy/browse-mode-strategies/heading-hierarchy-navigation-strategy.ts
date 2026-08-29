import type {
    INavigationStrategy,
    NavigationStep,
    NavigationStrategyConfig,
    StrategyMetadata,
    StrategyResult,
} from './navigation-strategy';
import type { CDPSession, Page } from 'playwright';
import type { IScreenReader } from '../../screen-reader';
import { NvdaAxCursor } from '../../nvda-ax-cursor';

async function getOuterHtml(cdpSession: CDPSession, backendDOMNodeId: number): Promise<string> {
    try {
        const { outerHTML } = await cdpSession.send('DOM.getOuterHTML', { backendNodeId: backendDOMNodeId });
        return outerHTML;
    } catch {
        return '';
    }
}

export interface HeadingHierarchyConfig extends NavigationStrategyConfig {
    /** The heading level to navigate (1-6) */
    level: 1 | 2 | 3 | 4 | 5 | 6;
}

export class HeadingHierarchyNavigationStrategy implements INavigationStrategy {
    public readonly meta: StrategyMetadata;
    private readonly level: 1 | 2 | 3 | 4 | 5 | 6;

    public constructor(public readonly config: HeadingHierarchyConfig) {
        this.level = config.level;
        const typeMap = {
            1: 'heading1',
            2: 'heading2',
            3: 'heading3',
            4: 'heading4',
            5: 'heading5',
            6: 'heading6',
        } as const;
        this.meta = {
            type: typeMap[this.level],
            name: `heading-level-${this.level}`,
            description: `Navigates through h${this.level} headings as a blind user would, using NVDA's heading level navigation (${this.level} key)`,
        };
    }

    public async execute(
        sr: IScreenReader,
        page: Page,
        // @ts-ignore
        accessibilityTree: Protocol.Accessibility.getFullAXTreeReturnValue,
        cdpSession: CDPSession
    ): Promise<StrategyResult> {
        const cursor = new NvdaAxCursor(accessibilityTree.nodes);
        const navigationSteps: NavigationStep[] = [];

        // Map level to the corresponding screen reader method
        const nextHeadingMethod = {
            1: () => sr.nextHeadingLevel1(),
            2: () => sr.nextHeadingLevel2(),
            3: () => sr.nextHeadingLevel3(),
            4: () => sr.nextHeadingLevel4(),
            5: () => sr.nextHeadingLevel5(),
            6: () => sr.nextHeadingLevel6(),
        }[this.level];

        // NVDA error message pattern: "no next heading at level X"
        const noMorePattern = `no next heading at level ${this.level}`;

        for (let steps = 0; steps < this.config.maxSteps; steps++) {
            await sr.clearSpokenPhraseLog();
            await nextHeadingMethod();

            const spokenPhrases = await sr.spokenPhraseLog();
            const itemText = await sr.itemText();

            // NVDA announces "No next heading at level X" when there are no more headings at that level
            const noMoreHeadings = spokenPhrases.some((p) => p.toLowerCase().includes(noMorePattern));
            if (noMoreHeadings) {
                return {
                    completionReason: 'end-of-heading-level',
                    meta: this.meta,
                    navigationSteps,
                };
            }

            // Try to match the spoken output to an AX node.
            // Use itemText first as it's usually the accessible name,
            // fall back to spoken phrases if needed.
            let matchResult = cursor.matchNext(itemText, 'heading');
            if (!matchResult && spokenPhrases.length > 0) {
                for (const phrase of spokenPhrases) {
                    matchResult = cursor.matchNext(phrase, 'heading');
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
