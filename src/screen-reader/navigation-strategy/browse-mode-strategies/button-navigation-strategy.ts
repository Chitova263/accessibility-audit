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

export class ButtonNavigationStrategy implements NavigationStrategy {
    public readonly meta: StrategyMetadata;

    public constructor(public readonly config: NavigationStrategyConfig) {
        const screenReaderName = getScreenReaderDisplayName(config.screenReader);
        const keyBindings = getKeyBindings(config.screenReader);
        this.meta = {
            name: 'button',
            description: `Navigates through buttons as a blind user would, using ${screenReaderName}'s button navigation (${keyBindings.nextButton})`,
            mode: 'browse',
        };
    }

    public async execute(ctx: NavigationContext): Promise<StrategyResult> {
        const cursor = new AxTreeCursor(ctx.accessibility.tree.nodes);
        const navigationSteps: NavigationStep[] = [];

        for await (const { phrase, focusedElementText } of ctx.navigator.buttons()) {
            let matchResult = cursor.matchNext(focusedElementText, 'button');
            if (!matchResult) {
                matchResult = cursor.matchNext(phrase, 'button');
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
                    `stopped after ${this.config.maxSteps} buttons (safety limit)`,
                    this.meta,
                    navigationSteps
                );
            }
        }

        return NavigationStrategyResult.exhausted('no more buttons found on page', this.meta, navigationSteps);
    }
}
