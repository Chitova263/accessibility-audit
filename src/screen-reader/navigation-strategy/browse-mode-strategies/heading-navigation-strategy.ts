import type {
    INavigationStrategy,
    NavigationContext,
    NavigationStep,
    NavigationStrategyConfig,
    StrategyMetadata,
    StrategyResult,
} from './navigation-strategy';
import { AxTreeCursor } from '../../accessibility-tree/ax-tree-cursor';

export class HeadingNavigationStrategy implements INavigationStrategy {
    public readonly meta: StrategyMetadata = {
        type: 'heading',
        name: 'heading',
        description: 'Heading description',
    };
    public constructor(public readonly config: NavigationStrategyConfig) {}

    public async execute(ctx: NavigationContext): Promise<StrategyResult> {
        const cursor = new AxTreeCursor(ctx.ax.tree.nodes);
        const navigationSteps: NavigationStep[] = [];

        for await (const { phrase, itemText } of ctx.sr.headings()) {
            let matchResult = cursor.matchNext(itemText, 'heading');
            if (!matchResult) {
                matchResult = cursor.matchNext(phrase, 'heading');
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
            completionReason: 'end-of-headings',
            meta: this.meta,
            navigationSteps,
        };
    }
}
