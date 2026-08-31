import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { NvdaContext, NvdaViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { createNvdaContext } from '../../../utils/tool-details';
import { captureScreenshotToFile } from '../../../utils/screenshot-capture';
import { collectLandmarks, type LandmarkInfo } from '../../utils/landmark-utils';

export interface DuplicateLandmarkStats {
    totalLandmarks: number;
    violationsFound: number;
    byRole: Record<string, number>;
}

export class DuplicateLandmarkRule implements Rule<NvdaContext, DuplicateLandmarkStats> {
    readonly id = 'duplicate-landmark';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '1.3.1', level: 'A' },
        },
        impact: 'moderate',
        summary: 'Multiple landmarks of same type without unique names',
    };

    async run(ctx: AuditContext): Promise<RuleResult<NvdaContext, DuplicateLandmarkStats>> {
        const { transcript, page, cdp, screenshotsDir } = ctx;
        const violations: NvdaViolation[] = [];
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

                const context = this.createContext(landmark);
                if (typeof landmark.backendNodeId === 'number') {
                    const filename = `${this.id}-${landmark.identifier}`;
                    context.screenshot = await captureScreenshotToFile(
                        page,
                        cdp,
                        landmark.backendNodeId,
                        screenshotsDir,
                        filename
                    );
                }

                violations.push(this.createViolation(landmark, group.length, context));
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

    private createViolation(landmark: LandmarkInfo, totalCount: number, context: NvdaContext): NvdaViolation {
        const hasName = landmark.name.trim() !== '';
        const message = hasName
            ? `Multiple "${landmark.role}" landmarks with same name "${landmark.name}" (${totalCount} total). Each landmark of the same type should have a unique accessible name.`
            : `Multiple "${landmark.role}" landmarks without unique names (${totalCount} total). When multiple landmarks of the same type exist, each should have a unique accessible name.`;

        return {
            id: `duplicate-landmark-${landmark.identifier}`,
            rule: {
                id: this.id,
                summary: this.meta.summary,
                wcag: this.meta.wcag,
                impact: this.meta.impact,
            },
            message,
            ...(landmark.htmlSnippet != null && { element: { htmlSnippet: landmark.htmlSnippet } }),
            tool: 'nvda-audit',
            timestamp: landmark.timestamp,
            context,
        };
    }

    private createContext(landmark: LandmarkInfo): NvdaContext {
        return createNvdaContext(
            {
                identifier: landmark.identifier,
                spokenPhrases: landmark.spokenPhrases,
                itemText: landmark.itemText,
                axNode: landmark.axNode,
            },
            'landmark',
            landmark.stepIndex
        );
    }
}

function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
    const result: Record<string, T[]> = {};
    for (const item of arr) {
        const key = keyFn(item);
        if (!result[key]) result[key] = [];
        result[key]!.push(item);
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
