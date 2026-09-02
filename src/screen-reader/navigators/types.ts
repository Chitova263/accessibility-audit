import type { ScreenReader } from '../drivers/types';

export interface NavigationItem {
    /** The spoken phrase */
    phrase: string;
    /** The item text (focused element text) */
    itemText: string;
}

export interface NavigatorConfig {
    readonly advanceKey: string;
    readonly isComplete: (ctx: EndDetectionContext) => boolean;
}

export interface IElementNavigator extends AsyncIterable<NavigationItem> {
    readonly type: NavigatorType;
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

export interface ScreenReaderKeyBindings {
    readonly nextHeading: string;
    readonly nextHeadingLevel: (level: 1 | 2 | 3 | 4 | 5 | 6) => string;
    readonly nextLink: string;
    readonly nextLandmark: string;
    readonly nextButton: string;
    readonly tab: string;
    readonly arrowDown: string;
    readonly documentStart: string;
}

export interface EndDetectionContext {
    phrase: string;
    itemText: string;
    /** Backend DOM node ID of focused element. Null if focus is outside the document. */
    backendNodeId?: number | null;
    /** Whether the document currently has focus. False when focus is on browser chrome. */
    documentHasFocus?: boolean;
}

/**
 * Declarative end detection strategies.
 * These describe *what* signals the end of navigation, not *how* to compute it.
 * The interpreter (createEndDetector) handles execution.
 */
export type EndDetectionStrategy =
    | EndDetectionPhraseContains
    | EndDetectionPhraseRegex
    | EndDetectionLoopDetection
    | EndDetectionDocumentBoundary
    | EndDetectionAny;

/** Stop when phrase contains the specified text */
export interface EndDetectionPhraseContains {
    readonly type: 'phrase-contains';
    readonly text: string;
    readonly caseSensitive?: boolean;
}

/** Stop when phrase matches the specified regex pattern */
export interface EndDetectionPhraseRegex {
    readonly type: 'phrase-regex';
    readonly pattern: string;
    readonly flags?: string;
}

/** Stop when we've seen the same element before (loop detection for wrapping readers) */
export interface EndDetectionLoopDetection {
    readonly type: 'loop-detection';
    /** Which field to use for detecting duplicates. Defaults to 'phrase'. */
    readonly key?: 'phrase' | 'itemText';
}

/**
 * Stop when focus has left the document (e.g., moved to browser toolbar, address bar).
 * This indicates navigation has reached the boundary of the page content.
 */
export interface EndDetectionDocumentBoundary {
    readonly type: 'document-boundary';
    /** Additional patterns to detect (merged with defaults). */
    readonly additionalPatterns?: string[];
}

/** Stop when any of the sub-strategies triggers (OR logic) */
export interface EndDetectionAny {
    readonly type: 'any';
    readonly of: EndDetectionStrategy[];
}

/**
 * Stateful end detector created from a strategy.
 * Call check() for each navigation step, reset() at the start of each navigation.
 */
export interface EndDetector {
    /** Returns true if navigation should stop */
    check(ctx: EndDetectionContext): boolean;
    /** Reset internal state (called at start of navigation) */
    reset(): void;
}

/** End detection strategies for each navigation type */
export interface ScreenReaderEndDetection {
    readonly heading: EndDetectionStrategy;
    readonly headingLevel: EndDetectionStrategy;
    readonly link: EndDetectionStrategy;
    readonly landmark: EndDetectionStrategy;
    readonly button: EndDetectionStrategy;
    readonly linear?: EndDetectionStrategy;
}

export interface ScreenReaderConfig {
    readonly name: string;
    readonly reader: ScreenReader;
    readonly keyBindings: ScreenReaderKeyBindings;
    readonly endDetection: ScreenReaderEndDetection;
}
