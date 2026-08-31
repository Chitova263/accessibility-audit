import type {
    INavigationStrategy,
    NavigationContext,
    NavigationStep,
    NavigationStrategyConfig,
    StrategyMetadata,
    StrategyResult,
} from './navigation-strategy';
import { Result } from './result';
import { AxTreeCursor } from '../../accessibility-tree/ax-tree-cursor';

export class HeadingNavigationStrategy implements INavigationStrategy {
    public readonly meta: StrategyMetadata = {
        type: 'heading',
        name: 'heading',
        description: 'Heading description',
        mode: 'browse',
    };
    public constructor(public readonly config: NavigationStrategyConfig) {}

    public async execute(ctx: NavigationContext): Promise<StrategyResult> {
        const cursor = new AxTreeCursor(ctx.ax.tree.nodes);
        const navigationSteps: NavigationStep[] = [];

        for await (const { phrase, itemText } of ctx.navigator.headings()) {
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
                return Result.limitReached(
                    `stopped after ${this.config.maxSteps} headings (safety limit)`,
                    this.meta,
                    navigationSteps
                );
            }
        }

        return Result.exhausted('no more headings found on page', this.meta, navigationSteps);
    }
}
