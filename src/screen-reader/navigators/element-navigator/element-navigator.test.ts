import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowseModeElementNavigator } from './element-navigator';
import type { ScreenReader, KeyPressResult } from '../../drivers/nvda';
import { createEndDetector } from '../end-detector';

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
            return Promise.resolve({ spokenPhrases: ['no next heading'], focusedElementText: '' });
        }
        return Promise.resolve({
            spokenPhrases: [result.phrase],
            focusedElementText: result.focusedElementText ?? '',
        });
    });
}

describe('BrowseModeElementNavigator', () => {
    let mockSR: ScreenReader;

    beforeEach(() => {
        mockSR = createMockScreenReader();
    });

    it('yields spoken items until the end phrase is announced', async () => {
        mockSR.press = createPressMock([
            { phrase: 'heading level 1, Welcome', focusedElementText: 'Welcome' },
            { phrase: 'heading level 2, About', focusedElementText: 'About' },
            { phrase: 'no next heading' },
        ]);

        const navigator = new BrowseModeElementNavigator(
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
        expect(items[0]!.focusedElementText).toBe('Welcome');
        expect(items[1]!.phrase).toBe('heading level 2, About');
        expect(mockSR.press).toHaveBeenCalledWith('h');
    });
});
