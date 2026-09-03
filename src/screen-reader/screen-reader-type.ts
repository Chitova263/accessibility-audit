/**
 * The canonical screen reader type used throughout the codebase.
 * This is the single source of truth for valid screen reader identifiers.
 */
export type ScreenReaderType = 'nvda' | 'virtual' | 'voiceover';

/**
 * Human-readable display names for screen readers.
 */
const DISPLAY_NAMES: Record<ScreenReaderType, string> = {
    nvda: 'NVDA',
    voiceover: 'VoiceOver',
    virtual: 'Virtual Screen Reader',
};

/**
 * Get the human-readable display name for a screen reader.
 */
export function getScreenReaderDisplayName(type: ScreenReaderType): string {
    return DISPLAY_NAMES[type];
}

/**
 * All valid screen reader types.
 */
export const SCREEN_READER_TYPES: readonly ScreenReaderType[] = ['nvda', 'virtual', 'voiceover'] as const;
