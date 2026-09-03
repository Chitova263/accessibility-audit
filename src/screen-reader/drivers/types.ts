/**
 * Shared types for screen reader drivers.
 */

export type { ScreenReaderType } from '../screen-reader-type';
export { getScreenReaderDisplayName } from '../screen-reader-type';
import type { ScreenReaderType } from '../screen-reader-type';

export interface KeyPressResult {
    /** Phrases spoken in response to this action (empty if screen reader didn't speak) */
    spokenPhrases: string[];
    /** The focused element's text */
    focusedElementText: string;
}

export interface ScreenReader {
    readonly name: ScreenReaderType;
    start(): Promise<void>;
    stop(): Promise<void>;
    press(key: string): Promise<KeyPressResult>;
}
