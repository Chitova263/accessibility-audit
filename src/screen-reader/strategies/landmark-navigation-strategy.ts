import type {
    NavigationStrategy,
    NavigationContext,
    NavigationStep,
    NavigationStrategyConfig,
    NavigationStrategyMetadata,
    StrategyResult,
} from './navigation-strategy';
import { AxTreeCursor, extractLandmarkRole } from '../accessibility-tree/ax-tree-cursor';
import { NavigationStrategyResult } from './navigation-strategy-result';

export class LandmarkNavigationStrategy implements NavigationStrategy {
    public readonly meta: NavigationStrategyMetadata = {
        name: 'landmark',
        description: 'Navigates through ARIA landmarks using browse mode landmark navigation',
    };

    public constructor(public readonly config: NavigationStrategyConfig) {}

    public async execute(ctx: NavigationContext): Promise<StrategyResult> {
        const cursor = new AxTreeCursor(ctx.accessibility.tree.nodes);
        const navigationSteps: NavigationStep[] = [];

        for await (const { phrase, focusedElementText } of ctx.virtualCursor.landmarks()) {
            const landmarkRole = extractLandmarkRole(phrase) ?? extractLandmarkRole(focusedElementText);
            const matchResult = landmarkRole ? cursor.matchNextByRole(landmarkRole) : null;

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
                    `stopped after ${this.config.maxSteps} landmarks (safety limit)`,
                    this.meta,
                    navigationSteps
                );
            }
        }

        return NavigationStrategyResult.exhausted('no more landmarks found on page', this.meta, navigationSteps);
    }
}
