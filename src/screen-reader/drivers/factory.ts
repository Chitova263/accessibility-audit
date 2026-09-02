import type { Page } from 'playwright';
import type { ScreenReader } from './types';
import type { ScreenReaderKeyBindings, ScreenReaderEndDetection } from '../navigators/types';
import type { ScreenReaderType } from '../../cli/schemas';

import { Nvda } from './nvda';
import { VirtualScreenReader } from './virtual';
import { VoiceOverDriver } from './voiceover';
import { nvdaKeyBindings, nvdaEndDetection } from '../navigators/config/nvda';
import { virtualKeyBindings, virtualEndDetection } from '../navigators/config/virtual';
import { voiceOverKeyBindings, voiceOverEndDetection } from '../navigators/config/voiceover';
import { Logger } from '../../utils/logger';

export type { ScreenReaderType } from '../../cli/schemas';

export interface DriverConfig {
    reader: ScreenReader;
    keyBindings: ScreenReaderKeyBindings;
    endDetection: ScreenReaderEndDetection;
    cleanup: () => Promise<void>;
}

export interface CreateDriverOptions {
    type: ScreenReaderType;
    page?: Page;
}

/**
 * Creates a screen reader driver with its matching configuration.
 */
export async function createDriver(options: CreateDriverOptions): Promise<DriverConfig> {
    const { type, page } = options;
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

    if (type === 'voiceover') {
        log.info('Creating VoiceOver screen reader driver');
        const reader = new VoiceOverDriver();

        return {
            reader,
            keyBindings: voiceOverKeyBindings,
            endDetection: voiceOverEndDetection,
            cleanup: async () => {
                await reader.stop();
            },
        };
    }

    log.info('Creating NVDA screen reader driver');
    const nvda = new Nvda();

    return {
        reader: nvda,
        keyBindings: nvdaKeyBindings,
        endDetection: nvdaEndDetection,
        cleanup: async () => {
            await nvda.stop();
        },
    };
}
