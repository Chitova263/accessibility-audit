import type {
    INavigationStrategy,
    NavigationContext,
    NavigationStep,
    NavigationStrategyConfig,
    StrategyMetadata,
    StrategyResult,
} from './navigation-strategy';
import { AxTreeCursor } from '../../accessibility-tree/ax-tree-cursor';

export class LinkNavigationStrategy implements INavigationStrategy {
    public readonly meta: StrategyMetadata = {
        type: 'link',
        name: 'link',
        description: "Navigates through links as a blind user would, using NVDA's link navigation (K key)",
    };
    public constructor(public readonly config: NavigationStrategyConfig) {}

    public async execute(ctx: NavigationContext): Promise<StrategyResult> {
        const cursor = new AxTreeCursor(ctx.ax.tree.nodes);
        const navigationSteps: NavigationStep[] = [];

        for await (const { phrase, itemText } of ctx.sr.links()) {
            let matchResult = cursor.matchNext(itemText, 'link');
            if (!matchResult) {
                matchResult = cursor.matchNext(phrase, 'link');
            }

            const axNode = matchResult?.node;
            const htmlSnippet =
                axNode?.backendDOMNodeId != null ? await ctx.ax.getNodeOuterHtml(axNode.backendDOMNodeId) : null;

            navigationSteps.push({
                index: navigationSteps.length,
                axNode,
                htmlSnippet,
                identifier: crypto.randomUUID(),
                spokenPhrases: [phrase],
                timestamp: Date.now(),
                itemText,
                itemTextLog: [itemText],
            });

            if (navigationSteps.length >= this.config.maxSteps) {
                return {
                    completionReason: 'completed',
                    meta: this.meta,
                    navigationSteps,
                };
            }
        }

        return {
            completionReason: 'end-of-links',
            meta: this.meta,
            navigationSteps,
        };
    }
}
