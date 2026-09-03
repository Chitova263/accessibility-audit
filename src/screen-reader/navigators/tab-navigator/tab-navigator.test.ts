import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TabNavigator } from './tab-navigator';
import type { ScreenReader, KeyPressResult } from '../../drivers/nvda';

function createMockScreenReader(): ScreenReader {
    return {
        name: 'nvda',
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        press: vi.fn().mockResolvedValue({ spokenPhrases: [], focusedElementText: '' } satisfies KeyPressResult),
    };
}

/**
 * Helper to create a mock press function that returns different results on each call.
 */
function createPressMock(results: Array<{ phrase: string; focusedElementText?: string }>) {
    let callIndex = 0;
    return vi.fn().mockImplementation((): Promise<KeyPressResult> => {
        const result = results[callIndex++];
        if (!result) {
            return Promise.resolve({ spokenPhrases: [''], focusedElementText: '' });
        }
        return Promise.resolve({
            spokenPhrases: [result.phrase],
            focusedElementText: result.focusedElementText ?? '',
        });
    });
}

describe('TabNavigator', () => {
    let mockSR: ScreenReader;

    beforeEach(() => {
        mockSR = createMockScreenReader();
    });

    it('yields items when pressing Tab produces speech', async () => {
        mockSR.press = createPressMock([
            { phrase: 'link, Skip to content', focusedElementText: 'Skip to content' },
            { phrase: 'link, Home', focusedElementText: 'Home' },
            { phrase: 'button, Menu', focusedElementText: 'Menu' },
            { phrase: 'link, Skip to content', focusedElementText: 'Skip to content' }, // Cycle detected
        ]);

        const navigator = new TabNavigator(mockSR, 'Tab');
        const items = [];
        for await (const item of navigator) {
            items.push(item);
        }

        expect(items).toHaveLength(3);
        expect(items[0]!.phrase).toBe('link, Skip to content');
        expect(items[1]!.phrase).toBe('link, Home');
        expect(items[2]!.phrase).toBe('button, Menu');
    });

    it('stops when returning to starting element (cycle detection)', async () => {
        mockSR.press = createPressMock([
            { phrase: 'link, First' },
            { phrase: 'link, Second' },
            { phrase: 'link, First' }, // Back to start
        ]);

        const navigator = new TabNavigator(mockSR, 'Tab');
        const items = [];
        for await (const item of navigator) {
            items.push(item);
        }

        expect(items).toHaveLength(2);
    });

    it('has correct type property', () => {
        const navigator = new TabNavigator(mockSR, 'Tab');
        expect(navigator.type).toBe('focusable');
    });

    it('presses the correct key', async () => {
        mockSR.press = createPressMock([
            { phrase: 'link, Only' },
            { phrase: 'link, Only' }, // Cycle
        ]);

        const navigator = new TabNavigator(mockSR, 'Tab');
        for await (const _item of navigator) {
            // consume
        }

        expect(mockSR.press).toHaveBeenCalledWith('Tab');
    });

    it('returns focusedElementText from KeyPressResult', async () => {
        mockSR.press = createPressMock([
            { phrase: 'link, Skip to content', focusedElementText: 'Skip to content' },
            { phrase: 'link, Skip to content' }, // Cycle
        ]);

        const navigator = new TabNavigator(mockSR, 'Tab');
        const items = [];
        for await (const item of navigator) {
            items.push(item);
        }

        expect(items[0]!.focusedElementText).toBe('Skip to content');
    });
});
