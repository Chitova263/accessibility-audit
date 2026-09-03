import type { ScreenReaderType } from '../screen-reader-type';
import type { ScreenReaderProfile } from '../types';

import { nvdaProfile } from './nvda';
import { voiceOverProfile } from './voiceover';
import { virtualProfile } from './virtual';

const PROFILES: Record<ScreenReaderType, ScreenReaderProfile> = {
    nvda: nvdaProfile,
    voiceover: voiceOverProfile,
    virtual: virtualProfile,
};

export function getProfile(type: ScreenReaderType): ScreenReaderProfile {
    return PROFILES[type];
}
