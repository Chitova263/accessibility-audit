import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { ScreenReaderContext, ScreenReaderViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { buildViolation } from '../../rule-catalog';
import { createScreenReaderContext } from '../../../utils/tool-details';
import { collectLandmarks } from '../../utils/landmark-utils';

interface MissingMainLandmarkStats {
    totalLandmarks: number;
    violationsFound: number;
}

class MissingMainLandmarkRule implements Rule<ScreenReaderContext, MissingMainLandmarkStats> {
    readonly id = 'missing-main-landmark';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '1.3.1', level: 'A' },
        },
        summary: 'Page has no main landmark',
    };

    async run(ctx: AuditContext): Promise<RuleResult<ScreenReaderContext, MissingMainLandmarkStats>> {
        const { transcript } = ctx;
        const violations: ScreenReaderViolation[] = [];

        const landmarks = collectLandmarks(transcript);

        const hasMain = landmarks.some((l) => l.role === 'main');
        if (!hasMain && landmarks.length > 0) {
            const firstLandmark = landmarks[0]!;
            const context = createScreenReaderContext(
                {
                    identifier: firstLandmark.identifier,
                    spokenPhrases: firstLandmark.spokenPhrases,
                    focusedElementText: firstLandmark.focusedElementText,
                    axNode: firstLandmark.axNode,
                },
                'landmark',
                firstLandmark.stepIndex,
                ctx.screenReader
            );
            violations.push(
                buildViolation({
                    ruleId: 'missing-main-landmark',
                    impact: 'serious',
                    stepId: `missing-main-${firstLandmark.identifier}`,
                    message: `Page is missing a "main" landmark. Screen reader users rely on landmarks to navigate directly to main content.`,
                    timestamp: firstLandmark.timestamp,
                    context,
                    screenReader: ctx.screenReader,
                })
            );
        }

        return {
            violations,
            stats: {
                totalLandmarks: landmarks.length,
                violationsFound: violations.length,
            },
        };
    }
}

export const rule = new MissingMainLandmarkRule();
