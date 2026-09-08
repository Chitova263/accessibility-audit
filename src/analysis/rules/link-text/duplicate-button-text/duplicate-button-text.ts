import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { ScreenReaderContext, ScreenReaderViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import type { StrategyResult } from '../../../../screen-reader/strategies/navigation-strategy';
import type { AXNode } from '../../../../types/cdp';
import { buildViolation } from '../../rule-catalog';
import { createScreenReaderContext } from '../../../utils/tool-details';
import { getRole, getName } from '../../../../types/ax-utils';
import type { ScreenReaderType } from '../../../../screen-reader/screen-reader-type';

interface ButtonInfo {
    name: string;
    stepIndex: number;
    htmlSnippet: string | null;
    spokenPhrases: string[];
    focusedElementText: string;
    identifier: string;
    timestamp: number;
    axNode: AXNode | undefined;
    backendNodeId: number | null;
}

interface DuplicateButtonTextStats {
    totalButtons: number;
    violationsFound: number;
    duplicateGroups: number;
}

/**
 * Collects all buttons from the `button` navigation strategy in the transcript.
 */
function collectButtons(transcript: StrategyResult[]): ButtonInfo[] {
    const buttons: ButtonInfo[] = [];

    for (const result of transcript) {
        if (result.meta.name !== 'button') continue;

        for (let stepIndex = 0; stepIndex < result.navigationSteps.length; stepIndex++) {
            const step = result.navigationSteps[stepIndex]!;
            const node = step.axNode;

            if (!node || getRole(node) !== 'button') continue;

            buttons.push({
                name: getName(node) ?? '',
                stepIndex,
                htmlSnippet: step.htmlSnippet,
                spokenPhrases: step.spokenPhrases,
                focusedElementText: step.focusedElementText,
                identifier: step.identifier,
                timestamp: step.timestamp,
                axNode: node,
                backendNodeId: node.backendDOMNodeId ?? null,
            });
        }
    }

    return buttons;
}

function createScreenReaderContextFromButton(button: ButtonInfo, screenReader: ScreenReaderType): ScreenReaderContext {
    return createScreenReaderContext(
        {
            identifier: button.identifier,
            spokenPhrases: button.spokenPhrases,
            focusedElementText: button.focusedElementText,
            axNode: button.axNode,
        },
        'button',
        button.stepIndex,
        screenReader
    );
}

function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
    const result: Record<string, T[]> = {};
    for (const item of arr) {
        const key = keyFn(item);
        if (!result[key]) result[key] = [];
        result[key].push(item);
    }
    return result;
}

/**
 * Detects buttons with identical accessible names that perform different actions.
 * When screen reader users list all buttons on a page, they should be able to
 * distinguish between them. Multiple "Add to cart" buttons are problematic if
 * they add different products.
 *
 * Unlike links, buttons don't have an href to compare, so this rule flags any
 * group of buttons sharing the same name when there are multiple instances.
 * The assumption is that identical button names in different contexts (e.g.,
 * different product cards) should be disambiguated.
 *
 * WCAG 2.4.6: Headings and Labels (Level AA) - Labels describe topic or purpose
 */
class DuplicateButtonTextRule implements Rule<ScreenReaderContext, DuplicateButtonTextStats> {
    readonly id = 'duplicate-button-text';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '2.4.6', level: 'AA' },
        },
        summary: 'Multiple buttons with identical text may confuse users',
    };

    async run(ctx: AuditContext): Promise<RuleResult<ScreenReaderContext, DuplicateButtonTextStats>> {
        const { transcript } = ctx;
        const violations: ScreenReaderViolation[] = [];

        const buttons = collectButtons(transcript);
        const buttonsByName = groupBy(buttons, (b) => b.name.trim().toLowerCase());

        let duplicateGroups = 0;

        for (const [name, group] of Object.entries(buttonsByName)) {
            // Skip empty names (handled by empty-accessible-name rule)
            if (name === '') continue;

            // Skip if only one button with this name
            if (group.length <= 1) continue;

            duplicateGroups++;

            for (const button of group) {
                const context = createScreenReaderContextFromButton(button, ctx.screenReader);
                violations.push(
                    buildViolation({
                        ruleId: 'duplicate-button-text',
                        impact: 'moderate',
                        stepId: `duplicate-button-${button.identifier}`,
                        message:
                            `${group.length} buttons share the text "${button.name}". ` +
                            `When a screen reader user lists all buttons, they cannot distinguish between them. ` +
                            `Consider adding context like "Add Iphone to cart" or using aria-label.`,
                        timestamp: button.timestamp,
                        context,
                        htmlSnippet: button.htmlSnippet,
                        screenReader: ctx.screenReader,
                    })
                );
            }
        }

        return {
            violations,
            stats: {
                totalButtons: buttons.length,
                violationsFound: violations.length,
                duplicateGroups,
            },
        };
    }
}

export const rule = new DuplicateButtonTextRule();
