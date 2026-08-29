/**
 * Audit Context
 *
 * The single input every check receives. Checks declare the narrowest slice they
 * need: analyzers that only read screen reader output take `TranscriptContext`,
 * while checks that drive the live page take the full `AuditContext`.
 *
 * `AuditContext` is assignable to `TranscriptContext`, so the registry passes one
 * object to every check regardless of which it asks for — and a transcript-only
 * analyzer can be tested without conjuring a Page.
 */

import type { Page } from 'playwright';
import type { StrategyResult } from '../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';

/** What a screen reader recorded while navigating the page. */
export interface TranscriptContext {
    strategyResults: StrategyResult[];
}

/** The transcript plus the live page, for checks that need the DOM. */
export interface AuditContext extends TranscriptContext {
    /** Must still be open: axe-core evaluates against it. */
    page: Page;
}
