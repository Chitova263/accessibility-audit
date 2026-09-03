import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DownArrowNavigator } from './down-arrow-navigator';
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
 * Use `null` phrase to simulate end of document (no speech).
 */
function createPressMock(results: Array<{ phrase: string | null; focusedElementText?: string }>) {
    let callIndex = 0;
    return vi.fn().mockImplementation((): Promise<KeyPressResult> => {
        const result = results[callIndex++];
        if (!result || result.phrase === null) {
            return Promise.resolve({ spokenPhrases: [], focusedElementText: '' });
        }
        return Promise.resolve({
            spokenPhrases: [result.phrase],
            focusedElementText: result.focusedElementText ?? '',
        });
    });
}

describe('DownArrowNavigator', () => {
    let mockSR: ScreenReader;

    beforeEach(() => {
        mockSR = createMockScreenReader();
    });

    it('yields items when pressing down arrow produces speech', async () => {
        mockSR.press = createPressMock([
            { phrase: 'First item' },
            { phrase: 'Second item' },
            { phrase: null }, // End - no speech
            { phrase: null }, // Second silent press confirms end
        ]);

        const navigator = new DownArrowNavigator(mockSR, 'Down');
        const items = [];
        for await (const item of navigator) {
            items.push(item);
        }

        expect(items).toHaveLength(2);
        expect(items[0]!.phrase).toBe('First item');
        expect(items[1]!.phrase).toBe('Second item');
    });

    it('stops after detecting same phrase repeated 30 times (repeat threshold)', async () => {
        const repeatedPhrase = 'link, Support';
        const results: Array<{ phrase: string }> = [];
        for (let i = 0; i < 35; i++) {
            results.push({ phrase: repeatedPhrase });
        }
        mockSR.press = createPressMock(results);

        const navigator = new DownArrowNavigator(mockSR, 'Down', 30); // repeatThreshold = 30
        const items = [];
        for await (const item of navigator) {
            items.push(item);
        }

        // Should stop at 30 repetitions (repeat threshold)
        expect(items).toHaveLength(30);
    });

    it('respects custom repeat threshold', async () => {
        const repeatedPhrase = 'repeated item';
        const results: Array<{ phrase: string }> = [];
        for (let i = 0; i < 20; i++) {
            results.push({ phrase: repeatedPhrase });
        }
        mockSR.press = createPressMock(results);

        const customThreshold = 5;
        const navigator = new DownArrowNavigator(mockSR, 'Down', customThreshold);
        const items = [];
        for await (const item of navigator) {
            items.push(item);
        }

        expect(items).toHaveLength(customThreshold);
    });

    it('stops after 2 consecutive silent presses (no speech = end of document)', async () => {
        mockSR.press = createPressMock([
            { phrase: 'First item' },
            { phrase: 'Second item' },
            { phrase: null }, // First silent press
            { phrase: null }, // Second silent press - confirms end
        ]);

        const navigator = new DownArrowNavigator(mockSR, 'Down');
        const items = [];
        for await (const item of navigator) {
            items.push(item);
        }

        expect(items).toHaveLength(2);
        expect(mockSR.press).toHaveBeenCalledTimes(4); // 2 content + 2 silent
    });

    it('resets silent counter when speech occurs after one silent press', async () => {
        mockSR.press = createPressMock([
            { phrase: 'First item' },
            { phrase: null }, // Silent, but not end yet
            { phrase: 'Recovery item' }, // Speech occurs, reset counter
            { phrase: null }, // Silent again
            { phrase: null }, // Second consecutive silent - now it's end
        ]);

        const navigator = new DownArrowNavigator(mockSR, 'Down');
        const items = [];
        for await (const item of navigator) {
            items.push(item);
        }

        // Should get First item and Recovery item
        expect(items).toHaveLength(2);
        expect(items[0]!.phrase).toBe('First item');
        expect(items[1]!.phrase).toBe('Recovery item');
    });

    it('skips blank announcements where neither phrase nor focusedElementText exist', async () => {
        mockSR.press = createPressMock([
            { phrase: 'First item' },
            { phrase: '', focusedElementText: '' }, // Blank - skipped
            { phrase: '', focusedElementText: '' }, // Blank - skipped
            { phrase: 'After blanks' },
            { phrase: null }, // Silent
            { phrase: null }, // Second silent - end
        ]);

        const navigator = new DownArrowNavigator(mockSR, 'Down');
        const items = [];
        for await (const item of navigator) {
            items.push(item);
        }

        // Blanks are skipped (no focusedElementText or phrase), so 2 total
        expect(items).toHaveLength(2);
        expect(items[0]!.phrase).toBe('First item');
        expect(items[1]!.phrase).toBe('After blanks');
    });

    it('has correct type property', () => {
        const navigator = new DownArrowNavigator(mockSR, 'Down');
        expect(navigator.type).toBe('linear');
    });
});
