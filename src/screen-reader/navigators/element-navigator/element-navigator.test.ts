import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ElementNavigator } from './element-navigator';
import type { ScreenReader, PressResult } from '../../drivers/nvda';
import { createEndDetector } from '../end-detector';

function createMockScreenReader(): ScreenReader {
    return {
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        press: vi.fn().mockResolvedValue({ spokenPhrases: [], itemText: '' } satisfies PressResult),
    };
}

/**
 * Helper to create a mock press function that returns different results on each call.
 */
function createPressMock(results: Array<{ phrase: string; itemText?: string }>) {
    let callIndex = 0;
    return vi.fn().mockImplementation((): Promise<PressResult> => {
        const result = results[callIndex++];
        if (!result) {
            return Promise.resolve({ spokenPhrases: ['no next heading'], itemText: '' });
        }
        return Promise.resolve({
            spokenPhrases: [result.phrase],
            itemText: result.itemText ?? '',
        });
    });
}

describe('ElementNavigator', () => {
    let mockSR: ScreenReader;

    beforeEach(() => {
        mockSR = createMockScreenReader();
    });

    it('yields items when pressing key produces speech', async () => {
        mockSR.press = createPressMock([
            { phrase: 'heading level 1, Welcome', itemText: 'Welcome' },
            { phrase: 'heading level 2, About', itemText: 'About' },
            { phrase: 'no next heading' },
        ]);

        const navigator = new ElementNavigator(
            mockSR,
            {
                advanceKey: 'h',
                endDetector: createEndDetector({ type: 'phrase-contains', text: 'no next heading' }),
            },
            'heading'
        );

        const items = [];
        for await (const item of navigator) {
            items.push(item);
        }

        expect(items).toHaveLength(2);
        expect(items[0]!.phrase).toBe('heading level 1, Welcome');
        expect(items[1]!.phrase).toBe('heading level 2, About');
    });

    it('stops when end phrase is detected', async () => {
        mockSR.press = createPressMock([{ phrase: 'link, Home' }, { phrase: 'no next link' }]);

        const navigator = new ElementNavigator(
            mockSR,
            {
                advanceKey: 'k',
                endDetector: createEndDetector({ type: 'phrase-contains', text: 'no next link' }),
            },
            'link'
        );

        const items = [];
        for await (const item of navigator) {
            items.push(item);
        }

        expect(items).toHaveLength(1);
        expect(items[0]!.phrase).toBe('link, Home');
    });

    it('has correct type property', () => {
        const navigator = new ElementNavigator(
            mockSR,
            {
                advanceKey: 'd',
                endDetector: createEndDetector({ type: 'phrase-contains', text: 'no next landmark' }),
            },
            'landmark'
        );
        expect(navigator.type).toBe('landmark');
    });

    it('presses the correct key', async () => {
        mockSR.press = createPressMock([{ phrase: 'no next button' }]);

        const navigator = new ElementNavigator(
            mockSR,
            {
                advanceKey: 'b',
                endDetector: createEndDetector({ type: 'phrase-contains', text: 'no next button' }),
            },
            'button'
        );

        for await (const _ of navigator) {
            // consume
        }

        expect(mockSR.press).toHaveBeenCalledWith('b');
    });

    it('returns itemText from PressResult', async () => {
        mockSR.press = createPressMock([
            { phrase: 'heading level 1, Welcome', itemText: 'Welcome' },
            { phrase: 'no next heading' },
        ]);

        const navigator = new ElementNavigator(
            mockSR,
            {
                advanceKey: 'h',
                endDetector: createEndDetector({ type: 'phrase-contains', text: 'no next heading' }),
            },
            'heading'
        );

        const items = [];
        for await (const item of navigator) {
            items.push(item);
        }

        expect(items[0]!.itemText).toBe('Welcome');
    });
});
