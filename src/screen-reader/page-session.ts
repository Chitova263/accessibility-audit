import type { CDPSession, Page } from 'playwright';
import type { ScreenReader } from './drivers/nvda';
import type { Navigator } from './navigators/navigator';
import type {
    INavigationStrategy,
    NavigationContext,
    StrategyResult,
} from './navigation-strategy/browse-mode-strategies/navigation-strategy';
import { AxTreeUtil } from './accessibility-tree/ax-tree-util';
import { Logger } from '../utils/logger';

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

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
    private readonly log = Logger.context('PageSession');

    public constructor(
        private readonly pageUrl: URL,
        private readonly reader: ScreenReader,
        private readonly navigator: Navigator,
        private readonly strategies: INavigationStrategy[],
        private readonly page: Page
    ) {}

    public async startSession(): Promise<void> {
        this.log.info(`Starting session for ${this.pageUrl.href}`);
        this.cdpSession = await this.page.context().newCDPSession(this.page);
        await this.page.bringToFront();
        await this.reader.start();
        this.log.debug('Session started, screen reader initialized');
    }

    public async endEndSession(): Promise<void> {
        this.log.debug('Ending session');
        this.cdpSession?.detach();
        await this.reader.stop();
        this.log.info('Session ended');
    }

    async run(): Promise<PageSessionResult> {
        if (!this.page || !this.cdpSession) {
            throw new Error('Page session not created');
        }

        this.log.debug('Fetching accessibility tree');
        await this.cdpSession.send('Accessibility.enable');
        const axTree = await this.cdpSession.send('Accessibility.getFullAXTree');
        await this.cdpSession.send('Accessibility.disable');
        this.log.debug(`Accessibility tree fetched: ${axTree.nodes.length} nodes`);

        const results: StrategyResult[] = [];
        const totalStrategies = this.strategies.length;

        this.log.info(`Running ${totalStrategies} navigation strategies`);

        for (let i = 0; i < this.strategies.length; i++) {
            const strategy = this.strategies[i]!;
            const strategyName = strategy.constructor.name;

            Logger.progress(i + 1, totalStrategies, `Running ${strategyName}`);

            const startTime = Date.now();
            const result = await strategy.execute(this.buildContext(axTree));
            const duration = Date.now() - startTime;

            this.log.debug(`${strategyName} completed: ${result.navigationSteps.length} steps in ${duration}ms`);

            results.push(result);
            await this.navigator.navigateToDocumentStart();
            await delay(2000);
        }

        this.log.info(
            `All strategies completed: ${results.reduce((sum, r) => sum + r.navigationSteps.length, 0)} total steps`
        );

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
            navigator: this.navigator,
            reader: this.reader,
            ax: {
                tree: axTree,
                getNodeOuterHtml: (nodeId: number) => AxTreeUtil.getNodeOuterHtml(session, nodeId),
                getFocusedHtmlElementBackendNodeId: () => AxTreeUtil.getFocusedHtmlElementBackendNodeId(session),
                getFocusedNodeHtml: () => AxTreeUtil.getFocusedNodeHtml(this.page),
            },
        };
    }
}
