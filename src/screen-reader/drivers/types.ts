export type { ScreenReaderType } from '../screen-reader-type';
export { getScreenReaderDisplayName } from '../screen-reader-type';
import type { ScreenReaderType } from '../screen-reader-type';

export interface KeyPressResult {
    /** Phrases spoken in response to this action (empty if screen reader didn't speak) */
    spokenPhrases: string[];
    /** The focused element's text */
    focusedElementText: string;
    /** Backend DOM node ID of the current element (for CDP virtual driver) */
    backendDOMNodeId?: number | undefined;
}

export interface ScreenReader {
    readonly name: ScreenReaderType;
    start(): Promise<void>;
    stop(): Promise<void>;
    press(key: string): Promise<KeyPressResult>;
}
