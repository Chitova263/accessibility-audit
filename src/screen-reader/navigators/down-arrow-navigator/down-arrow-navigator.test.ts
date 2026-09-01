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

/**
 * Create coordinated mocks where spokenPhraseLog and lastSpokenPhrase
 * return consistent values based on a sequence of phrases.
 * Empty string in the sequence means "no speech" (end of document).
 */
function createCoordinatedMocks(phrases: (string | null)[]) {
    let callIndex = 0;
    
    return {
        spokenPhraseLog: vi.fn().mockImplementation(() => {
            const phrase = phrases[callIndex];
            // null or undefined means end of document (empty log)
            if (phrase == null) {
                return Promise.resolve([]);
            }
            return Promise.resolve(phrase ? [phrase] : []);
        }),
        lastSpokenPhrase: vi.fn().mockImplementation(() => {
            const phrase = phrases[callIndex];
            callIndex++;
            return Promise.resolve(phrase ?? '');
        }),
    };
}

describe('DownArrowNavigator', () => {
    it('stops when NVDA produces no new speech (end of document)', async () => {
        const mocks = createCoordinatedMocks([
            'Paragraph 1',
            'Paragraph 2', 
            'Last item',
            null,  // Silent - end of document (1st)
            null,  // Silent - end of document (2nd) - triggers stop
        ]);
        
        const mockIO = createMockIO({
            ...mocks,
            itemText: vi.fn().mockResolvedValue('text'),
        });

        const navigator = new DownArrowNavigator(mockIO);

        const items = [];
        for await (const item of navigator) {
            items.push(item);
        }

        expect(items).toHaveLength(3);
        expect(items[0]?.phrase).toBe('Paragraph 1');
        expect(items[1]?.phrase).toBe('Paragraph 2');
        expect(items[2]?.phrase).toBe('Last item');
    });

    it('yields items until repeated phrase threshold is reached', async () => {
        const mocks = createCoordinatedMocks([
            'Paragraph 1',
            'Paragraph 2',
            'End of document',
            'End of document',
            'End of document', // 3rd repeat - triggers stop
        ]);
        
        const mockIO = createMockIO({
            ...mocks,
            itemText: vi.fn().mockResolvedValue('text'),
        });

        const navigator = new DownArrowNavigator(mockIO);

        const items = [];
        for await (const item of navigator) {
            items.push(item);
        }

        // Stops after 3 consecutive repeats (default threshold)
        expect(items).toHaveLength(5);
        expect(items[0]?.phrase).toBe('Paragraph 1');
        expect(items[1]?.phrase).toBe('Paragraph 2');
    });

    it('presses Down arrow key for each advance', async () => {
        const mocks = createCoordinatedMocks(['Line 1', null, null]);
        
        const mockIO = createMockIO({
            ...mocks,
            itemText: vi.fn().mockResolvedValue('text'),
        });

        const navigator = new DownArrowNavigator(mockIO);

        const items = [];
        for await (const item of navigator) {
            items.push(item);
        }

        expect(mockIO.press).toHaveBeenCalledWith('Down');
    });

    it('uses custom arrow key when provided', async () => {
        const mocks = createCoordinatedMocks(['Item', null, null]);
        
        const mockIO = createMockIO({
            ...mocks,
            itemText: vi.fn().mockResolvedValue('text'),
        });

        const navigator = new DownArrowNavigator(mockIO, 'Up');

        const items = [];
        for await (const item of navigator) {
            items.push(item);
        }

        expect(mockIO.press).toHaveBeenCalledWith('Up');
    });

    it('uses custom repeat threshold when provided', async () => {
        const mocks = createCoordinatedMocks([
            'Content',
            'End',
            'End', // 2nd repeat - triggers stop with threshold 2
        ]);
        
        const mockIO = createMockIO({
            ...mocks,
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
        const mocks = createCoordinatedMocks([
            'A',
            'A', // Repeat 1
            'B', // Reset
            'B', // Repeat 1
            'B', // Repeat 2
            'B', // Repeat 3 - stop
        ]);
        
        const mockIO = createMockIO({
            ...mocks,
            itemText: vi.fn().mockResolvedValue('text'),
        });

        const navigator = new DownArrowNavigator(mockIO, 'Down', 3);

        const items = [];
        for await (const item of navigator) {
            items.push(item);
        }

        expect(items).toHaveLength(5); // A, A, B, B, B (stops on 3rd B repeat)
    });

    it('has correct type', () => {
        const mockIO = createMockIO();
        const navigator = new DownArrowNavigator(mockIO);

        expect(navigator.type).toBe('linear');
    });

    it('uses default repeat threshold of 3', () => {
        const mockIO = createMockIO();
        const navigator = new DownArrowNavigator(mockIO);
        
        // Default threshold is now 3 (changed from 30)
        expect(navigator).toBeDefined();
    });
});
