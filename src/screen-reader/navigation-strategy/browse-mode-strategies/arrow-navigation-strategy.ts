import type { CDPSession, Page } from 'playwright';
import type { IScreenReader } from '../../screen-reader';
import type {
    INavigationStrategy,
    NavigationStrategyConfig,
    NavigationStep,
    StrategyMetadata,
    StrategyResult,
} from './navigation-strategy';
import { NvdaAxCursor } from '../../nvda-ax-cursor';

async function getOuterHtml(cdpSession: CDPSession, backendDOMNodeId: number): Promise<string> {
    try {
        const { outerHTML } = await cdpSession.send('DOM.getOuterHTML', { backendNodeId: backendDOMNodeId });
        return outerHTML;
    } catch {
        return '';
    }
}

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

    public async execute(
        sr: IScreenReader,
        page: Page,
        // @ts-ignore
        accessibilityTree: Protocol.Accessibility.getFullAXTreeReturnValue,
        cdpSession: CDPSession
    ): Promise<StrategyResult> {
        const cursor = new NvdaAxCursor(accessibilityTree.nodes);
        const navigationSteps: NavigationStep[] = [];

        // Track content to detect end of document
        let previousSpoken = '';
        let sameContentCount = 0;
        const maxSameContent = 3; // Stop after hearing same thing 3 times

        for (let steps = 0; steps < this.config.maxSteps; steps++) {
            await sr.clearSpokenPhraseLog();

            // Press Down Arrow to move to next element/line in browse mode
            await sr.press('Down');

            const spokenPhrases = await sr.spokenPhraseLog();
            const itemText = await sr.itemText();
            const currentSpoken = spokenPhrases.join(' ');

            // Detect end of document (same content repeated)
            if (currentSpoken === previousSpoken && currentSpoken !== '') {
                sameContentCount++;
                if (sameContentCount >= maxSameContent) {
                    return {
                        completionReason: 'end-of-document',
                        meta: this.meta,
                        navigationSteps,
                    };
                }
            } else {
                sameContentCount = 0;
            }
            previousSpoken = currentSpoken;

            // Skip empty announcements but count them toward limit
            if (!itemText && spokenPhrases.length === 0) {
                continue;
            }

            // Try to match spoken output to an AX node
            // Arrow navigation can land on any element type, so don't filter by role
            let matchResult = cursor.matchNextAny(itemText);
            if (!matchResult && spokenPhrases.length > 0) {
                for (const phrase of spokenPhrases) {
                    matchResult = cursor.matchNextAny(phrase);
                    if (matchResult) break;
                }
            }

            // Fetch HTML for the matched AX node
            const axNode = matchResult?.node;
            const htmlSnippet =
                axNode?.backendDOMNodeId != null ? await getOuterHtml(cdpSession, axNode.backendDOMNodeId) : null;

            navigationSteps.push({
                index: navigationSteps.length,
                identifier: crypto.randomUUID(),
                spokenPhrases,
                itemText,
                itemTextLog: await sr.itemTextLog(),
                timestamp: Date.now(),
                axNode,
                htmlSnippet,
            });
        }

        return {
            completionReason: 'completed',
            meta: this.meta,
            navigationSteps,
        };
    }
}
