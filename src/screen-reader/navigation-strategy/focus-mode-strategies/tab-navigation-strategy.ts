import type {
    INavigationStrategy,
    NavigationStep,
    NavigationStrategyConfig,
    StrategyMetadata,
    StrategyResult,
} from '../browse-mode-strategies/navigation-strategy';
import type { CDPSession, Page } from 'playwright';
import { delay, type IScreenReader } from '../../screen-reader';
import { AxTreeCursor } from '../../ax-tree-cursor';

/**
 * Get the backendNodeId of the currently focused element via CDP.
 * Handles shadow DOM by using the Runtime domain to evaluate in the correct context.
 */
async function getFocusedElementBackendNodeId(cdpSession: CDPSession): Promise<number | null> {
    try {
        // Use Runtime.evaluate to get the deepest active element (pierces shadow DOM)
        const { result, exceptionDetails } = await cdpSession.send('Runtime.evaluate', {
            expression: `
                (function() {
                    let el = document.activeElement;
                    while (el?.shadowRoot?.activeElement) {
                        el = el.shadowRoot.activeElement;
                    }
                    return el;
                })()
            `,
            returnByValue: false,
        });

        if (exceptionDetails || !result.objectId) return null;

        // Get the DOM node for this element
        const { node } = await cdpSession.send('DOM.describeNode', {
            objectId: result.objectId,
        });

        // Release the object reference
        await cdpSession.send('Runtime.releaseObject', { objectId: result.objectId }).catch(() => {});

        return node.backendNodeId ?? null;
    } catch {
        return null;
    }
}

/**
 * Get the outer HTML of the focused element (pierces shadow DOM).
 */
async function getFocusedElementHtml(page: Page): Promise<string | null> {
    return page.evaluate(`
        (function() {
            let el = document.activeElement;
            while (el?.shadowRoot?.activeElement) {
                el = el.shadowRoot.activeElement;
            }
            return el?.outerHTML ?? null;
        })()
    `) as Promise<string | null>;
}

export class TabNavigationStrategy implements INavigationStrategy {
    public readonly meta: StrategyMetadata = {
        type: 'tab',
        name: 'tab',
        description: 'Navigates through focusable elements using Tab key (focus mode navigation)',
    };
    public constructor(public readonly config: NavigationStrategyConfig) {}

    public async execute(
        sr: IScreenReader,
        page: Page,
        // @ts-ignore
        accessibilityTree: Protocol.Accessibility.getFullAXTreeReturnValue,
        cdpSession: CDPSession
    ): Promise<StrategyResult> {
        await sr.navigateToDocumentStart();
        await sr.toggleBetweenBrowseAndFocusMode();
        await sr.navigateToDocumentStart();
        await delay(2000);
        await sr.clearSpokenPhraseLog();

        const cursor = new AxTreeCursor(accessibilityTree.nodes);
        const navigationSteps: NavigationStep[] = [];

        // Track seen elements to detect when we've completed a full cycle
        const seenBackendNodeIds = new Set<number>();

        // Track for focus trap detection (Tab doesn't move focus)
        let lastBackendNodeId: number | null = null;
        let consecutiveSameCount = 0;

        for (let steps = 0; steps < this.config.maxSteps; steps++) {
            await sr.clearSpokenPhraseLog();
            await sr.pressTab();

            const spokenPhrases = await sr.spokenPhraseLog();
            const itemText = await sr.itemText();
            const backendNodeId = await getFocusedElementBackendNodeId(cdpSession);

            // Detect focus left the page (went to browser chrome) - cycle is complete
            if (backendNodeId == null && lastBackendNodeId != null) {
                return {
                    completionReason: 'focus-cycle-complete',
                    meta: this.meta,
                    navigationSteps,
                };
            }

            // Detect focus trap: Tab pressed but focus didn't move
            if (backendNodeId != null && backendNodeId === lastBackendNodeId) {
                consecutiveSameCount++;
                if (consecutiveSameCount >= 2) {
                    return {
                        completionReason: 'focus-trapped',
                        meta: this.meta,
                        navigationSteps,
                    };
                }
            } else {
                consecutiveSameCount = 0;
            }
            lastBackendNodeId = backendNodeId;

            // Detect cycle: we've returned to a previously visited element
            if (backendNodeId != null && seenBackendNodeIds.has(backendNodeId)) {
                return {
                    completionReason: 'focus-cycle-complete',
                    meta: this.meta,
                    navigationSteps,
                };
            }

            // Add to seen set
            if (backendNodeId != null) {
                seenBackendNodeIds.add(backendNodeId);
            }

            // Find the corresponding AX node by backendDOMNodeId
            const axNode = backendNodeId != null ? cursor.findByBackendDOMNodeId(backendNodeId) : null;

            // Get HTML snippet directly from the focused element
            const htmlSnippet = await getFocusedElementHtml(page);

            navigationSteps.push({
                index: navigationSteps.length,
                axNode,
                htmlSnippet,
                identifier: crypto.randomUUID(),
                spokenPhrases,
                timestamp: Date.now(),
                itemText,
                itemTextLog: await sr.itemTextLog(),
            });
        }

        return {
            completionReason: 'completed',
            meta: this.meta,
            navigationSteps,
        };
    }
}
