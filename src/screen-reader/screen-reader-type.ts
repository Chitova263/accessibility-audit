export type ScreenReaderType = 'nvda' | 'virtual' | 'voiceover';

const DISPLAY_NAMES: Record<ScreenReaderType, string> = {
    nvda: 'NVDA',
    voiceover: 'VoiceOver',
    virtual: 'Virtual Screen Reader',
};

export function getScreenReaderDisplayName(type: ScreenReaderType): string {
    return DISPLAY_NAMES[type];
}
