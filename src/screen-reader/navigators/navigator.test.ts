import { describe, it, expect, vi } from 'vitest';
import { Navigator } from './navigator';
import type { ScreenReader, KeyPressResult } from '../drivers/nvda';
import type { ScreenReaderKeyBindings, ScreenReaderEndDetection } from './types';

function createMockScreenReader(): ScreenReader {
    return {
        name: 'nvda',
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        press: vi.fn().mockResolvedValue({
            spokenPhrases: ['no next heading'],
            focusedElementText: '',
        } satisfies KeyPressResult),
    };
}

const testKeyBindings: ScreenReaderKeyBindings = {
    nextHeading: 'h',
    nextHeadingLevel: (level) => String(level),
    nextLink: 'k',
    nextLandmark: 'd',
    nextButton: 'b',
    tab: 'Tab',
    arrowDown: 'Down',
    documentStart: 'Control+Home',
};

const testEndDetection: ScreenReaderEndDetection = {
    heading: { type: 'phrase-contains', text: 'no next heading' },
    headingLevel: { type: 'phrase-contains', text: 'no next' },
    link: { type: 'phrase-contains', text: 'no next link' },
    landmark: { type: 'phrase-contains', text: 'no next landmark' },
    button: { type: 'phrase-contains', text: 'no next button' },
};

describe('Navigator', () => {
    describe('navigateToDocumentStart', () => {
        it('presses the document start key', async () => {
            const mockSR = createMockScreenReader();
            const nav = new Navigator(mockSR, testKeyBindings, testEndDetection);

            await nav.navigateToDocumentStart();

            expect(mockSR.press).toHaveBeenCalledWith('Control+Home');
        });
    });

    describe('integration with key bindings', () => {
        it('heading navigator uses correct key from bindings', async () => {
            const mockSR = createMockScreenReader();
            const nav = new Navigator(mockSR, testKeyBindings, testEndDetection);

            const navigator = nav.headings();
            for await (const _item of navigator) {
                // consume iterator
            }

            expect(mockSR.press).toHaveBeenCalledWith('h');
        });

        it('heading level navigator uses level-specific key', async () => {
            const mockSR = createMockScreenReader();
            mockSR.press = vi.fn().mockResolvedValue({
                spokenPhrases: ['no next'],
                focusedElementText: '',
            });
            const nav = new Navigator(mockSR, testKeyBindings, testEndDetection);

            const navigator = nav.headingsLevel(4);
            for await (const _item of navigator) {
                // consume iterator
            }

            expect(mockSR.press).toHaveBeenCalledWith('4');
        });
    });
});
