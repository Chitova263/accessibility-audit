import type { StrategyResult } from '../../screen-reader/strategies/navigation-strategy';
import type { ScreenReaderType } from '../../screen-reader/screen-reader-type';

export interface AuditContext {
    transcript: StrategyResult[];
    screenReader: ScreenReaderType;
}
