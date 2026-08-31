import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { NvdaContext, NvdaViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { createNvdaContext } from '../../../utils/tool-details';
import { getRule } from '../../rule-catalog';
import type {
    NavigationStep,
    StrategyResult,
} from '../../../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';

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
    return transcript.find((r) => r.meta.type === 'arrow' || r.meta.name === 'ArrowNavigation');
}

function extractLinkText(itemText: string): string | null {
    const lower = itemText.toLowerCase();
    if (!lower.includes('link')) return null;

    // Extract text after "link," pattern
    const match = itemText.match(/link,?\s*(.*)$/i);
    if (match && match[1]) {
        return match[1].trim();
    }
    return null;
}

function isSingleCharLink(itemText: string): { isLink: boolean; char: string | null } {
    const linkText = extractLinkText(itemText);
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

function createViolation(
    message: string,
    step: NavigationStep,
    strategyName: string
): NvdaViolation {
    return {
        id: `fragmented-link-text-${step.identifier}`,
        rule: getRule('fragmented-link-text'),
        message,
        tool: 'nvda-audit',
        timestamp: step.timestamp,
        context: createNvdaContext(step, strategyName, step.index),
    };
}

/**
 * Detects sequences of single-character links that form words or numbers.
 * This typically indicates improper markup where text is fragmented into
 * individual linked characters, making content unusable for screen reader users.
 *
 * Example: "22.15 francs" becoming "link 2, link 2, link dot, link 1, link 5..."
 *
 * WCAG 2.4.4: Link Purpose (In Context) (Level A)
 */
export class FragmentedLinkTextRule implements Rule<NvdaContext, FragmentedLinkTextStats> {
    readonly id = 'fragmented-link-text';
    readonly threshold: number;

    constructor(options: { threshold?: number } = {}) {
        // Minimum consecutive single-char links to trigger
        this.threshold = options.threshold ?? 3;
    }

    readonly meta: RuleMeta = {
        wcag: { primary: { criterion: '2.4.4', level: 'A' } },
        impact: 'critical',
        summary: 'Link text is fragmented into individual characters',
    };

    async run({ transcript }: AuditContext): Promise<RuleResult<NvdaContext, FragmentedLinkTextStats>> {
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
            const { isLink, char } = isSingleCharLink(step.itemText);

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

        const violations: NvdaViolation[] = sequences.map((seq) => {
            const step = steps[seq.startStep]!;
            return createViolation(
                `Link text fragmented into ${seq.characters.length} single-character links at steps ${seq.startStep}-${seq.endStep}. ` +
                    `Reconstructed text: "${seq.reconstructedText}". ` +
                    'Screen reader users hear each character announced as a separate link, making the content unusable.',
                step,
                arrowResult.meta.name
            );
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
