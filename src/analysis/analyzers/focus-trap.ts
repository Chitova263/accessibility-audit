/**
 * Analyzer: Focus Trap
 *
 * Detects keyboard focus traps where users cannot escape
 * using standard keyboard navigation.
 *
 * Maps to WCAG 2.1.2 (No Keyboard Trap).
 */

import type { StrategyResult } from '../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';
import type { NvdaViolation, NvdaToolDetails } from '../violation';
import type { TranscriptContext } from '../context';
import { createToolDetails } from '../tool-details';
import { ruleMetadata } from '../rule-catalog';

export interface FocusTrapAnalyzerResult {
    violations: NvdaViolation[];
    summary: {
        tabStrategiesChecked: number;
        focusTrapsFound: number;
    };
}

export function analyzeFocusTraps({ strategyResults }: TranscriptContext): FocusTrapAnalyzerResult {
    const violations: NvdaViolation[] = [];
    let tabStrategiesChecked = 0;

    for (const result of strategyResults) {
        const strategyType = result.meta.type ?? result.meta.name;

        if (strategyType !== 'tab') continue;

        tabStrategiesChecked++;

        if (result.completionReason.kind === 'trapped') {
            // Find the element that caused the trap (last few steps)
            const steps = result.navigationSteps;
            const trappedStep = steps[steps.length - 1];

            if (trappedStep) {
                violations.push(createFocusTrapViolation(trappedStep, steps.length));
            }
        }
    }

    return {
        violations,
        summary: {
            tabStrategiesChecked,
            focusTrapsFound: violations.length,
        },
    };
}

function createFocusTrapViolation(
    step: {
        identifier: string;
        spokenPhrases: string[];
        itemText: string;
        timestamp: number;
        htmlSnippet: string | null;
        axNode: unknown;
    },
    stepsBeforeTrap: number
): NvdaViolation {
    const toolDetails = createToolDetails(step, 'tab', stepsBeforeTrap - 1);

    return {
        id: `focus-trap-${step.identifier}`,
        ...ruleMetadata('focus-trap'),
        message: `Keyboard focus trap detected after ${stepsBeforeTrap} tab presses. Users cannot navigate away from this element using the keyboard. Element text: "${step.itemText}"`,
        element: {
            htmlSnippet: step.htmlSnippet ?? undefined,
        },
        tool: 'nvda-audit',
        timestamp: step.timestamp,
        toolDetails,
    };
}
