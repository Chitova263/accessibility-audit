import type {
    INavigationStrategy,
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

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Default end detection: document boundary detection */
const DEFAULT_END_DETECTION: EndDetectionStrategy = { type: 'document-boundary' };

export class TabNavigationStrategy implements INavigationStrategy {
    public readonly meta: StrategyMetadata = {
        type: 'tab',
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
        await ctx.navigator.navigateToDocumentStart();
        await delay(2000);
        await ctx.reader.clearSpokenPhraseLog();

        const cursor = new AxTreeCursor(ctx.ax.tree.nodes);
        const navigationSteps: NavigationStep[] = [];

        let lastBackendNodeId: number | null = null;
        let consecutiveSameCount = 0;

        this.endDetector.reset();

        for await (const { phrase, itemText } of ctx.navigator.focusableElements()) {
            const backendNodeId = await ctx.ax.getFocusedHtmlElementBackendNodeId();

            // Check if focus has left the document (e.g., moved to browser UI)
            if (this.endDetector.check({ phrase, itemText, backendNodeId })) {
                return NavigationStrategyResult.exhausted(
                    'tab focus exited document - end of page content',
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
