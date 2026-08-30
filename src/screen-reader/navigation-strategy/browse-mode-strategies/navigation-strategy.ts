import type { IScreenReader } from '../../screen-reader';

export interface StrategyMetadata {
    name: string;
    description: string;
    type?:
        | 'tab'
        | 'arrow'
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
    index: number;
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
        | 'end-of-document'
        | 'focus-trapped'
        | 'focus-cycle-complete';
}

export interface AxContext {
    // @ts-ignore
    tree: Protocol.Accessibility.getFullAXTreeReturnValue;
    getNodeOuterHtml(backendDOMNodeId: number): Promise<string>;
    getFocusedHtmlElementBackendNodeId(): Promise<number | null>;
    getFocusedNodeHtml(): Promise<string | null>;
}

export interface NavigationContext {
    sr: IScreenReader;
    ax: AxContext;
}

export interface INavigationStrategy {
    meta: StrategyMetadata;
    execute(ctx: NavigationContext): Promise<StrategyResult>;
}
