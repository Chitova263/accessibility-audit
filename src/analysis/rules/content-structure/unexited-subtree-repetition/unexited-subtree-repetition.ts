import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { ScreenReaderContext, ScreenReaderViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { buildViolation } from '../../rule-catalog';
import { createScreenReaderContext } from '../../../utils/tool-details';
import type { NavigationStep, StrategyResult } from '../../../../screen-reader/strategies/navigation-strategy';

export interface SubtreeRepetitionInfo {
    phrase: string;
    count: number;
    startStep: number;
    endStep: number;
    /** Whether the run extended to (or near) the end of the arrow strategy */
    reachedStrategyEnd: boolean;
}

export interface UnexitedSubtreeRepetitionStats {
    detections: SubtreeRepetitionInfo[];
    threshold: number;
}

/**
 * Detects NVDA virtual buffer subtree traversal of unnamed child nodes inside
 * a named interactive element (typically a button).
 *
 * ## Root cause (validated from NVDA source code)
 *
 * NVDA's virtual buffer backend (`gecko_ia2.cpp`) recursively creates a
 * `controlFieldNode` or `textFieldNode` for every descendant DOM element it
 * encounters during `fillVBuf`. Down Arrow in browse mode moves through these
 * nodes one at a time. `getTextInfoSpeech()` in `speech.py` processes a
 * `controlStart` field command for every newly-entered node and calls
 * `getControlFieldSpeech()`, which assembles a speech sequence including the
 * node's role, name, and states.
 *
 * When a button has unnamed child nodes (generic divs, decorative images, SVG
 * paths, gradient stops), each child produces its own virtual buffer entry.
 * Chrome propagates the button's accessible name down through its accessible
 * name computation, so each child node's speech sequence resolves to the same
 * string as the button itself. The result: one announcement per descendant
 * node, all identical.
 *
 * ## Why this is different from `excessive-repetition`
 *
 * `excessive-repetition` counts any run of N identical phrases. It cannot
 * distinguish:
 *   - A product grid with "Add to cart" repeated once per card (expected)
 *   - A chat widget button with 30 identical announcements from SVG gradient
 *     stops traversed by the virtual cursor (structural DOM bug)
 *
 * This rule adds three additional signals that together identify the subtree
 * traversal pattern:
 *   1. The repeated phrase matches the accessible name of a `button`-role node
 *   2. The run extends to (or within `endTolerance` steps of) the end of the
 *      arrow strategy — meaning the page ended inside the button's subtree
 *   3. The run was never interrupted by different content, confirming the
 *      virtual cursor never exited the button
 *
 * ## Correct remediation
 *
 * Add `aria-hidden="true"` to all decorative child containers so NVDA's
 * virtual buffer skips their subtrees entirely. Supply the accessible name
 * directly on the button via `aria-label` so removing the internal text node
 * does not break the name computation.
 *
 * WCAG 4.1.2 Name, Role, Value (Level A)
 */
export class UnexitedSubtreeRepetitionRule implements Rule<ScreenReaderContext, UnexitedSubtreeRepetitionStats> {
    readonly id = 'unexited-subtree-repetition';

    /**
     * Minimum consecutive repetitions before we investigate further.
     * Lower than `excessive-repetition` because the additional signals below
     * reduce false positives significantly.
     */
    readonly threshold: number;

    /**
     * How many steps from the end of the strategy the run is allowed to stop
     * and still be considered "reaching the end". Allows for trailing blank
     * steps or minor content after the button.
     */
    readonly endTolerance: number;

    constructor(options: { threshold?: number; endTolerance?: number } = {}) {
        this.threshold = options.threshold ?? 5;
        this.endTolerance = options.endTolerance ?? 3;
    }

    readonly meta: RuleMeta = {
        wcag: { primary: { criterion: '4.1.2', level: 'A' } },
        summary: 'Button with unnamed child nodes causes repeated NVDA announcements during linear reading',
    };

    async run({
        transcript,
        screenReader,
    }: AuditContext): Promise<RuleResult<ScreenReaderContext, UnexitedSubtreeRepetitionStats>> {
        const arrowResult = transcript.find((r) => r.meta.name === 'arrow');
        if (!arrowResult) {
            return { violations: [], stats: { detections: [], threshold: this.threshold } };
        }

        const detections = this.findDetections(arrowResult);
        const violations = detections.map((d) => this.createViolation(d, arrowResult, screenReader));

        return {
            violations,
            stats: { detections, threshold: this.threshold },
        };
    }

    private findDetections(arrowResult: StrategyResult): SubtreeRepetitionInfo[] {
        const steps = arrowResult.navigationSteps;
        if (steps.length === 0) return [];

        const detections: SubtreeRepetitionInfo[] = [];
        let runPhrase = '';
        let runStart = 0;
        let runCount = 0;

        const flush = (endIndex: number) => {
            if (runCount < this.threshold) return;

            const reachedEnd = endIndex >= steps.length - 1 - this.endTolerance;
            if (!reachedEnd) return;

            // The run must correspond to a button's accessible name.
            // Check the AX node at the run's start step.
            if (!this.isButtonSubtreePhrase(steps, runStart, runPhrase)) return;

            detections.push({
                phrase: runPhrase,
                count: runCount,
                startStep: runStart,
                endStep: endIndex,
                reachedStrategyEnd: endIndex >= steps.length - 1,
            });
        };

        for (let i = 0; i < steps.length; i++) {
            const phrase = steps[i]!.focusedElementText.toLowerCase().trim();

            if (phrase === runPhrase) {
                runCount++;
            } else {
                flush(i - 1);
                runPhrase = phrase;
                runStart = i;
                runCount = 1;
            }
        }
        flush(steps.length - 1);

        return detections;
    }

    /**
     * Returns true when the repeated phrase can be attributed to a button's
     * accessible name being re-announced through subtree traversal.
     *
     * We look backwards from the run start to find the first step where the
     * AX node has role=button AND whose accessible name matches the phrase.
     * That step is the button entry point; everything after it in the run is
     * its subtree.
     */
    private isButtonSubtreePhrase(steps: NavigationStep[], runStart: number, phrase: string): boolean {
        // Search in a window ending at runStart (inclusive), going back far
        // enough to catch the button entry step just before the repetitions.
        const lookback = Math.min(runStart + 1, 10);
        const windowStart = Math.max(0, runStart + 1 - lookback);

        for (let i = windowStart; i <= runStart; i++) {
            const step = steps[i]!;
            const role = this.getRole(step);
            const name = this.getName(step);

            if (role === 'button' && name.toLowerCase().trim() === phrase) {
                return true;
            }
        }
        return false;
    }

    private getRole(step: NavigationStep): string {
        // axNode.role may be a string or an object with a value property
        const node = step.axNode as
            { role?: string | { value?: string }; name?: string | { value?: string } } | undefined;
        if (!node) return '';
        const role = node.role;
        if (typeof role === 'string') return role;
        if (role && typeof role === 'object' && 'value' in role) return String(role.value ?? '');
        return '';
    }

    private getName(step: NavigationStep): string {
        const node = step.axNode as { name?: string | { value?: string } } | undefined;
        if (!node) return step.focusedElementText;
        const name = node.name;
        if (typeof name === 'string') return name;
        if (name && typeof name === 'object' && 'value' in name) return String(name.value ?? '');
        return step.focusedElementText;
    }

    private createViolation(
        detection: SubtreeRepetitionInfo,
        arrowResult: StrategyResult,
        screenReader: AuditContext['screenReader']
    ): ScreenReaderViolation {
        const step = arrowResult.navigationSteps[detection.startStep]!;

        const endDescription = detection.reachedStrategyEnd
            ? 'consuming the remainder of the linear reading transcript'
            : `continuing to step ${detection.endStep}`;

        const message =
            `Button "${detection.phrase}" produces ${detection.count} consecutive identical announcements ` +
            `during linear reading (steps ${detection.startStep}–${detection.endStep}), ` +
            `${endDescription}. ` +
            `This is caused by unnamed child nodes (divs, images, SVG elements) inside the button: ` +
            `NVDA's virtual buffer creates a node for each DOM descendant and announces the button's ` +
            `accessible name each time the virtual cursor enters one. ` +
            `Fix: add aria-hidden="true" to all decorative child containers and set aria-label directly on the button.`;

        return buildViolation({
            ruleId: 'unexited-subtree-repetition',
            impact: 'moderate',
            stepId: `unexited-subtree-repetition-${step.identifier}`,
            message,
            timestamp: step.timestamp,
            context: createScreenReaderContext(step, arrowResult.meta.name, step.index, screenReader),
            htmlSnippet: step.htmlSnippet,
            screenReader,
        });
    }
}

export const rule = new UnexitedSubtreeRepetitionRule();
