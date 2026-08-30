import type { CDPSession, Page } from 'playwright';
import { delay, type IScreenReader } from './screen-reader';
import type {
    INavigationStrategy,
    NavigationContext,
    StrategyResult,
} from './navigation-strategy/browse-mode-strategies/navigation-strategy';
import { AxTreeUtil } from './accessibility-tree/ax-tree-util';

export interface PageSessionResult {
    page: Page;
    html: string;
    results: StrategyResult[];
    url: string;
    // @ts-ignore
    axTree: Protocol.Accessibility.getFullAXTreeReturnValue;
}

export class PageSession {
    private cdpSession: CDPSession | null = null;

    public constructor(
        private readonly pageUrl: URL,
        private readonly sr: IScreenReader,
        private readonly strategies: INavigationStrategy[],
        private readonly page: Page
    ) {}

    public async startSession(): Promise<void> {
        this.cdpSession = await this.page.context().newCDPSession(this.page);
        await this.page.bringToFront();
        await this.sr.start();
    }

    public async endEndSession(): Promise<void> {
        this.cdpSession?.detach();
        await this.sr.stop();
    }

    async run(): Promise<PageSessionResult> {
        if (!this.page || !this.cdpSession) {
            throw new Error('Page session not created');
        }
        await this.cdpSession.send('Accessibility.enable');
        const axTree = await this.cdpSession.send('Accessibility.getFullAXTree');
        await this.cdpSession.send('Accessibility.disable');

        const results: StrategyResult[] = [];
        for (const strategy of this.strategies) {
            const result = await strategy.execute(this.buildContext(axTree));
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

    private buildContext(
        // @ts-ignore
        axTree: Protocol.Accessibility.getFullAXTreeReturnValue
    ): NavigationContext {
        if (!this.cdpSession) {
            throw new Error('CDPSession not created');
        }
        const session = this.cdpSession;
        return {
            sr: this.sr,
            ax: {
                tree: axTree,
                getNodeOuterHtml: (nodeId: number) => AxTreeUtil.getNodeOuterHtml(session, nodeId),
                getFocusedHtmlElementBackendNodeId: () => AxTreeUtil.getFocusedHtmlElementBackendNodeId(session),
                getFocusedNodeHtml: () => AxTreeUtil.getFocusedNodeHtml(this.page),
            },
        };
    }
}
