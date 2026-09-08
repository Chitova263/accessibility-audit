import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { ScreenReaderContext, ScreenReaderViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { buildViolation } from '../../rule-catalog';
import { createScreenReaderContext } from '../../../utils/tool-details';

interface ExcessiveTabStopContentStats {
    tabStepsChecked: number;
    violationsFound: number;
    maxSpokenLength: number;
    maxHeadingsInStep: number;
    maxButtonsInStep: number;
}

/** Thresholds for detecting excessive content in a single tab stop */
const THRESHOLDS = {
    /** Maximum characters before flagging */
    maxSpokenLength: 500,
    /** Maximum headings in a single tab stop */
    maxHeadings: 2,
    /** Maximum buttons in a single tab stop */
    maxButtons: 2,
};

/**
 * Detects tab stops that announce excessive content in a single focus event.
 *
 * This happens when a container element is focusable and the screen reader
 * reads its entire subtree as the element's description. Users hear hundreds
 * of words with no way to pause, navigate within, or understand the structure.
 *
 * Common causes:
 * - Carousel/slider containers with tabindex
 * - Card grids wrapped in a focusable element
 * - Custom widgets that don't properly manage focus
 */
class ExcessiveTabStopContentRule implements Rule<ScreenReaderContext, ExcessiveTabStopContentStats> {
    readonly id = 'excessive-tab-stop-content';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '2.4.6', level: 'AA' },
            related: [
                { criterion: '1.3.1', level: 'A' },
                { criterion: '2.1.1', level: 'A' },
            ],
        },
        summary: 'Single tab stop announces excessive content that users cannot navigate within',
    };

    async run(ctx: AuditContext): Promise<RuleResult<ScreenReaderContext, ExcessiveTabStopContentStats>> {
        const { transcript } = ctx;
        const violations: ScreenReaderViolation[] = [];
        let tabStepsChecked = 0;
        let maxSpokenLength = 0;
        let maxHeadingsInStep = 0;
        let maxButtonsInStep = 0;

        for (const result of transcript) {
            if (result.meta.name !== 'tab') continue;

            for (let i = 0; i < result.navigationSteps.length; i++) {
                const step = result.navigationSteps[i];
                if (!step) continue;

                tabStepsChecked++;

                const spoken = step.spokenPhrases.join(' ');
                const spokenLength = spoken.length;

                // Count headings and buttons in the spoken text
                const headingMatches = spoken.match(/heading,?\s*level\s*\d/gi) ?? [];
                const buttonMatches = spoken.match(/\bbutton\b/gi) ?? [];
                const headingCount = headingMatches.length;
                const buttonCount = buttonMatches.length;

                // Track maximums for stats
                maxSpokenLength = Math.max(maxSpokenLength, spokenLength);
                maxHeadingsInStep = Math.max(maxHeadingsInStep, headingCount);
                maxButtonsInStep = Math.max(maxButtonsInStep, buttonCount);

                // Check if any threshold is exceeded
                const exceedsLength = spokenLength > THRESHOLDS.maxSpokenLength;
                const exceedsHeadings = headingCount > THRESHOLDS.maxHeadings;
                const exceedsButtons = buttonCount > THRESHOLDS.maxButtons;

                if (exceedsLength || exceedsHeadings || exceedsButtons) {
                    const reasons: string[] = [];
                    if (exceedsLength) {
                        reasons.push(`${spokenLength} characters (threshold: ${THRESHOLDS.maxSpokenLength})`);
                    }
                    if (exceedsHeadings) {
                        reasons.push(`${headingCount} headings (threshold: ${THRESHOLDS.maxHeadings})`);
                    }
                    if (exceedsButtons) {
                        reasons.push(`${buttonCount} buttons (threshold: ${THRESHOLDS.maxButtons})`);
                    }

                    const context = createScreenReaderContext(step, 'tab', i, ctx.screenReader);

                    // Determine impact based on severity
                    const impact = exceedsLength && spokenLength > 1000 ? 'critical' : 'serious';

                    // Truncate spoken text for message
                    const truncatedSpoken =
                        spoken.length > 200 ? spoken.substring(0, 200) + '... [truncated]' : spoken;

                    violations.push(
                        buildViolation({
                            ruleId: 'excessive-tab-stop-content',
                            impact,
                            stepId: step.identifier,
                            message:
                                `Single tab stop announces excessive content: ${reasons.join(', ')}. ` +
                                `Users cannot navigate within this content or understand its structure. ` +
                                `The container should not be focusable, or focus should move to individual items within it. ` +
                                `Announced: "${truncatedSpoken}"`,
                            timestamp: step.timestamp,
                            context,
                            htmlSnippet: step.htmlSnippet,
                            screenReader: ctx.screenReader,
                        })
                    );
                }
            }
        }

        return {
            violations,
            stats: {
                tabStepsChecked,
                violationsFound: violations.length,
                maxSpokenLength,
                maxHeadingsInStep,
                maxButtonsInStep,
            },
        };
    }
}

export const rule = new ExcessiveTabStopContentRule();
