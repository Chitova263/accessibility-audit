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

export class ButtonNavigationStrategy implements INavigationStrategy {
    public readonly meta: StrategyMetadata = {
        type: 'button',
        name: 'button',
        description: "Navigates through buttons as a blind user would, using NVDA's button navigation (B key)",
        mode: 'browse',
    };
    public constructor(public readonly config: NavigationStrategyConfig) {}

    public async execute(ctx: NavigationContext): Promise<StrategyResult> {
        const cursor = new AxTreeCursor(ctx.ax.tree.nodes);
        const navigationSteps: NavigationStep[] = [];

        for await (const { phrase, itemText } of ctx.navigator.buttons()) {
            let matchResult = cursor.matchNext(itemText, 'button');
            if (!matchResult) {
                matchResult = cursor.matchNext(phrase, 'button');
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
                    `stopped after ${this.config.maxSteps} buttons (safety limit)`,
                    this.meta,
                    navigationSteps
                );
            }
        }

        return Result.exhausted('no more buttons found on page', this.meta, navigationSteps);
    }
}
