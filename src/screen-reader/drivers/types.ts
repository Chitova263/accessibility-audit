/**
 * Shared types for screen reader drivers.
 */

export interface PressResult {
    /** Phrases spoken in response to this action (empty if screen reader didn't speak) */
    spokenPhrases: string[];
    /** The focused element's text */
    itemText: string;
}

export interface ScreenReader {
    start(): Promise<void>;
    stop(): Promise<void>;
    press(key: string): Promise<PressResult>;
}
