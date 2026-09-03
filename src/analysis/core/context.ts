import type { StrategyResult } from '../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';
import type { ScreenReaderName } from '../../screen-reader/drivers/types';

export interface AuditContext {
    transcript: StrategyResult[];
    screenReader: ScreenReaderName;
}
