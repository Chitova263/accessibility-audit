import type {
    INavigationStrategy,
    NavigationContext,
    NavigationStep,
    NavigationStrategyConfig,
    StrategyMetadata,
    StrategyResult,
} from '../browse-mode-strategies/navigation-strategy';
import { delay } from '../../screen-reader';
import { AxTreeCursor } from '../../accessibility-tree/ax-tree-cursor';

export class TabNavigationStrategy implements INavigationStrategy {
    public readonly meta: StrategyMetadata = {
        type: 'tab',
        name: 'tab',
        description: 'Navigates through focusable elements using Tab key (focus mode navigation)',
        mode: 'focus',
    };
    public constructor(public readonly config: NavigationStrategyConfig) {}

    public async execute(ctx: NavigationContext): Promise<StrategyResult> {
        await ctx.sr.navigateToDocumentStart();
        await ctx.sr.navigateToDocumentStart();
        await delay(2000);
        await ctx.sr.clearSpokenPhraseLog();

        const cursor = new AxTreeCursor(ctx.ax.tree.nodes);
        const navigationSteps: NavigationStep[] = [];

        let lastBackendNodeId: number | null = null;
        let consecutiveSameCount = 0;

        for await (const { phrase, itemText } of ctx.sr.focusableElements()) {
            const backendNodeId = await ctx.ax.getFocusedHtmlElementBackendNodeId();

            if (backendNodeId == null && lastBackendNodeId != null) {
                return {
                    completionReason: {
                        kind: 'cycle-complete',
                        detail: 'tab focus returned to start of page',
                    },
                    meta: this.meta,
                    navigationSteps,
                };
            }

            if (backendNodeId != null && backendNodeId === lastBackendNodeId) {
                consecutiveSameCount++;
                if (consecutiveSameCount >= 2) {
                    return {
                        completionReason: {
                            kind: 'trapped',
                            detail: 'keyboard focus could not escape element - potential focus trap',
                        },
                        meta: this.meta,
                        navigationSteps,
                    };
                }
            } else {
                consecutiveSameCount = 0;
            }
            lastBackendNodeId = backendNodeId;

            const axNode = backendNodeId != null ? cursor.findByBackendDOMNodeId(backendNodeId) : null;
            const htmlSnippet = await ctx.ax.getFocusedNodeHtml();

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
                        detail: `stopped after ${this.config.maxSteps} focusable elements (safety limit)`,
                    },
                    meta: this.meta,
                    navigationSteps,
                };
            }
        }

        return {
            completionReason: {
                kind: 'cycle-complete',
                detail: 'tab focus cycled through all focusable elements',
            },
            meta: this.meta,
            navigationSteps,
        };
    }
}
