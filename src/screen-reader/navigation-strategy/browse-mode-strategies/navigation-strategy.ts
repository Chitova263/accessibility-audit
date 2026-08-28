import type { CDPSession, Page } from 'playwright';
import type { IScreenReader } from '../../screen-reader';

export interface StrategyMetadata {
    name: string;
    description: string;
    type?:
        | 'tab'
        | 'heading'
        | 'landmark'
        | 'button'
        | 'link'
        | 'heading1'
        | 'heading2'
        | 'heading3'
        | 'heading4'
        | 'heading5'
        | 'heading6';
}

export interface NavigationStrategyConfig {
    maxSteps: number;
}

export interface NavigationStep {
    identifier: string;
    spokenPhrases: string[];
    itemText: string;
    itemTextLog: string[];
    timestamp: number;
    // @ts-ignore
    axNode: Protocol.Accessibility.AXNode | undefined;
    htmlSnippet: string | null;
}

export interface StrategyResult {
    meta: StrategyMetadata;
    navigationSteps: NavigationStep[];
    completionReason:
        | 'trapped'
        | 'completed'
        | 'end-of-headings'
        | 'end-of-landmarks'
        | 'end-of-buttons'
        | 'end-of-links'
        | 'end-of-heading-level'
        | 'focus-trapped'
        | 'focus-cycle-complete';
}

export interface INavigationStrategy {
    meta: StrategyMetadata;
    execute(
        sr: IScreenReader,
        page: Page,
        // @ts-ignore
        accessibilityTree: Protocol.Accessibility.getFullAXTreeReturnValue,
        cdpSession: CDPSession
    ): Promise<StrategyResult>;
}
