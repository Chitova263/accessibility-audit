import { chromium, type Browser } from 'playwright';

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

    public async disconnect(): Promise<void> {
        if (this.browser?.isConnected()) {
            this.browser?.close();
        }
    }

    public getBrowser(): Browser {
        if (!this.browser || !this.browser.isConnected()) {
            throw new Error('Could not connect to browser');
        }
        return this.browser;
    }
}
