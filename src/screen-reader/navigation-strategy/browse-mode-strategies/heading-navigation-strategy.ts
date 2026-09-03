import type {
    NavigationStrategy,
    NavigationContext,
    NavigationStep,
    NavigationStrategyConfig,
    StrategyMetadata,
    StrategyResult,
} from './navigation-strategy';
import { AxTreeCursor } from '../../accessibility-tree/ax-tree-cursor';
import { NavigationStrategyResult } from './navigation-strategy-result';

export class HeadingNavigationStrategy implements NavigationStrategy {
    public readonly meta: StrategyMetadata = {
        name: 'heading',
        description: 'Heading description',
        mode: 'browse',
    };
    public constructor(public readonly config: NavigationStrategyConfig) {}

    public async execute(ctx: NavigationContext): Promise<StrategyResult> {
        const cursor = new AxTreeCursor(ctx.accessibility.tree.nodes);
        const navigationSteps: NavigationStep[] = [];

        for await (const { phrase, focusedElementText } of ctx.navigator.headings()) {
            let matchResult = cursor.matchNext(focusedElementText, 'heading');
            if (!matchResult) {
                matchResult = cursor.matchNext(phrase, 'heading');
            }

            const axNode = matchResult?.node;
            const htmlSnippet =
                axNode?.backendDOMNodeId != null
                    ? await ctx.accessibility.getNodeOuterHtml(axNode.backendDOMNodeId)
                    : null;

            navigationSteps.push({
                index: navigationSteps.length,
                axNode,
                htmlSnippet,
                identifier: crypto.randomUUID(),
                spokenPhrases: [phrase],
                timestamp: Date.now(),
                focusedElementText,
                focusedElementTextLog: [focusedElementText],
            });

            if (navigationSteps.length >= this.config.maxSteps) {
                return NavigationStrategyResult.limitReached(
                    `stopped after ${this.config.maxSteps} headings (safety limit)`,
                    this.meta,
                    navigationSteps
                );
            }
        }

        return NavigationStrategyResult.exhausted('no more headings found on page', this.meta, navigationSteps);
    }
}
