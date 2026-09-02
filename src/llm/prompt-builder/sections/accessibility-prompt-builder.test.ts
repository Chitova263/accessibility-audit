import { describe, it, expect } from 'vitest';
import { createPromptBuilder, AccessibilityPromptBuilder } from './accessibility-prompt-builder';

describe('AccessibilityPromptBuilder', () => {
    describe('screen reader name in prompts', () => {
        it('uses NVDA when screenReader is set to nvda', () => {
            const builder = createPromptBuilder({ screenReader: 'nvda' });
            const prompt = builder.build();

            expect(prompt.system).toContain('A transcript of NVDA screen reader navigation');
            expect(prompt.system).toContain('axe-core and NVDA rules');
        });

        it('uses VoiceOver when screenReader is set to voiceover', () => {
            const builder = createPromptBuilder({ screenReader: 'voiceover' });
            const prompt = builder.build();

            expect(prompt.system).toContain('A transcript of VoiceOver screen reader navigation');
            expect(prompt.system).toContain('axe-core and VoiceOver rules');
            expect(prompt.system).not.toContain('NVDA');
        });

        it('uses Virtual Screen Reader when screenReader is set to virtual', () => {
            const builder = createPromptBuilder({ screenReader: 'virtual' });
            const prompt = builder.build();

            expect(prompt.system).toContain('A transcript of Virtual Screen Reader screen reader navigation');
            expect(prompt.system).toContain('axe-core and Virtual Screen Reader rules');
            expect(prompt.system).not.toContain('NVDA');
        });

        it('withScreenReader method updates the screen reader name', () => {
            const builder = createPromptBuilder({ screenReader: 'nvda' }).withScreenReader('voiceover');
            const prompt = builder.build();

            expect(prompt.system).toContain('A transcript of VoiceOver screen reader navigation');
        });

        it('withScreenReader method overrides config screenReader', () => {
            const builder = createPromptBuilder({ screenReader: 'nvda' }).withScreenReader('virtual');
            const prompt = builder.build();

            expect(prompt.system).toContain('A transcript of Virtual Screen Reader screen reader navigation');
            expect(prompt.system).not.toContain('NVDA');
        });
    });

    describe('prompt output stability for NVDA (regression protection)', () => {
        it('system prompt intro text matches expected format for NVDA', () => {
            const builder = createPromptBuilder({ screenReader: 'nvda' });
            const prompt = builder.build();

            // These exact strings must remain unchanged for NVDA to avoid regressions
            const expectedIntro = `You are an expert accessibility auditor analyzing screen reader navigation transcripts.
Your role is to identify accessibility issues that deterministic rules cannot catch.

You will receive:
1. A transcript of NVDA screen reader navigation through a web page
2. Violations already found by static analyzers (axe-core and NVDA rules)`;

            expect(prompt.system).toContain(expectedIntro);
        });
    });
});
