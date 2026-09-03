import type { ScreenReaderType } from './screen-reader-type';
import type { ScreenReader } from './drivers/types';
import type { BrowserTarget } from './browser-target';
import { createReader } from './drivers/factory';
import { getProfile } from './config';
import { VirtualCursor } from './virtual-cursor';
import { Logger } from '../utils/logger';

/**
 * A running screen reader driving a browser target.
 *
 * Owns the driver end to end - construction, start/stop, and the {@link VirtualCursor}
 * layered on top of it. Callers navigate through `cursor` and never touch the driver,
 * so the driver appears in exactly one place.
 */
export class ScreenReaderSession {
    private readonly log = Logger.context('ScreenReaderSession');
    private stopped = false;

    private constructor(
        private readonly reader: ScreenReader,
        readonly cursor: VirtualCursor
    ) {}

    /** Create the driver for `type` and start it against `target`. */
    static async start(type: ScreenReaderType, target: BrowserTarget): Promise<ScreenReaderSession> {
        const reader = createReader(type, target);
        const session = new ScreenReaderSession(reader, new VirtualCursor(reader, getProfile(type)));

        await reader.start();
        session.log.info(`${type} started`);
        return session;
    }

    get name(): ScreenReaderType {
        return this.reader.name;
    }

    async stop(): Promise<void> {
        if (this.stopped) return;
        this.stopped = true;
        await this.reader.stop();
        this.log.debug('Screen reader stopped');
    }
}
