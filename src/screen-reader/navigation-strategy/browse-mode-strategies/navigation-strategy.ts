import type { IScreenReader } from '../../screen-reader';

export interface StrategyMetadata {
    name: string;
    description: string;
    mode: 'browse' | 'focus';
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

export interface CompletionReason {
    /** Why navigation stopped */
    kind: 'exhausted' | 'limit-reached' | 'cycle-complete' | 'trapped';
    /**
     * Human-readable detail for LLM context. Examples:
     * - "no more headings found on page"
     * - "tab focus returned to first element"
     * - "keyboard focus could not escape element"
     */
    detail: string;
}

export interface StrategyResult {
    meta: StrategyMetadata;
    navigationSteps: NavigationStep[];
    completionReason: CompletionReason;
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
