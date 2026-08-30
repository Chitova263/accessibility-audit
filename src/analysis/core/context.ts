import type { Page, CDPSession } from 'playwright';
import type { StrategyResult } from '../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';

export interface AuditContext {
    transcript: StrategyResult[];
    page: Page;
    cdp: CDPSession;
}
