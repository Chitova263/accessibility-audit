export interface NavigationItem {
    phrase: string;
    focusedElementText: string;
    /** Backend DOM node ID of the current element (for CDP virtual driver) */
    backendDOMNodeId?: number | undefined;
}

export interface NavigatorConfig {
    readonly advanceKey: string;
    readonly isComplete: (ctx: NavigationEndContext) => boolean;
}

export type NavigatorType =
    | 'heading'
    | 'heading1'
    | 'heading2'
    | 'heading3'
    | 'heading4'
    | 'heading5'
    | 'heading6'
    | 'link'
    | 'landmark'
    | 'button'
    | 'focusable'
    | 'linear';

export interface NavigationEndContext {
    phrase: string;
    focusedElementText: string;
    /** Null if focus is outside the document */
    backendNodeId?: number | null;
    /** False when focus is on browser chrome */
    documentHasFocus?: boolean;
}

export interface NavigationEndDetector {
    /** Returns true if there are more elements to iterate, false if collection is exhausted */
    hasNext(ctx: NavigationEndContext): boolean;
    /** Reset internal state (called at start of navigation) */
    reset(): void;
}

/** A navigation mode bundles the key to press and the end detector */
export interface NavigationMode {
    readonly key: string;
    readonly endDetector: NavigationEndDetector;
}

/**
 * Static knowledge about a screen reader type.
 * This is per-type, not per-instance. All NVDA instances share the same profile.
 */
export interface ScreenReaderProfile {
    readonly modes: {
        readonly heading: NavigationMode;
        readonly heading1: NavigationMode;
        readonly heading2: NavigationMode;
        readonly heading3: NavigationMode;
        readonly heading4: NavigationMode;
        readonly heading5: NavigationMode;
        readonly heading6: NavigationMode;
        readonly link: NavigationMode;
        readonly landmark: NavigationMode;
        readonly button: NavigationMode;
        readonly focusable: NavigationMode;
        readonly linear: NavigationMode;
    };
    /** Key to press to move cursor to start of document */
    readonly documentStart: string;
}
