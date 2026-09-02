import { describe, it, expect } from 'vitest';
import { getScreenReaderDisplayName, type ScreenReaderName } from './types';

describe('getScreenReaderDisplayName', () => {
    it('returns "NVDA" for nvda', () => {
        expect(getScreenReaderDisplayName('nvda')).toBe('NVDA');
    });

    it('returns "VoiceOver" for voiceover', () => {
        expect(getScreenReaderDisplayName('voiceover')).toBe('VoiceOver');
    });

    it('returns "Virtual Screen Reader" for virtual', () => {
        expect(getScreenReaderDisplayName('virtual')).toBe('Virtual Screen Reader');
    });

    it('returns correct display name for all ScreenReaderName values', () => {
        const names: ScreenReaderName[] = ['nvda', 'voiceover', 'virtual'];
        const expected = ['NVDA', 'VoiceOver', 'Virtual Screen Reader'];

        names.forEach((name, i) => {
            expect(getScreenReaderDisplayName(name)).toBe(expected[i]);
        });
    });
});
