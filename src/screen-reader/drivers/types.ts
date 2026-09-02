/**
 * Shared types for screen reader drivers.
 */

export type ScreenReaderName = 'nvda' | 'voiceover' | 'virtual';

export interface PressResult {
    /** Phrases spoken in response to this action (empty if screen reader didn't speak) */
    spokenPhrases: string[];
    /** The focused element's text */
    itemText: string;
}

export interface ScreenReader {
    /** The screen reader identifier */
    readonly name: ScreenReaderName;
    start(): Promise<void>;
    stop(): Promise<void>;
    press(key: string): Promise<PressResult>;
}
