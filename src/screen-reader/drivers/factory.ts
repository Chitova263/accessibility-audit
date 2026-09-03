import type { ScreenReader } from './types';
import type { ScreenReaderType } from '../screen-reader-type';
import type { BrowserTarget } from '../browser-target';

import { Nvda } from './nvda';
import { VirtualScreenReader } from './virtual';
import { VoiceOverDriver } from './voiceover';
import { Logger } from '../../utils/logger';

export type { ScreenReaderType } from '../screen-reader-type';

/**
 * Build the driver for `type`. Every driver takes the same target, so each one can
 * satisfy its own startup requirements (window focus, in-page injection) instead of
 * having them handled by the caller.
 */
export function createReader(type: ScreenReaderType, target: BrowserTarget): ScreenReader {
    Logger.context('DriverFactory').debug(`Creating ${type} screen reader driver`);

    switch (type) {
        case 'virtual':
            return new VirtualScreenReader(target);
        case 'voiceover':
            return new VoiceOverDriver(target);
        case 'nvda':
            return new Nvda(target);
    }
}
