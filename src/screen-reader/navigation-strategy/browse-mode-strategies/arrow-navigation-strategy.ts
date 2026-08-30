import type {
    INavigationStrategy,
    NavigationContext,
    NavigationStrategyConfig,
    NavigationStep,
    StrategyMetadata,
    StrategyResult,
} from './navigation-strategy';
import { AxTreeCursor } from '../../accessibility-tree/ax-tree-cursor';

/**
 * Arrow Navigation Strategy - Linear reading through the page.
 *
 * Simulates a blind user pressing Down Arrow repeatedly in NVDA browse mode
 * to read through the page content in DOM order. This is how:
 * - Beginners often explore pages (WebAIM Survey: 6.4% primary method)
 * - Users verify reading order and content flow
 * - Users discover content that Tab navigation skips
 *
 * Research references:
 * - WebAIM Screen Reader Survey #10: "Read through the page" = 6.4%
 * - A11YNAVIGATOR (UCI): Identifies Arrow as one of three common strategies
 * - NVDA docs: Down Arrow moves to next line/element in virtual buffer
 */
export class ArrowNavigationStrategy implements INavigationStrategy {
    public readonly meta: StrategyMetadata = {
        name: 'ArrowNavigation',
        description: 'Linear reading through page content using Down Arrow (browse mode)',
        type: 'arrow',
    };

    public constructor(public readonly config: NavigationStrategyConfig) {}

    public async execute(ctx: NavigationContext): Promise<StrategyResult> {
        const cursor = new AxTreeCursor(ctx.ax.tree.nodes);
        const navigationSteps: NavigationStep[] = [];

        for await (const { phrase, itemText } of ctx.sr.arrowElements()) {
            let matchResult = cursor.matchNextAny(itemText);
            if (!matchResult && phrase) {
                matchResult = cursor.matchNextAny(phrase);
            }

            const axNode = matchResult?.node;
            const htmlSnippet =
                axNode?.backendDOMNodeId != null ? await ctx.ax.getNodeOuterHtml(axNode.backendDOMNodeId) : null;

            navigationSteps.push({
                index: navigationSteps.length,
                identifier: crypto.randomUUID(),
                spokenPhrases: [phrase],
                itemText,
                itemTextLog: [itemText],
                timestamp: Date.now(),
                axNode,
                htmlSnippet,
            });

            if (navigationSteps.length >= this.config.maxSteps) {
                return {
                    completionReason: 'completed',
                    meta: this.meta,
                    navigationSteps,
                };
            }
        }

        return {
            completionReason: 'end-of-document',
            meta: this.meta,
            navigationSteps,
        };
    }
}
