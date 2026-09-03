import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { ScreenReaderContext, ScreenReaderViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { buildViolation } from '../../rule-catalog';
import { createScreenReaderContext } from '../../../utils/tool-details';
import type { StrategyResult } from '../../../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';

export interface FragmentedSequence {
    startStep: number;
    endStep: number;
    characters: string[];
    reconstructedText: string;
}

export interface FragmentedLinkTextStats {
    sequences: FragmentedSequence[];
    totalSequences: number;
    threshold: number;
}

function getArrowStrategyResult(transcript: StrategyResult[]): StrategyResult | undefined {
    return transcript.find((r) => r.meta.name === 'arrow');
}

function extractLinkText(focusedElementText: string): string | null {
    const lower = focusedElementText.toLowerCase();
    if (!lower.includes('link')) return null;

    // Extract text after "link," pattern
    const match = focusedElementText.match(/link,?\s*(.*)$/i);
    if (match && match[1]) {
        return match[1].trim();
    }
    return null;
}

function isSingleCharLink(focusedElementText: string): { isLink: boolean; char: string | null } {
    const linkText = extractLinkText(focusedElementText);
    if (linkText === null) return { isLink: false, char: null };

    // Single character or single digit
    if (linkText.length === 1) {
        return { isLink: true, char: linkText };
    }

    // Short fragments that are part of numbers/words (e.g., "dot", "slash")
    if (linkText.length <= 3 && /^[a-z0-9.,\-\/]$/i.test(linkText)) {
        return { isLink: true, char: linkText };
    }

    return { isLink: true, char: null };
}

/**
 * Detects sequences of single-character links that form words or numbers.
 * This typically indicates improper markup where text is fragmented into
 * individual linked characters, making content unusable for screen reader users.
 *
 * Common causes:
 * 1. Separate <a> tags wrapping individual characters (CSS letter-spacing effects)
 * 2. Web components with shadow DOM containing sr-only text slotted inside a link
 * 3. Nested shadow DOM boundaries causing character-by-character traversal
 *
 * Example: "22.15 francs" becoming "link 2, link 2, link dot, link 1, link 5..."
 *
 * WCAG 2.4.4: Link Purpose (In Context) (Level A)
 */
export class FragmentedLinkTextRule implements Rule<ScreenReaderContext, FragmentedLinkTextStats> {
    readonly id = 'fragmented-link-text';
    readonly threshold: number;

    constructor(options: { threshold?: number } = {}) {
        // Minimum consecutive single-char links to trigger
        this.threshold = options.threshold ?? 3;
    }

    readonly meta: RuleMeta = {
        wcag: { primary: { criterion: '2.4.4', level: 'A' } },
        summary: 'Link text is fragmented into individual characters',
    };

    async run({
        transcript,
        screenReader,
    }: AuditContext): Promise<RuleResult<ScreenReaderContext, FragmentedLinkTextStats>> {
        const { threshold } = this;
        const sequences: FragmentedSequence[] = [];

        const arrowResult = getArrowStrategyResult(transcript);
        if (!arrowResult) {
            return {
                violations: [],
                stats: { sequences: [], totalSequences: 0, threshold },
            };
        }

        const steps = arrowResult.navigationSteps;
        let sequenceStart: number | null = null;
        let currentChars: string[] = [];

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i]!;
            const { isLink, char } = isSingleCharLink(step.focusedElementText);

            if (isLink && char !== null) {
                if (sequenceStart === null) {
                    sequenceStart = i;
                    currentChars = [char];
                } else {
                    currentChars.push(char);
                }
            } else {
                if (sequenceStart !== null && currentChars.length >= threshold) {
                    sequences.push({
                        startStep: sequenceStart,
                        endStep: i - 1,
                        characters: currentChars,
                        reconstructedText: currentChars.join(''),
                    });
                }
                sequenceStart = null;
                currentChars = [];
            }
        }

        // Handle sequence at end
        if (sequenceStart !== null && currentChars.length >= threshold) {
            sequences.push({
                startStep: sequenceStart,
                endStep: steps.length - 1,
                characters: currentChars,
                reconstructedText: currentChars.join(''),
            });
        }

        const violations: ScreenReaderViolation[] = sequences.map((seq) => {
            const step = steps[seq.startStep]!;
            return buildViolation({
                ruleId: 'fragmented-link-text',
                impact: 'critical',
                stepId: `fragmented-link-text-${step.identifier}`,
                message:
                    `Link text fragmented into ${seq.characters.length} single-character links at steps ${seq.startStep}-${seq.endStep}. ` +
                    `Reconstructed text: "${seq.reconstructedText}". ` +
                    `Screen reader users hear each character announced as a separate link, making the content unusable. ` +
                    `This can be caused by: (1) separate <a> tags per character, (2) web components with shadow DOM ` +
                    `containing screen-reader-only text inside a link, or (3) nested shadow DOM boundaries.`,
                timestamp: step.timestamp,
                context: createScreenReaderContext(step, arrowResult.meta.name, step.index, screenReader),
                screenReader,
            });
        });

        return {
            violations,
            stats: {
                sequences,
                totalSequences: sequences.length,
                threshold,
            },
        };
    }
}

export const rule = new FragmentedLinkTextRule();
