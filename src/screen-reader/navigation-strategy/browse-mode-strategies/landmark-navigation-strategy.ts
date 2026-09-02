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
import { getScreenReaderDisplayName } from '../../drivers/types';
import { getKeyBindings } from '../../navigators/config';

export class LandmarkNavigationStrategy implements INavigationStrategy {
    public readonly meta: StrategyMetadata;

    public constructor(public readonly config: NavigationStrategyConfig) {
        const screenReaderName = getScreenReaderDisplayName(config.screenReader);
        const keyBindings = getKeyBindings(config.screenReader);
        this.meta = {
            name: 'landmark',
            description: `Navigates through ARIA landmarks as a blind user would, using ${screenReaderName}'s landmark navigation (${keyBindings.nextLandmark})`,
            mode: 'browse',
        };
    }

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
