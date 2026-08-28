import type { BrowserContext, Page, CDPSession } from 'playwright';
import { delay, type ScreenReader } from './screen-reader';
import type {
    INavigationStrategy,
    StrategyResult,
} from './navigation-strategy/browse-mode-strategies/navigation-strategy';
import type { ChromeDevToolsProtocolConnection } from '../chrome-dev-tools-protocol-connection';
import { nvda } from '@guidepup/guidepup';

export interface PageSessionResult {
    page: Page;
    html: string;
    results: StrategyResult[];
    url: string;
    // @ts-ignore
    axTree: Protocol.Accessibility.getFullAXTreeReturnValue;
}

export class PageSession {
    private page: Page | undefined = undefined;
    private cdpSession: CDPSession | undefined = undefined;

    public constructor(
        private readonly pageUrl: URL,
        private readonly sr: ScreenReader,
        private readonly strategies: INavigationStrategy[],
        private readonly chromeDevToolsProtocolConnection: ChromeDevToolsProtocolConnection
    ) {}

    public async startSession(): Promise<void> {
        const browser = this.chromeDevToolsProtocolConnection.getBrowser();
        // Find page from all open browser sessions
        this.page = browser
            .contexts()
            .flatMap((context): Page[] => context.pages())
            .find((page: Page): boolean => page.url() === this.pageUrl.href);
        if (!this.page) {
            // If page is not already open
            const context: BrowserContext = await browser.newContext();
            this.page = await context.newPage();
            await this.page.goto(this.pageUrl.href);
        }
        this.cdpSession = await this.page.context().newCDPSession(this.page);
        await this.page.bringToFront();
        await this.sr.start();
    }

    public async endEndSession(): Promise<void> {
        this.cdpSession?.detach();
        await this.sr.stop();
    }

    async run(): Promise<PageSessionResult> {
        // Get the accessibility tree
        if (!this.page || !this.cdpSession) {
            throw new Error('Page session not created');
        }
        // Turns on the CDP Accessibility domain for current cdp session.
        await this.cdpSession?.send('Accessibility.enable');
        const axTree = await this.cdpSession?.send('Accessibility.getFullAXTree');
        // Turns off the CDP Accessibility domain for current cdp session.
        await this.cdpSession?.send('Accessibility.disable');

        const results: StrategyResult[] = [];
        for (const strategy of this.strategies) {
            const result = await strategy.execute(this.sr, this.page, axTree, this.cdpSession);
            results.push(result);
            await this.sr.navigateToDocumentStart();
            await delay(2000);
        }
        const html = await this.page.content();
        return {
            axTree,
            html,
            page: this.page,
            results,
            url: this.pageUrl.href,
        };
    }
}
