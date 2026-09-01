import type {
    INavigationStrategy,
    NavigationContext,
    NavigationStep,
    NavigationStrategyConfig,
    StrategyMetadata,
    StrategyResult,
} from './navigation-strategy';
import { AxTreeCursor, extractLandmarkRole } from '../../accessibility-tree/ax-tree-cursor';
import { NavigationStrategyResult } from './navigation-strategy-result';

export class LandmarkNavigationStrategy implements INavigationStrategy {
    public readonly meta: StrategyMetadata = {
        type: 'landmark',
        name: 'landmark',
        description: "Navigates through ARIA landmarks as a blind user would, using NVDA's landmark navigation (D key)",
        mode: 'browse',
    };
    public constructor(public readonly config: NavigationStrategyConfig) {}

    public async execute(ctx: NavigationContext): Promise<StrategyResult> {
        const cursor = new AxTreeCursor(ctx.ax.tree.nodes);
        const navigationSteps: NavigationStep[] = [];

        for await (const { phrase, itemText } of ctx.navigator.landmarks()) {
            const landmarkRole = extractLandmarkRole(phrase) ?? extractLandmarkRole(itemText);
            const matchResult = landmarkRole ? cursor.matchNextByRole(landmarkRole) : null;

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
                return NavigationStrategyResult.limitReached(
                    `stopped after ${this.config.maxSteps} landmarks (safety limit)`,
                    this.meta,
                    navigationSteps
                );
            }
        }

        return NavigationStrategyResult.exhausted('no more landmarks found on page', this.meta, navigationSteps);
    }
}
