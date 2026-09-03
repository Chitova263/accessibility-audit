import type { Navigator } from '../../navigators/navigator';
import type { ScreenReader, ScreenReaderName } from '../../drivers/types';
import type { AXNode, GetFullAXTreeResult } from '../../../types/cdp';

export type StrategyName =
    | 'tab'
    | 'arrow'
    | 'heading'
    | 'landmark'
    | 'button'
    | 'link'
    | 'heading-level-1'
    | 'heading-level-2'
    | 'heading-level-3'
    | 'heading-level-4'
    | 'heading-level-5'
    | 'heading-level-6';

export interface StrategyMetadata {
    name: StrategyName;
    description: string;
    mode: 'browse' | 'focus';
}

export interface NavigationStrategyConfig {
    maxSteps: number;
    screenReader: ScreenReaderName;
}

export interface NavigationStep {
    index: number;
    identifier: string;
    spokenPhrases: string[];
    focusedElementText: string;
    focusedElementTextLog: string[];
    timestamp: number;
    axNode: AXNode | undefined;
    htmlSnippet: string | null;
}

export interface CompletionReason {
    /** Why navigation stopped */
    kind: 'exhausted' | 'limit-reached' | 'cycle-complete' | 'trapped';
    /**
     * Human-readable detail for LLM context:
     */
    detail: string;
}

export interface StrategyResult {
    meta: StrategyMetadata;
    navigationSteps: NavigationStep[];
    completionReason: CompletionReason;
}

export interface AccessibilityContext {
    tree: GetFullAXTreeResult;
    getNodeOuterHtml(backendDOMNodeId: number): Promise<string>;
    getFocusedHtmlElementBackendNodeId(): Promise<number | null>;
    getFocusedNodeHtml(): Promise<string | null>;
    /** Returns true if the document has focus, false if focus is on browser chrome */
    getDocumentHasFocus(): Promise<boolean>;
}

/**
 * Context provided to navigation strategies.
 */
export interface NavigationContext {
    navigator: Navigator;
    reader: ScreenReader;
    accessibility: AccessibilityContext;
}

export interface NavigationStrategy {
    meta: StrategyMetadata;
    execute(ctx: NavigationContext): Promise<StrategyResult>;
}
