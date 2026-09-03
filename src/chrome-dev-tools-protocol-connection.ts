import { chromium, type Browser, type Page, type BrowserContext } from 'playwright';

export interface ChromeDevToolsProtocolConnectionOptions {
    port?: number;
    timeout?: number;
}

export class ChromeDevToolsProtocolConnection {
    private browser: Browser | undefined = undefined;

    private constructor(private readonly options: ChromeDevToolsProtocolConnectionOptions | undefined) {}

    public static createConnection(
        options?: ChromeDevToolsProtocolConnectionOptions
    ): ChromeDevToolsProtocolConnection {
        return new ChromeDevToolsProtocolConnection(options);
    }
    public async connect(): Promise<void> {
        const port: number = this.options?.port ?? 9222;
        const timeout: number = this.options?.timeout ?? 20000;
        this.browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout });
    }

    public isConnected(): boolean {
        return !!this.browser?.isConnected();
    }

    public async disconnect(): Promise<void> {
        if (this.browser?.isConnected()) {
            await this.browser?.close();
            this.browser = undefined;
        }
    }

    public async goToPage(url: URL): Promise<Page> {
        if (!this.browser || !this.browser.isConnected()) {
            throw new Error('Could not connect to browser');
        }
        let page = this.browser
            ?.contexts()
            .flatMap((context): Page[] => context.pages())
            .find((page: Page): boolean => page.url() === url.href);
        if (!page) {
            // If page is not already open
            const context: BrowserContext = await this.browser.newContext();
            page = await context.newPage();
            await page.goto(url.href);
        }
        return page;
    }
}
