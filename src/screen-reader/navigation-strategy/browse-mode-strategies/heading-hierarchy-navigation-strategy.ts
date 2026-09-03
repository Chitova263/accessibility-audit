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
import { getScreenReaderDisplayName } from '../../drivers/types';
import { getKeyBindings } from '../../navigators/config';

export interface HeadingHierarchyConfig extends NavigationStrategyConfig {
    level: 1 | 2 | 3 | 4 | 5 | 6;
}

export class HeadingHierarchyNavigationStrategy implements NavigationStrategy {
    public readonly meta: StrategyMetadata;
    private readonly level: 1 | 2 | 3 | 4 | 5 | 6;

    public constructor(public readonly config: HeadingHierarchyConfig) {
        this.level = config.level;
        const screenReaderName = getScreenReaderDisplayName(config.screenReader);
        const keyBindings = getKeyBindings(config.screenReader);
        const keyForLevel = keyBindings.nextHeadingLevel(this.level);
        this.meta = {
            name: `heading-level-${this.level}`,
            description: `Navigates through h${this.level} headings using ${screenReaderName}'s heading level navigation (${keyForLevel})`,
            mode: 'browse',
        };
    }

    public async execute(ctx: NavigationContext): Promise<StrategyResult> {
        const cursor = new AxTreeCursor(ctx.accessibility.tree.nodes);
        const navigationSteps: NavigationStep[] = [];

        for await (const { phrase, focusedElementText } of ctx.navigator.headingsLevel(this.level)) {
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
                    `stopped after ${this.config.maxSteps} h${this.level} headings (safety limit)`,
                    this.meta,
                    navigationSteps
                );
            }
        }

        return NavigationStrategyResult.exhausted(
            `no more level ${this.level} headings (h${this.level}) found on page`,
            this.meta,
            navigationSteps
        );
    }
}
