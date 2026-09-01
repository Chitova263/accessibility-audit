import { describe, it, expect, vi } from 'vitest';
import { ElementNavigator } from './element-navigator';
import type { ScreenReader } from '../../drivers/nvda';
import type { EndDetector } from '../types';
import { createEndDetector } from '../end-detector';

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

/** Helper to create a simple phrase-match end detector for tests */
function createPhraseContainsDetector(text: string): EndDetector {
    return createEndDetector({ type: 'phrase-contains', text });
}

describe('ElementNavigator', () => {
    it('yields items until end condition is met', async () => {
        const mockIO = createMockIO({
            lastSpokenPhrase: vi
                .fn()
                .mockResolvedValueOnce('Heading 1')
                .mockResolvedValueOnce('Heading 2')
                .mockResolvedValueOnce('Heading 3')
                .mockResolvedValueOnce('no next heading'),
            itemText: vi
                .fn()
                .mockResolvedValueOnce('First')
                .mockResolvedValueOnce('Second')
                .mockResolvedValueOnce('Third'),
        });

        const navigator = new ElementNavigator(
            mockIO,
            {
                advanceKey: 'h',
                endDetector: createPhraseContainsDetector('no next heading'),
            },
            'heading'
        );

        const items = [];
        for await (const item of navigator) {
            items.push(item);
        }

        expect(items).toHaveLength(3);
        expect(items[0]).toEqual({ phrase: 'Heading 1', itemText: 'First' });
        expect(items[1]).toEqual({ phrase: 'Heading 2', itemText: 'Second' });
        expect(items[2]).toEqual({ phrase: 'Heading 3', itemText: 'Third' });
    });

    it('presses the correct key for each advance', async () => {
        const mockIO = createMockIO({
            lastSpokenPhrase: vi.fn().mockResolvedValueOnce('Link 1').mockResolvedValueOnce('no next link'),
            itemText: vi.fn().mockResolvedValue('link text'),
        });

        const navigator = new ElementNavigator(
            mockIO,
            {
                advanceKey: 'k',
                endDetector: createPhraseContainsDetector('no next link'),
            },
            'link'
        );

        const items = [];
        for await (const item of navigator) {
            items.push(item);
        }

        expect(mockIO.press).toHaveBeenCalledTimes(2);
        expect(mockIO.press).toHaveBeenNthCalledWith(1, 'k');
        expect(mockIO.press).toHaveBeenNthCalledWith(2, 'k');
    });

    it('yields nothing when end condition is met immediately', async () => {
        const mockIO = createMockIO({
            lastSpokenPhrase: vi.fn().mockResolvedValue('no next landmark'),
            itemText: vi.fn().mockResolvedValue(''),
        });

        const navigator = new ElementNavigator(
            mockIO,
            {
                advanceKey: 'd',
                endDetector: createPhraseContainsDetector('no next landmark'),
            },
            'landmark'
        );

        const items = [];
        for await (const item of navigator) {
            items.push(item);
        }

        expect(items).toHaveLength(0);
        expect(mockIO.press).toHaveBeenCalledTimes(1);
    });

    it('exposes the correct type', () => {
        const mockIO = createMockIO();
        const alwaysEndDetector: EndDetector = { check: () => true, reset: () => {} };

        const navigator = new ElementNavigator(mockIO, { advanceKey: 'b', endDetector: alwaysEndDetector }, 'button');

        expect(navigator.type).toBe('button');
    });

    it('handles heading level navigation', async () => {
        const mockIO = createMockIO({
            lastSpokenPhrase: vi
                .fn()
                .mockResolvedValueOnce('heading level 2 Section A')
                .mockResolvedValueOnce('heading level 2 Section B')
                .mockResolvedValueOnce('no next'),
            itemText: vi.fn().mockResolvedValueOnce('Section A').mockResolvedValueOnce('Section B'),
        });

        const navigator = new ElementNavigator(
            mockIO,
            {
                advanceKey: '2',
                endDetector: createPhraseContainsDetector('no next'),
            },
            'heading2'
        );

        const items = [];
        for await (const item of navigator) {
            items.push(item);
        }

        expect(items).toHaveLength(2);
        expect(mockIO.press).toHaveBeenCalledWith('2');
    });

    it('resets detector state at start of iteration', async () => {
        const mockIO = createMockIO({
            lastSpokenPhrase: vi
                .fn()
                .mockResolvedValueOnce('Item A')
                .mockResolvedValueOnce('Item B')
                .mockResolvedValueOnce('Item A'), // Loop back - should trigger loop detection
            itemText: vi.fn().mockResolvedValue(''),
        });

        const navigator = new ElementNavigator(
            mockIO,
            {
                advanceKey: 'x',
                endDetector: createEndDetector({ type: 'loop-detection' }),
            },
            'heading'
        );

        const items = [];
        for await (const item of navigator) {
            items.push(item);
        }

        // Should stop when we see 'Item A' again
        expect(items).toHaveLength(2);
        expect(items[0]?.phrase).toBe('Item A');
        expect(items[1]?.phrase).toBe('Item B');
    });
});
