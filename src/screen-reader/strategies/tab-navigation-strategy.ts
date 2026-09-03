import type {
    NavigationStrategy,
    NavigationContext,
    NavigationStep,
    NavigationStrategyConfig,
    NavigationStrategyMetadata,
    StrategyResult,
} from './navigation-strategy';
import { AxTreeCursor } from '../accessibility-tree/ax-tree-cursor';
import { NavigationStrategyResult } from './navigation-strategy-result';
import type { NavigationEndDetector } from '../types';
import { DocumentBoundaryGuard } from '../boundary-guards/document-boundary-guard';
import { delay } from '../../utils/delay';

export class TabNavigationStrategy implements NavigationStrategy {
    public readonly meta: NavigationStrategyMetadata = {
        name: 'tab',
        description: 'Navigates through focusable elements using Tab key (focus mode navigation)',
    };

    private readonly endDetector: NavigationEndDetector;

    public constructor(
        public readonly config: NavigationStrategyConfig,
        endDetector: NavigationEndDetector = new DocumentBoundaryGuard()
    ) {
        this.endDetector = endDetector;
    }

    public async execute(ctx: NavigationContext): Promise<StrategyResult> {
        await ctx.virtualCursor.reset();
        await delay(2000);

        const cursor = new AxTreeCursor(ctx.accessibility.tree.nodes);
        const navigationSteps: NavigationStep[] = [];

        let lastBackendNodeId: number | null = null;
        let consecutiveSameCount = 0;

        this.endDetector.reset();

        for await (const { phrase, focusedElementText } of ctx.virtualCursor.focusableElements()) {
            const backendNodeId = await ctx.accessibility.getFocusedHtmlElementBackendNodeId();
            const documentHasFocus = await ctx.accessibility.getDocumentHasFocus();

            // Check if focus has left the document (e.g., moved to browser UI)
            if (!this.endDetector.hasNext({ phrase, focusedElementText, backendNodeId, documentHasFocus })) {
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
                // Find the sweet spot for consecutive count, some repetitions are due to bad HTML
                if (consecutiveSameCount >= 10) {
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
