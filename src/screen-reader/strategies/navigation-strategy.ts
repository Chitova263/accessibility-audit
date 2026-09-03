import type { VirtualCursor } from '../virtual-cursor';
import type { AXNode, GetFullAXTreeResult } from '../../types/cdp';

export type NavigationStrategyName =
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

export interface NavigationStrategyMetadata {
    name: NavigationStrategyName;
    description: string;
}

export interface NavigationStrategyConfig {
    maxSteps: number;
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
    kind: 'exhausted' | 'limit-reached' | 'cycle-complete' | 'trapped';
    detail: string;
}

export interface StrategyResult {
    meta: NavigationStrategyMetadata;
    navigationSteps: NavigationStep[];
    completionReason: CompletionReason;
}

export interface AccessibilityContext {
    tree: GetFullAXTreeResult;
    getNodeOuterHtml(backendDOMNodeId: number): Promise<string>;
    getFocusedHtmlElementBackendNodeId(): Promise<number | null>;
    getFocusedNodeHtml(): Promise<string | null>;
    getDocumentHasFocus(): Promise<boolean>;
}

export interface NavigationContext {
    virtualCursor: VirtualCursor;
    accessibility: AccessibilityContext;
}

export interface NavigationStrategy {
    meta: NavigationStrategyMetadata;
    execute(ctx: NavigationContext): Promise<StrategyResult>;
}
