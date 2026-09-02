/**
 * Screen reader configuration factory.
 *
 * Provides typed access to key bindings and end detection strategies
 * for any screen reader by name.
 */

import type { ScreenReaderName } from '../../drivers/types';
import type { ScreenReaderKeyBindings, ScreenReaderEndDetection } from '../types';

import { nvdaKeyBindings, nvdaEndDetection } from './nvda';
import { voiceOverKeyBindings, voiceOverEndDetection } from './voiceover';
import { virtualKeyBindings, virtualEndDetection } from './virtual';

const KEY_BINDINGS: Record<ScreenReaderName, ScreenReaderKeyBindings> = {
    nvda: nvdaKeyBindings,
    voiceover: voiceOverKeyBindings,
    virtual: virtualKeyBindings,
};

const END_DETECTION: Record<ScreenReaderName, ScreenReaderEndDetection> = {
    nvda: nvdaEndDetection,
    voiceover: voiceOverEndDetection,
    virtual: virtualEndDetection,
};

/**
 * Get the key bindings for a screen reader.
 */
export function getKeyBindings(screenReader: ScreenReaderName): ScreenReaderKeyBindings {
    return KEY_BINDINGS[screenReader];
}

/**
 * Get the end detection strategies for a screen reader.
 */
export function getEndDetection(screenReader: ScreenReaderName): ScreenReaderEndDetection {
    return END_DETECTION[screenReader];
}
