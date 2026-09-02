import type { Page } from 'playwright';
import type { ScreenReader } from './nvda';
import type { ScreenReaderKeyBindings, ScreenReaderEndDetection } from '../navigators/types';

import { Nvda } from './nvda';
import { VirtualScreenReader } from './virtual';
import { nvdaKeyBindings, nvdaEndDetection } from '../navigators/config/nvda';
import { virtualKeyBindings, virtualEndDetection } from '../navigators/config/virtual';
import { Logger } from '../../utils/logger';

export type ScreenReaderType = 'nvda' | 'virtual';

export interface DriverConfig {
    reader: ScreenReader;
    keyBindings: ScreenReaderKeyBindings;
    endDetection: ScreenReaderEndDetection;
    cleanup: () => Promise<void>;
}

export interface CreateDriverOptions {
    type: ScreenReaderType;
    page?: Page;
    /** Enable NVDA speech audio output. Default: false (silent) */
    speech?: boolean;
}

/**
 * Creates a screen reader driver with its matching configuration.
 */
export async function createDriver(options: CreateDriverOptions): Promise<DriverConfig> {
    const { type, page, speech } = options;
    const log = Logger.context('DriverFactory');

    if (type === 'virtual') {
        if (!page) {
            throw new Error('Virtual screen reader requires a Playwright page instance');
        }

        log.info('Creating virtual screen reader driver');
        const reader = new VirtualScreenReader(page);

        return {
            reader,
            keyBindings: virtualKeyBindings,
            endDetection: virtualEndDetection,
            cleanup: async () => {
                await reader.stop();
            },
        };
    }

    log.info(`Creating NVDA screen reader driver (speech: ${speech ? 'on' : 'off'})`);
    const nvda = new Nvda({ speech: speech ?? false });

    return {
        reader: nvda,
        keyBindings: nvdaKeyBindings,
        endDetection: nvdaEndDetection,
        cleanup: async () => {
            await nvda.stop();
        },
    };
}
