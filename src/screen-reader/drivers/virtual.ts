import type { Page } from 'playwright';
import { createRequire } from 'node:module';
import type { ScreenReader } from './nvda';
import { Logger } from '../../utils/logger';

const _require = createRequire(import.meta.url);
const BROWSER_BUNDLE_PATH = _require.resolve('@guidepup/virtual-screen-reader/browser.js');

interface BrowserWindow {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    document: { body: any };
    __vsr: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        start(options: { container: any }): Promise<void>;
        stop(): Promise<void>;
        press(key: string): Promise<void>;
        next(): Promise<void>;
        previous(): Promise<void>;
        perform(command: string): Promise<void>;
        lastSpokenPhrase(): Promise<string>;
        itemText(): Promise<string>;
        spokenPhraseLog(): Promise<string[]>;
        clearSpokenPhraseLog(): Promise<void>;
        itemTextLog(): Promise<string[]>;
        clearItemTextLog(): Promise<void>;
    };
}

const VSR_COMMAND_PREFIX = '__vsr:';

const VSR_COMMAND_MAP: Record<string, string> = {
    moveToNextHeading: 'moveToNextHeading',
    moveToNextHeadingLevel1: 'moveToNextHeadingLevel1',
    moveToNextHeadingLevel2: 'moveToNextHeadingLevel2',
    moveToNextHeadingLevel3: 'moveToNextHeadingLevel3',
    moveToNextHeadingLevel4: 'moveToNextHeadingLevel4',
    moveToNextHeadingLevel5: 'moveToNextHeadingLevel5',
    moveToNextHeadingLevel6: 'moveToNextHeadingLevel6',
    moveToNextLink: 'moveToNextLink',
    moveToNextLandmark: 'moveToNextLandmark',
    moveToNextButton: '__special:button',
    next: '__special:next',
    documentStart: '__special:documentStart',
};

/**
 * Virtual screen reader driver using @guidepup/virtual-screen-reader.
 * Runs headless in the browser - no OS-level screen reader required.
 */
export class VirtualScreenReader implements ScreenReader {
    private readonly log = Logger.context('VirtualDriver');

    constructor(private readonly page: Page) {}

    async start(): Promise<void> {
        this.log.debug('Injecting virtual screen reader bundle');
        const fs = await import('node:fs/promises');
        const bundleSource = await fs.readFile(BROWSER_BUNDLE_PATH, 'utf-8');

        await this.page.evaluate(async (source: string) => {
            const blob = new Blob([source], { type: 'application/javascript' });
            const blobUrl = URL.createObjectURL(blob);
            try {
                const module = await import(/* webpackIgnore: true */ blobUrl);
                (globalThis as unknown as { __vsr: typeof module.virtual }).__vsr = module.virtual;
            } finally {
                URL.revokeObjectURL(blobUrl);
            }
        }, bundleSource);

        await this.page.waitForFunction(() => typeof (globalThis as unknown as BrowserWindow).__vsr !== 'undefined');
        this.log.debug('Bundle loaded');

        await this.page.evaluate(async () => {
            const w = globalThis as unknown as BrowserWindow;
            await w.__vsr.start({ container: w.document.body });
        });
        this.log.debug('Initialized on document.body');
    }

    async stop(): Promise<void> {
        this.log.debug('Stopping');
        await this.page.evaluate(async () => {
            await (globalThis as unknown as BrowserWindow).__vsr.stop();
        });
    }

    async press(key: string): Promise<void> {
        if (key.startsWith(VSR_COMMAND_PREFIX)) {
            const commandKey = key.slice(VSR_COMMAND_PREFIX.length);
            const command = VSR_COMMAND_MAP[commandKey];

            if (!command) {
                throw new Error(`Unknown virtual screen reader command: ${commandKey}`);
            }

            if (command === '__special:next') {
                await this.page.evaluate(async () => {
                    await (globalThis as unknown as BrowserWindow).__vsr.next();
                });
                return;
            }

            if (command === '__special:documentStart') {
                await this.page.evaluate(async () => {
                    const vsr = (globalThis as unknown as BrowserWindow).__vsr;
                    const w = globalThis as unknown as BrowserWindow;
                    await vsr.stop();
                    await vsr.start({ container: w.document.body });
                });
                return;
            }

            if (command === '__special:button') {
                // Iterate using next() until we find a button
                await this.page.evaluate(async () => {
                    const vsr = (globalThis as unknown as BrowserWindow).__vsr;
                    const startPhrase = await vsr.lastSpokenPhrase();
                    let iterations = 0;
                    const maxIterations = 1000;

                    while (iterations < maxIterations) {
                        await vsr.next();
                        const phrase = await vsr.lastSpokenPhrase();

                        if (phrase.toLowerCase().includes('button')) {
                            return true;
                        }

                        if (phrase === startPhrase && iterations > 0) {
                            return false;
                        }
                        iterations++;
                    }
                    return false;
                });
                return;
            }

            await this.page.evaluate(async (cmd: string) => {
                await (globalThis as unknown as BrowserWindow).__vsr.perform(cmd);
            }, command);
            return;
        }

        await this.page.evaluate(async (k: string) => {
            await (globalThis as unknown as BrowserWindow).__vsr.press(k);
        }, key);
    }

    async lastSpokenPhrase(): Promise<string> {
        return this.page.evaluate(async () => {
            return (globalThis as unknown as BrowserWindow).__vsr.lastSpokenPhrase();
        });
    }

    async itemText(): Promise<string> {
        return this.page.evaluate(async () => {
            return (globalThis as unknown as BrowserWindow).__vsr.itemText();
        });
    }

    async spokenPhraseLog(): Promise<string[]> {
        return this.page.evaluate(async () => {
            return (globalThis as unknown as BrowserWindow).__vsr.spokenPhraseLog();
        });
    }

    async clearSpokenPhraseLog(): Promise<void> {
        await this.page.evaluate(async () => {
            await (globalThis as unknown as BrowserWindow).__vsr.clearSpokenPhraseLog();
        });
    }

    async itemTextLog(): Promise<string[]> {
        return this.page.evaluate(async () => {
            return (globalThis as unknown as BrowserWindow).__vsr.itemTextLog();
        });
    }

    async clearItemTextLog(): Promise<void> {
        await this.page.evaluate(async () => {
            await (globalThis as unknown as BrowserWindow).__vsr.clearItemTextLog();
        });
    }
}
