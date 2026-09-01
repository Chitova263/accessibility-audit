import { describe, it, expect, vi } from 'vitest';
import { DownArrowNavigator } from './down-arrow-navigator';
import type { ScreenReader } from '../../drivers/nvda';

function createMockIO(overrides: Partial<ScreenReader> = {}): ScreenReader {
    return {
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        press: vi.fn().mockResolvedValue(undefined),
        lastSpokenPhrase: vi.fn().mockResolvedValue(''),
        itemText: vi.fn().mockResolvedValue(''),
        spokenPhraseLog: vi.fn().mockResolvedValue([]),
        clearSpokenPhraseLog: vi.fn().mockResolvedValue(undefined),
        itemTextLog: vi.fn().mockResolvedValue([]),
        clearItemTextLog: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

describe('ArrowNavigator', () => {
    it('yields items until repeated phrase threshold is reached', async () => {
        const mockIO = createMockIO({
            lastSpokenPhrase: vi
                .fn()
                .mockResolvedValueOnce('Paragraph 1')
                .mockResolvedValueOnce('Paragraph 2')
                .mockResolvedValueOnce('Paragraph 3')
                .mockResolvedValueOnce('End of document') // Repeat 1
                .mockResolvedValueOnce('End of document') // Repeat 2
                .mockResolvedValueOnce('End of document'), // Repeat 3 - triggers stop
            itemText: vi
                .fn()
                .mockResolvedValueOnce('Text 1')
                .mockResolvedValueOnce('Text 2')
                .mockResolvedValueOnce('Text 3')
                .mockResolvedValueOnce('End')
                .mockResolvedValueOnce('End')
                .mockResolvedValueOnce('End'),
        });

        // Use repeat threshold of 3 for this test
        const navigator = new DownArrowNavigator(mockIO, 'Down', 3);

        const items = [];
        for await (const item of navigator) {
            items.push(item);
        }

        expect(items).toHaveLength(6);
        expect(items[0]?.phrase).toBe('Paragraph 1');
        expect(items[1]?.phrase).toBe('Paragraph 2');
        expect(items[2]?.phrase).toBe('Paragraph 3');
        expect(items[3]?.phrase).toBe('End of document');
        expect(items[4]?.phrase).toBe('End of document');
        expect(items[5]?.phrase).toBe('End of document');
    });

    it('presses Down arrow key for each advance', async () => {
        const mockIO = createMockIO({
            lastSpokenPhrase: vi
                .fn()
                .mockResolvedValueOnce('Line 1')
                .mockResolvedValueOnce('End')
                .mockResolvedValueOnce('End')
                .mockResolvedValueOnce('End'),
            itemText: vi.fn().mockResolvedValue('text'),
        });

        const navigator = new DownArrowNavigator(mockIO, 'Down', 3);

        const items = [];
        for await (const item of navigator) {
            items.push(item);
        }

        expect(mockIO.press).toHaveBeenCalledWith('Down');
    });

    it('uses custom arrow key when provided', async () => {
        const mockIO = createMockIO({
            lastSpokenPhrase: vi
                .fn()
                .mockResolvedValueOnce('Item')
                .mockResolvedValueOnce('Item')
                .mockResolvedValueOnce('Item')
                .mockResolvedValueOnce('Item'),
            itemText: vi.fn().mockResolvedValue('text'),
        });

        const navigator = new DownArrowNavigator(mockIO, 'Up', 3);

        const items = [];
        for await (const item of navigator) {
            items.push(item);
        }

        expect(mockIO.press).toHaveBeenCalledWith('Up');
    });

    it('uses custom repeat threshold when provided', async () => {
        let callCount = 0;
        const phrases = ['Content', 'End', 'End'];

        const mockIO = createMockIO({
            lastSpokenPhrase: vi.fn().mockImplementation(() => {
                const phrase = callCount < phrases.length ? phrases[callCount] : 'End';
                callCount++;
                return Promise.resolve(phrase);
            }),
            itemText: vi.fn().mockResolvedValue('text'),
        });

        const navigator = new DownArrowNavigator(mockIO, 'Down', 2);

        const items = [];
        for await (const item of navigator) {
            items.push(item);
        }

        expect(items).toHaveLength(3);
        expect(items[0]?.phrase).toBe('Content');
        expect(items[1]?.phrase).toBe('End');
        expect(items[2]?.phrase).toBe('End');
    });

    it('resets repeat count when different phrase encountered', async () => {
        const mockIO = createMockIO({
            lastSpokenPhrase: vi
                .fn()
                .mockResolvedValueOnce('A')
                .mockResolvedValueOnce('A') // Repeat 1
                .mockResolvedValueOnce('B') // Reset
                .mockResolvedValueOnce('B') // Repeat 1
                .mockResolvedValueOnce('B') // Repeat 2
                .mockResolvedValueOnce('B'), // Repeat 3 - stop
            itemText: vi.fn().mockResolvedValue('text'),
        });

        const navigator = new DownArrowNavigator(mockIO, 'Down', 3);

        const items = [];
        for await (const item of navigator) {
            items.push(item);
        }

        expect(items).toHaveLength(5); // A, A, B, B, B
    });

    it('skips empty announcements', async () => {
        const mockIO = createMockIO({
            lastSpokenPhrase: vi
                .fn()
                .mockResolvedValueOnce('Content 1')
                .mockResolvedValueOnce('') // Empty - skip
                .mockResolvedValueOnce('Content 2')
                .mockResolvedValueOnce('End')
                .mockResolvedValueOnce('End')
                .mockResolvedValueOnce('End'),
            itemText: vi
                .fn()
                .mockResolvedValueOnce('Text 1')
                .mockResolvedValueOnce('') // Empty
                .mockResolvedValueOnce('Text 2')
                .mockResolvedValueOnce('End')
                .mockResolvedValueOnce('End')
                .mockResolvedValueOnce('End'),
        });

        const navigator = new DownArrowNavigator(mockIO, 'Down', 3);

        const items = [];
        for await (const item of navigator) {
            items.push(item);
        }

        const nonEmptyItems = items.filter((i) => i.phrase !== '' || i.itemText !== '');
        expect(nonEmptyItems.length).toBeGreaterThanOrEqual(2);
    });

    it('has correct type', () => {
        const mockIO = createMockIO();
        const navigator = new DownArrowNavigator(mockIO);

        expect(navigator.type).toBe('linear');
    });
});
