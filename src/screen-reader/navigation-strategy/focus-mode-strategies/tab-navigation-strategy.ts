import type {
    NavigationStrategy,
    NavigationContext,
    NavigationStep,
    NavigationStrategyConfig,
    StrategyMetadata,
    StrategyResult,
} from '../browse-mode-strategies/navigation-strategy';
import { AxTreeCursor } from '../../accessibility-tree/ax-tree-cursor';
import { NavigationStrategyResult } from '../browse-mode-strategies/navigation-strategy-result';
import type { EndDetectionStrategy, EndDetector } from '../../navigators/types';
import { createEndDetector } from '../../navigators/end-detector';
import { delay } from '../../../utils/delay';

const DEFAULT_END_DETECTION: EndDetectionStrategy = { type: 'document-boundary' };

export class TabNavigationStrategy implements NavigationStrategy {
    public readonly meta: StrategyMetadata = {
        name: 'tab',
        description: 'Navigates through focusable elements using Tab key (focus mode navigation)',
        mode: 'focus',
    };

    private readonly endDetector: EndDetector;

    public constructor(
        public readonly config: NavigationStrategyConfig,
        endDetection: EndDetectionStrategy = DEFAULT_END_DETECTION
    ) {
        this.endDetector = createEndDetector(endDetection);
    }

    public async execute(ctx: NavigationContext): Promise<StrategyResult> {
        await ctx.navigator.navigateToDocumentStart();
        await delay(2000);

        const cursor = new AxTreeCursor(ctx.accessibility.tree.nodes);
        const navigationSteps: NavigationStep[] = [];

        let lastBackendNodeId: number | null = null;
        let consecutiveSameCount = 0;

        this.endDetector.reset();

        for await (const { phrase, focusedElementText } of ctx.navigator.focusableElements()) {
            const backendNodeId = await ctx.accessibility.getFocusedHtmlElementBackendNodeId();
            const documentHasFocus = await ctx.accessibility.getDocumentHasFocus();

            // Check if focus has left the document (e.g., moved to browser UI)
            if (this.endDetector.check({ phrase, focusedElementText, backendNodeId, documentHasFocus })) {
                return NavigationStrategyResult.cycleComplete(
                    'tab focus exited document to browser chrome - cycle complete',
                    this.meta,
                    navigationSteps
                );
            }

            if (backendNodeId == null && lastBackendNodeId != null) {
                return NavigationStrategyResult.cycleComplete(
                    'tab focus returned to start of page',
                    this.meta,
                    navigationSteps
                );
            }

            if (backendNodeId != null && backendNodeId === lastBackendNodeId) {
                consecutiveSameCount++;
                if (consecutiveSameCount >= 2) {
                    return NavigationStrategyResult.trapped(
                        'keyboard focus could not escape element - potential focus trap',
                        this.meta,
                        navigationSteps
                    );
                }
            } else {
                consecutiveSameCount = 0;
            }
            lastBackendNodeId = backendNodeId;

            const axNode =
                backendNodeId != null ? (cursor.findByBackendDOMNodeId(backendNodeId) ?? undefined) : undefined;
            const htmlSnippet = await ctx.accessibility.getFocusedNodeHtml();

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
                    `stopped after ${this.config.maxSteps} focusable elements (safety limit)`,
                    this.meta,
                    navigationSteps
                );
            }
        }

        return NavigationStrategyResult.cycleComplete(
            'tab focus cycled through all focusable elements',
            this.meta,
            navigationSteps
        );
    }
}
