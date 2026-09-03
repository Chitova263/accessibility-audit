/**
 * Shared types for screen reader drivers.
 */

export type ScreenReaderName = 'nvda' | 'voiceover' | 'virtual';

/**
 * Human-readable display names for screen readers.
 * Used in prompts, violation messages, and strategy descriptions.
 */
const SCREEN_READER_DISPLAY_NAMES: Record<ScreenReaderName, string> = {
    nvda: 'NVDA',
    voiceover: 'VoiceOver',
    virtual: 'Virtual Screen Reader',
};

/**
 * Get the human-readable display name for a screen reader.
 * @param name - The screen reader identifier
 * @returns Display name (e.g., 'nvda' → 'NVDA', 'voiceover' → 'VoiceOver')
 */
export function getScreenReaderDisplayName(name: ScreenReaderName): string {
    return SCREEN_READER_DISPLAY_NAMES[name];
}

export interface KeyPressResult {
    /** Phrases spoken in response to this action (empty if screen reader didn't speak) */
    spokenPhrases: string[];
    /** The focused element's text */
    focusedElementText: string;
}

export interface ScreenReader {
    readonly name: ScreenReaderName;
    start(): Promise<void>;
    stop(): Promise<void>;
    press(key: string): Promise<KeyPressResult>;
}
