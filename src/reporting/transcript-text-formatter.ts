import type { PromptTranscript, PromptStrategySection } from '../llm/prompt-builder/schemas';

/**
 * Format a strategy section into flat text.
 */
function formatStrategySection(section: PromptStrategySection): string {
    const lines: string[] = [];

    lines.push(`${section.strategyName} (${section.totalSteps} steps)`);
    lines.push(section.description);
    lines.push('');

    if (section.totalSteps === 0) {
        lines.push('(none found)');
        lines.push('');
        return lines.join('\n');
    }

    for (const step of section.steps) {
        lines.push(`[${step.index}] [${step.identifier}] ${step.spoken}`);
    }

    lines.push('');
    return lines.join('\n');
}

/**
 * Format the complete transcript into simple flat text.
 */
export function formatTranscriptAsText(transcript: PromptTranscript): string {
    const lines: string[] = [];

    lines.push('SCREEN READER NAVIGATION TRANSCRIPT');
    lines.push(`Strategies: ${transcript.totalStrategies} | Steps: ${transcript.totalSteps}`);
    lines.push('');

    for (const section of transcript.sections) {
        lines.push(formatStrategySection(section));
    }

    return lines.join('\n');
}
