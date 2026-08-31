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

export interface HeadingHierarchyConfig extends NavigationStrategyConfig {
    level: 1 | 2 | 3 | 4 | 5 | 6;
}

export class HeadingHierarchyNavigationStrategy implements INavigationStrategy {
    public readonly meta: StrategyMetadata;
    private readonly level: 1 | 2 | 3 | 4 | 5 | 6;

    public constructor(public readonly config: HeadingHierarchyConfig) {
        this.level = config.level;
        const typeMap = {
            1: 'heading1',
            2: 'heading2',
            3: 'heading3',
            4: 'heading4',
            5: 'heading5',
            6: 'heading6',
        } as const;
        this.meta = {
            type: typeMap[this.level],
            name: `heading-level-${this.level}`,
            description: `Navigates through h${this.level} headings using NVDA's heading level navigation (${this.level} key)`,
            mode: 'browse',
        };
    }

    public async execute(ctx: NavigationContext): Promise<StrategyResult> {
        const cursor = new AxTreeCursor(ctx.ax.tree.nodes);
        const navigationSteps: NavigationStep[] = [];

        for await (const { phrase, itemText } of ctx.navigator.headingsLevel(this.level)) {
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
                    `stopped after ${this.config.maxSteps} h${this.level} headings (safety limit)`,
                    this.meta,
                    navigationSteps
                );
            }
        }

        return Result.exhausted(
            `no more level ${this.level} headings (h${this.level}) found on page`,
            this.meta,
            navigationSteps
        );
    }
}
