import type { ScreenReader } from '../drivers/nvda';

export interface NavigationItem {
    phrase: string;
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
}

export interface ScreenReaderEndPatterns {
    readonly heading: (ctx: EndDetectionContext) => boolean;
    readonly headingLevel: (ctx: EndDetectionContext) => boolean;
    readonly link: (ctx: EndDetectionContext) => boolean;
    readonly landmark: (ctx: EndDetectionContext) => boolean;
    readonly button: (ctx: EndDetectionContext) => boolean;
}

export interface ScreenReaderConfig {
    readonly name: string;
    readonly reader: ScreenReader;
    readonly keyBindings: ScreenReaderKeyBindings;
    readonly endDetection: ScreenReaderEndPatterns;
}
