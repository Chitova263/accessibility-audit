import { describe, it, expect } from 'vitest';
import { createPromptBuilder } from './accessibility-prompt-builder';

describe('AccessibilityPromptBuilder', () => {
    describe('screen reader name in prompts', () => {
        it.each([
            ['nvda', 'NVDA'],
            ['voiceover', 'VoiceOver'],
            ['virtual', 'Virtual Screen Reader'],
        ] as const)('names %s as %s', (screenReader, expected) => {
            const prompt = createPromptBuilder({ screenReader }).build();

            expect(prompt.system).toContain(`A transcript of ${expected} screen reader navigation`);
            expect(prompt.system).toContain(`axe-core and ${expected} rules`);
        });

        it('withScreenReader overrides the screen reader from config', () => {
            const builder = createPromptBuilder({ screenReader: 'nvda' }).withScreenReader('voiceover');
            const prompt = builder.build();

            expect(prompt.system).toContain('A transcript of VoiceOver screen reader navigation');
            expect(prompt.system).not.toContain('NVDA');
        });
    });
});
