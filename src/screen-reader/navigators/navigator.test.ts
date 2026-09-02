import { describe, it, expect, vi } from 'vitest';
import { Navigator } from './navigator';
import { ElementNavigator } from './element-navigator/element-navigator';
import { TabNavigator } from './tab-navigator/tab-navigator';
import { DownArrowNavigator } from './down-arrow-navigator/down-arrow-navigator';
import type { ScreenReader, PressResult } from '../drivers/nvda';
import type { ScreenReaderKeyBindings, ScreenReaderEndDetection } from './types';

function createMockScreenReader(): ScreenReader {
    return {
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        press: vi.fn().mockResolvedValue({
            spokenPhrases: ['no next heading'],
            itemText: '',
        } satisfies PressResult),
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
    describe('factory methods', () => {
        it('creates heading navigator with correct config', () => {
            const mockSR = createMockScreenReader();
            const nav = new Navigator(mockSR, testKeyBindings, testEndDetection);

            const navigator = nav.headings();

            expect(navigator).toBeInstanceOf(ElementNavigator);
            expect(navigator.type).toBe('heading');
        });

        it('creates heading level Navigator with correct types', () => {
            const mockSR = createMockScreenReader();
            const nav = new Navigator(mockSR, testKeyBindings, testEndDetection);

            expect(nav.headingsLevel1().type).toBe('heading1');
            expect(nav.headingsLevel2().type).toBe('heading2');
            expect(nav.headingsLevel3().type).toBe('heading3');
            expect(nav.headingsLevel4().type).toBe('heading4');
            expect(nav.headingsLevel5().type).toBe('heading5');
            expect(nav.headingsLevel6().type).toBe('heading6');
        });

        it('creates headingsLevel navigator with specified level', () => {
            const mockSR = createMockScreenReader();
            const nav = new Navigator(mockSR, testKeyBindings, testEndDetection);

            const navigator = nav.headingsLevel(3);

            expect(navigator).toBeInstanceOf(ElementNavigator);
            expect(navigator.type).toBe('heading3');
        });

        it('creates link navigator', () => {
            const mockSR = createMockScreenReader();
            const nav = new Navigator(mockSR, testKeyBindings, testEndDetection);

            const navigator = nav.links();

            expect(navigator).toBeInstanceOf(ElementNavigator);
            expect(navigator.type).toBe('link');
        });

        it('creates landmark navigator', () => {
            const mockSR = createMockScreenReader();
            const nav = new Navigator(mockSR, testKeyBindings, testEndDetection);

            const navigator = nav.landmarks();

            expect(navigator).toBeInstanceOf(ElementNavigator);
            expect(navigator.type).toBe('landmark');
        });

        it('creates button navigator', () => {
            const mockSR = createMockScreenReader();
            const nav = new Navigator(mockSR, testKeyBindings, testEndDetection);

            const navigator = nav.buttons();

            expect(navigator).toBeInstanceOf(ElementNavigator);
            expect(navigator.type).toBe('button');
        });

        it('creates focusable elements navigator (TabNavigator)', () => {
            const mockSR = createMockScreenReader();
            const nav = new Navigator(mockSR, testKeyBindings, testEndDetection);

            const navigator = nav.focusableElements();

            expect(navigator).toBeInstanceOf(TabNavigator);
            expect(navigator.type).toBe('focusable');
        });

        it('creates linear elements navigator (ArrowNavigator)', () => {
            const mockSR = createMockScreenReader();
            const nav = new Navigator(mockSR, testKeyBindings, testEndDetection);

            const navigator = nav.linearElements();

            expect(navigator).toBeInstanceOf(DownArrowNavigator);
            expect(navigator.type).toBe('linear');
        });
    });

    describe('navigateToDocumentStart', () => {
        it('presses the document start key', async () => {
            const mockSR = createMockScreenReader();
            const nav = new Navigator(mockSR, testKeyBindings, testEndDetection);

            await nav.navigateToDocumentStart();

            expect(mockSR.press).toHaveBeenCalledWith('Control+Home');
        });
    });

    describe('fromConfig', () => {
        it('creates Navigator from config object', () => {
            const mockSR = createMockScreenReader();
            const config = {
                reader: mockSR,
                keyBindings: testKeyBindings,
                endDetection: testEndDetection,
            };

            const navigator = Navigator.fromConfig(config);

            expect(navigator.headings()).toBeInstanceOf(ElementNavigator);
            expect(navigator.focusableElements()).toBeInstanceOf(TabNavigator);
        });
    });

    describe('integration with key bindings', () => {
        it('heading navigator uses correct key from bindings', async () => {
            const mockSR = createMockScreenReader();
            const nav = new Navigator(mockSR, testKeyBindings, testEndDetection);

            const navigator = nav.headings();
            for await (const _ of navigator) {
            }

            expect(mockSR.press).toHaveBeenCalledWith('h');
        });

        it('heading level navigator uses level-specific key', async () => {
            const mockSR = createMockScreenReader();
            mockSR.press = vi.fn().mockResolvedValue({
                spokenPhrases: ['no next'],
                itemText: '',
            });
            const nav = new Navigator(mockSR, testKeyBindings, testEndDetection);

            const navigator = nav.headingsLevel(4);
            for await (const _ of navigator) {
            }

            expect(mockSR.press).toHaveBeenCalledWith('4');
        });
    });
});
