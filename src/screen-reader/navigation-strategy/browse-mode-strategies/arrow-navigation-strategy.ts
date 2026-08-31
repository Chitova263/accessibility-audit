import type {
    INavigationStrategy,
    NavigationContext,
    NavigationStrategyConfig,
    NavigationStep,
    StrategyMetadata,
    StrategyResult,
} from './navigation-strategy';
import { Result } from './result';
import { AxTreeCursor } from '../../accessibility-tree/ax-tree-cursor';

export class ArrowNavigationStrategy implements INavigationStrategy {
    public readonly meta: StrategyMetadata = {
        name: 'arrow',
        description: 'Linear reading through page content using Down Arrow (browse mode)',
        mode: 'browse',
        type: 'arrow',
    };

    public constructor(public readonly config: NavigationStrategyConfig) {}

    public async execute(ctx: NavigationContext): Promise<StrategyResult> {
        const cursor = new AxTreeCursor(ctx.ax.tree.nodes);
        const navigationSteps: NavigationStep[] = [];

        for await (const { phrase, itemText } of ctx.navigator.linearElements()) {
            let matchResult = cursor.matchNextAny(itemText);
            if (!matchResult && phrase) {
                matchResult = cursor.matchNextAny(phrase);
            }

            const axNode = matchResult?.node;
            const htmlSnippet =
                axNode?.backendDOMNodeId != null ? await ctx.ax.getNodeOuterHtml(axNode.backendDOMNodeId) : null;

            navigationSteps.push({
                index: navigationSteps.length,
                identifier: crypto.randomUUID(),
                spokenPhrases: [phrase],
                itemText,
                itemTextLog: [itemText],
                timestamp: Date.now(),
                axNode,
                htmlSnippet,
            });

            if (navigationSteps.length >= this.config.maxSteps) {
                return Result.limitReached(
                    `stopped after ${this.config.maxSteps} elements (safety limit)`,
                    this.meta,
                    navigationSteps
                );
            }
        }

        return Result.exhausted('reached end of document in linear reading order', this.meta, navigationSteps);
    }
}
