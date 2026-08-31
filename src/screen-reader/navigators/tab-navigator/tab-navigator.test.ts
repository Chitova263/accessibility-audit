import { describe, it, expect, vi } from 'vitest';
import { TabNavigator } from './tab-navigator';
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

describe('TabNavigator', () => {
    it('yields items until cycle is detected (same phrase as first)', async () => {
        const mockIO = createMockIO({
            lastSpokenPhrase: vi
                .fn()
                .mockResolvedValueOnce('Skip to main content link')
                .mockResolvedValueOnce('Search button')
                .mockResolvedValueOnce('Login link')
                .mockResolvedValueOnce('Skip to main content link'), // Cycle back
            itemText: vi
                .fn()
                .mockResolvedValueOnce('Skip to main content')
                .mockResolvedValueOnce('Search')
                .mockResolvedValueOnce('Login'),
        });

        const navigator = new TabNavigator(mockIO);

        const items = [];
        for await (const item of navigator) {
            items.push(item);
        }

        expect(items).toHaveLength(3);
        expect(items[0]?.phrase).toBe('Skip to main content link');
        expect(items[1]?.phrase).toBe('Search button');
        expect(items[2]?.phrase).toBe('Login link');
    });

    it('presses Tab key for each advance', async () => {
        const mockIO = createMockIO({
            lastSpokenPhrase: vi.fn().mockResolvedValueOnce('Button 1').mockResolvedValueOnce('Button 1'), // Immediate cycle
            itemText: vi.fn().mockResolvedValue('Button'),
        });

        const navigator = new TabNavigator(mockIO);

        const items = [];
        for await (const item of navigator) {
            items.push(item);
        }

        expect(mockIO.press).toHaveBeenCalledWith('Tab');
        expect(mockIO.press).toHaveBeenCalledTimes(2);
    });

    it('uses custom tab key when provided', async () => {
        const mockIO = createMockIO({
            lastSpokenPhrase: vi.fn().mockResolvedValueOnce('Element 1').mockResolvedValueOnce('Element 1'),
            itemText: vi.fn().mockResolvedValue('Element'),
        });

        const navigator = new TabNavigator(mockIO, 'Shift+Tab');

        const items = [];
        for await (const item of navigator) {
            items.push(item);
        }

        expect(mockIO.press).toHaveBeenCalledWith('Shift+Tab');
    });

    it('yields single item when page has only one focusable element', async () => {
        const mockIO = createMockIO({
            lastSpokenPhrase: vi.fn().mockResolvedValueOnce('Only button').mockResolvedValueOnce('Only button'),
            itemText: vi.fn().mockResolvedValueOnce('Only').mockResolvedValueOnce('Only'),
        });

        const navigator = new TabNavigator(mockIO);

        const items = [];
        for await (const item of navigator) {
            items.push(item);
        }

        expect(items).toHaveLength(1);
        expect(items[0]?.phrase).toBe('Only button');
    });

    it('has correct type', () => {
        const mockIO = createMockIO();
        const navigator = new TabNavigator(mockIO);

        expect(navigator.type).toBe('focusable');
    });

    it('handles many focusable elements before cycling', async () => {
        const phrases = [
            'Element 1',
            'Element 2',
            'Element 3',
            'Element 4',
            'Element 5',
            'Element 1', // Cycle
        ];
        let callIndex = 0;

        const mockIO = createMockIO({
            lastSpokenPhrase: vi.fn().mockImplementation(() => {
                return Promise.resolve(phrases[callIndex++]);
            }),
            itemText: vi.fn().mockImplementation(() => {
                return Promise.resolve(`Item ${callIndex}`);
            }),
        });

        const navigator = new TabNavigator(mockIO);

        const items = [];
        for await (const item of navigator) {
            items.push(item);
        }

        expect(items).toHaveLength(5);
    });
});
