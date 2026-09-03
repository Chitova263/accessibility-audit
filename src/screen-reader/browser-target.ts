/// <reference lib="dom" />
import { chromium, type Browser, type Page, type CDPSession } from 'playwright';
import type { GetFullAXTreeResult } from '../types/cdp';
import { Logger } from '../utils/logger';

export const DEFAULT_CDP_PORT = 9222;

const PREFLIGHT_TIMEOUT_MS = 2000;

const DEFAULT_TIMEOUT_MS = 20000;

/**
 * Where the browser under audit comes from.
 *
 * `connect` attaches to a Chrome the user started with `--remote-debugging-port`,
 * reusing an already-open tab when one matches the URL. That is what makes it
 * possible to audit pages behind a login.
 *
 * `launch` starts a throwaway browser instead - no port, no profile, nothing to set
 * up beforehand. Suitable for CI and one-shot audits of public pages.
 */
export type BrowserSource =
    | { readonly mode: 'connect'; readonly port?: number; readonly timeout?: number }
    | { readonly mode: 'launch'; readonly headless?: boolean; readonly timeout?: number };

export interface BrowserTargetOptions {
    /** URL to open */
    url: string;
    /** How to obtain the browser (default: connect on {@link DEFAULT_CDP_PORT}) */
    source?: BrowserSource;
}

/** Which pieces of the browser this target created and is therefore responsible for. */
interface TargetOwnership {
    /** True when we started the browser process, so closing it should terminate it. */
    readonly browser: boolean;
    /** True when we opened the tab, so closing may tear it down. */
    readonly page: boolean;
}

/**
 * The browser page under audit, together with the CDP session attached to it.
 * Owns the browser connection lifetime and is the single source of DOM and
 * accessibility data for a session. `page` and `cdp` are always derived from the
 * same target
 */
export class BrowserTarget {
    private readonly log = Logger.context('BrowserTarget');
    private closed = false;

    private constructor(
        private readonly browser: Browser,
        readonly page: Page,
        readonly cdp: CDPSession,
        private readonly ownership: TargetOwnership
    ) {}

    static open(options: BrowserTargetOptions): Promise<BrowserTarget> {
        const source = options.source ?? { mode: 'connect' };
        return source.mode === 'launch'
            ? BrowserTarget.launch(options.url, source)
            : BrowserTarget.connect(options.url, source);
    }

    /**
     * Attach to a Chrome already running with remote debugging enabled, reusing an
     * open tab on `url` if there is one.
     */
    static async connect(url: string, options: { port?: number; timeout?: number } = {}): Promise<BrowserTarget> {
        const log = Logger.context('BrowserTarget');
        const port = options.port ?? DEFAULT_CDP_PORT;
        const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;

        // Probe first: connectOverCDP would otherwise hang for the full timeout and
        // fail with an error that says nothing about how to fix it.
        await assertCdpEndpointReachable(port);

        log.debug(`Connecting to Chrome on port ${port}`);
        const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout });

        const target = new URL(url);
        const existing = browser
            .contexts()
            .flatMap((ctx) => ctx.pages())
            .find((p) => p.url() === target.href);

        if (existing) {
            log.debug('Reusing already-open tab');
            return BrowserTarget.attach(browser, existing, { browser: false, page: false });
        }

        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(target.href, { timeout });
        return BrowserTarget.attach(browser, page, { browser: false, page: true });
    }

    /** Start a dedicated browser and open `url` in it. */
    static async launch(url: string, options: { headless?: boolean; timeout?: number } = {}): Promise<BrowserTarget> {
        const log = Logger.context('BrowserTarget');
        // OS-level screen readers can only read a window that is actually on screen,
        // so a launched browser is headed unless the caller opts out.
        const headless = options.headless ?? false;
        const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;

        log.debug(`Launching ${headless ? 'headless' : 'headed'} browser`);
        const browser = await chromium.launch({ headless, timeout });

        try {
            const context = await browser.newContext();
            const page = await context.newPage();
            await page.goto(url, { timeout });
            return await BrowserTarget.attach(browser, page, { browser: true, page: true });
        } catch (error) {
            await browser.close().catch(() => {});
            throw error;
        }
    }

    private static async attach(browser: Browser, page: Page, ownership: TargetOwnership): Promise<BrowserTarget> {
        const cdp = await page.context().newCDPSession(page);
        return new BrowserTarget(browser, page, cdp, ownership);
    }

    /** Raises the browser window. Required before an OS-level screen reader starts. */
    bringToFront(): Promise<void> {
        return this.page.bringToFront();
    }

    content(): Promise<string> {
        return this.page.content();
    }

    title(): Promise<string> {
        return this.page.title();
    }

    url(): string {
        return this.page.url();
    }

    async getFullAXTreeSnapshot(): Promise<GetFullAXTreeResult> {
        await this.cdp.send('Accessibility.enable');
        try {
            const tree = await this.cdp.send('Accessibility.getFullAXTree');
            this.log.debug(`Accessibility tree: ${tree.nodes.length} nodes`);
            return tree;
        } finally {
            await this.cdp.send('Accessibility.disable');
        }
    }

    async getNodeOuterHtml(backendDOMNodeId: number): Promise<string> {
        try {
            const { outerHTML } = await this.cdp.send('DOM.getOuterHTML', { backendNodeId: backendDOMNodeId });
            return outerHTML;
        } catch {
            return '';
        }
    }

    /** Backend node id of the deepest active element, piercing shadow roots. */
    async getFocusedHtmlElementBackendNodeId(): Promise<number | null> {
        try {
            const { result, exceptionDetails } = await this.cdp.send('Runtime.evaluate', {
                expression: ACTIVE_ELEMENT_EXPRESSION,
                returnByValue: false,
            });

            if (exceptionDetails || !result.objectId) return null;

            const { node } = await this.cdp.send('DOM.describeNode', { objectId: result.objectId });
            await this.cdp.send('Runtime.releaseObject', { objectId: result.objectId }).catch(() => {});
            return node.backendNodeId ?? null;
        } catch {
            return null;
        }
    }

    getFocusedNodeHtml(): Promise<string | null> {
        return this.page.evaluate(`(${ACTIVE_ELEMENT_EXPRESSION})?.outerHTML ?? null`);
    }

    getDocumentHasFocus(): Promise<boolean> {
        return this.page.evaluate(() => document.hasFocus());
    }

    async close(): Promise<void> {
        if (this.closed) return;
        this.closed = true;

        await this.cdp.detach().catch(() => {});

        // Only tear down a tab we opened ourselves - never one the user already had open.
        if (this.ownership.page && !this.ownership.browser) {
            await this.page
                .context()
                .close()
                .catch(() => {});
        }

        // Playwright branches on how the browser was obtained: a launched browser is
        // terminated, a connected one is only disconnected from, leaving the user's
        // Chrome running.
        await this.browser.close().catch(() => {});
        this.log.debug(this.ownership.browser ? 'Browser closed' : 'Disconnected from browser');
    }
}

async function assertCdpEndpointReachable(port: number): Promise<void> {
    let response: Response;
    try {
        response = await fetch(`http://127.0.0.1:${port}/json/version`, {
            signal: AbortSignal.timeout(PREFLIGHT_TIMEOUT_MS),
        });
    } catch {
        throw new Error(noBrowserMessage(port));
    }
    if (!response.ok) {
        throw new Error(`endpoint returned HTTP ${response.status}`);
    }
}

function noBrowserMessage(port: number): string {
    return [
        `No Chrome DevTools endpoint on http://127.0.0.1:${port}.`,
        '',
        'Start Chrome with remote debugging enabled:',
        `  ${chromeLaunchCommand(port)}`,
        '',
        'Chrome ignores this flag when an instance is already running on the same',
        'profile, so quit Chrome first or add --user-data-dir=<a scratch directory>.',
        '',
        'Alternatively, pass --launch to have this tool start its own browser.',
    ].join('\n');
}

function chromeLaunchCommand(port: number): string {
    switch (process.platform) {
        case 'win32':
            return `"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=${port}`;
        case 'darwin':
            return `/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=${port}`;
        default:
            return `google-chrome --remote-debugging-port=${port}`;
    }
}

/** Resolves the deepest active element, descending through shadow roots. */
const ACTIVE_ELEMENT_EXPRESSION = `(function () {
    let el = document.activeElement;
    while (el?.shadowRoot?.activeElement) {
        el = el.shadowRoot.activeElement;
    }
    return el;
})()`;
