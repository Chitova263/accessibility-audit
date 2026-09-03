import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { ScreenReaderContext, ScreenReaderViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { buildViolation } from '../../rule-catalog';
import { createScreenReaderContext } from '../../../utils/tool-details';
import { collectLandmarks } from '../../utils/landmark-utils';

export interface DuplicateLandmarkStats {
    totalLandmarks: number;
    violationsFound: number;
    byRole: Record<string, number>;
}

export class DuplicateLandmarkRule implements Rule<ScreenReaderContext, DuplicateLandmarkStats> {
    readonly id = 'duplicate-landmark';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '1.3.1', level: 'A' },
        },
        summary: 'Multiple landmarks of same type without unique names',
    };

    async run(ctx: AuditContext): Promise<RuleResult<ScreenReaderContext, DuplicateLandmarkStats>> {
        const { transcript } = ctx;
        const violations: ScreenReaderViolation[] = [];
        const byRole: Record<string, number> = {};

        const landmarks = collectLandmarks(transcript);
        const landmarkGroups = groupBy(landmarks, (l) => l.role);

        for (const [role, group] of Object.entries(landmarkGroups)) {
            if (group.length <= 1) continue;

            const names = group.map((l) => l.name.trim().toLowerCase());
            const duplicateNames = findDuplicates(names);

            if (duplicateNames.length === 0) continue;

            for (const landmark of group) {
                const normalizedName = landmark.name.trim().toLowerCase();
                if (!duplicateNames.includes(normalizedName) && normalizedName !== '') continue;

                byRole[role] = (byRole[role] ?? 0) + 1;

                const context = createScreenReaderContext(
                    {
                        identifier: landmark.identifier,
                        spokenPhrases: landmark.spokenPhrases,
                        focusedElementText: landmark.focusedElementText,
                        axNode: landmark.axNode,
                    },
                    'landmark',
                    landmark.stepIndex,
                    ctx.screenReader
                );

                const hasName = landmark.name.trim() !== '';
                const message = hasName
                    ? `Multiple "${landmark.role}" landmarks with same name "${landmark.name}" (${group.length} total). Each landmark of the same type should have a unique accessible name.`
                    : `Multiple "${landmark.role}" landmarks without unique names (${group.length} total). When multiple landmarks of the same type exist, each should have a unique accessible name.`;

                violations.push(
                    buildViolation({
                        ruleId: 'duplicate-landmark',
                        impact: 'moderate',
                        stepId: `duplicate-landmark-${landmark.identifier}`,
                        message,
                        timestamp: landmark.timestamp,
                        context,
                        htmlSnippet: landmark.htmlSnippet,
                        screenReader: ctx.screenReader,
                    })
                );
            }
        }

        return {
            violations,
            stats: {
                totalLandmarks: landmarks.length,
                violationsFound: violations.length,
                byRole,
            },
        };
    }
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

function findDuplicates(arr: string[]): string[] {
    const counts = new Map<string, number>();
    for (const item of arr) {
        counts.set(item, (counts.get(item) ?? 0) + 1);
    }
    return [...counts.entries()].filter(([, count]) => count > 1).map(([item]) => item);
}

export const rule = new DuplicateLandmarkRule();
