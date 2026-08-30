import type {
    INavigationStrategy,
    NavigationContext,
    NavigationStep,
    NavigationStrategyConfig,
    StrategyMetadata,
    StrategyResult,
} from './navigation-strategy';
import type { NavigationItem } from '../../screen-reader';
import { AxTreeCursor } from '../../accessibility-tree/ax-tree-cursor';

export interface HeadingHierarchyConfig extends NavigationStrategyConfig {
    /** The heading level to navigate (1-6) */
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
            description: `Navigates through h${this.level} headings as a blind user would, using NVDA's heading level navigation (${this.level} key)`,
            mode: 'browse',
        };
    }

    public async execute(ctx: NavigationContext): Promise<StrategyResult> {
        const cursor = new AxTreeCursor(ctx.ax.tree.nodes);
        const navigationSteps: NavigationStep[] = [];

        const iteratorMap: Record<1 | 2 | 3 | 4 | 5 | 6, () => AsyncIterableIterator<NavigationItem>> = {
            1: () => ctx.sr.headingsLevel1(),
            2: () => ctx.sr.headingsLevel2(),
            3: () => ctx.sr.headingsLevel3(),
            4: () => ctx.sr.headingsLevel4(),
            5: () => ctx.sr.headingsLevel5(),
            6: () => ctx.sr.headingsLevel6(),
        };

        for await (const { phrase, itemText } of iteratorMap[this.level]()) {
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
                return {
                    completionReason: {
                        kind: 'limit-reached',
                        detail: `stopped after ${this.config.maxSteps} h${this.level} headings (safety limit)`,
                    },
                    meta: this.meta,
                    navigationSteps,
                };
            }
        }

        return {
            completionReason: {
                kind: 'exhausted',
                detail: `no more level ${this.level} headings (h${this.level}) found on page`,
            },
            meta: this.meta,
            navigationSteps,
        };
    }
}
