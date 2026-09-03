import type {
    NavigationStrategy,
    NavigationContext,
    NavigationStrategyConfig,
    NavigationStep,
    NavigationStrategyMetadata,
    StrategyResult,
} from './navigation-strategy';
import { AxTreeCursor } from '../accessibility-tree/ax-tree-cursor';
import { NavigationStrategyResult } from './navigation-strategy-result';

export class DownArrowNavigationStrategy implements NavigationStrategy {
    public readonly meta: NavigationStrategyMetadata = {
        name: 'arrow',
        description: 'Linear reading through page content using Down Arrow (browse mode)',
    };

    public constructor(public readonly config: NavigationStrategyConfig) {}

    public async execute(ctx: NavigationContext): Promise<StrategyResult> {
        const cursor = new AxTreeCursor(ctx.accessibility.tree.nodes);
        const navigationSteps: NavigationStep[] = [];

        for await (const { phrase, focusedElementText } of ctx.virtualCursor.linearElements()) {
            let matchResult = cursor.matchNextAny(focusedElementText);
            if (!matchResult && phrase) {
                matchResult = cursor.matchNextAny(phrase);
            }

            const axNode = matchResult?.node;
            const htmlSnippet =
                axNode?.backendDOMNodeId != null
                    ? await ctx.accessibility.getNodeOuterHtml(axNode.backendDOMNodeId)
                    : null;

            navigationSteps.push({
                index: navigationSteps.length,
                identifier: crypto.randomUUID(),
                spokenPhrases: [phrase],
                focusedElementText,
                focusedElementTextLog: [focusedElementText],
                timestamp: Date.now(),
                axNode,
                htmlSnippet,
            });

            if (navigationSteps.length >= this.config.maxSteps) {
                return NavigationStrategyResult.limitReached(
                    `stopped after ${this.config.maxSteps} elements (safety limit)`,
                    this.meta,
                    navigationSteps
                );
            }
        }

        return NavigationStrategyResult.exhausted(
            'reached end of document in linear reading order',
            this.meta,
            navigationSteps
        );
    }
}
