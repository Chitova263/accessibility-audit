import type { CDPSession, Page } from 'playwright';

export class AxTreeUtil {
    public static async getNodeOuterHtml(cdpSession: CDPSession, backendDOMNodeId: number): Promise<string> {
        try {
            const { outerHTML } = await cdpSession.send('DOM.getOuterHTML', { backendNodeId: backendDOMNodeId });
            return outerHTML;
        } catch {
            return '';
        }
    }

    public static async getFocusedHtmlElementBackendNodeId(cdpSession: CDPSession): Promise<number | null> {
        try {
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

            const { node } = await cdpSession.send('DOM.describeNode', { objectId: result.objectId });
            await cdpSession.send('Runtime.releaseObject', { objectId: result.objectId }).catch(() => {});
            return node.backendNodeId ?? null;
        } catch {
            return null;
        }
    }

    public static async getFocusedNodeHtml(page: Page): Promise<string | null> {
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
}
