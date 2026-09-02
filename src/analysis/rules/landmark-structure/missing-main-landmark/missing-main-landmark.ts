import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { ScreenReaderContext, ScreenReaderViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { createScreenReaderContext } from '../../../utils/tool-details';
import { collectLandmarks, type LandmarkInfo } from '../../utils/landmark-utils';
import type { ScreenReaderName } from '../../../../screen-reader/drivers/types';

export interface MissingMainLandmarkStats {
    totalLandmarks: number;
    violationsFound: number;
}

export class MissingMainLandmarkRule implements Rule<ScreenReaderContext, MissingMainLandmarkStats> {
    readonly id = 'missing-main-landmark';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '1.3.1', level: 'A' },
        },
        impact: 'serious',
        summary: 'Page has no main landmark',
    };

    async run(ctx: AuditContext): Promise<RuleResult<ScreenReaderContext, MissingMainLandmarkStats>> {
        const { transcript } = ctx;
        const violations: ScreenReaderViolation[] = [];

        const landmarks = collectLandmarks(transcript);

        const hasMain = landmarks.some((l) => l.role === 'main');
        if (!hasMain && landmarks.length > 0) {
            violations.push(this.createViolation(landmarks[0]!, ctx.screenReader));
        }

        return {
            violations,
            stats: {
                totalLandmarks: landmarks.length,
                violationsFound: violations.length,
            },
        };
    }

    private createViolation(firstLandmark: LandmarkInfo, screenReader: ScreenReaderName): ScreenReaderViolation {
        const context = this.createContext(firstLandmark, screenReader);
        return {
            id: `missing-main-${firstLandmark.identifier}`,
            rule: {
                id: this.id,
                summary: this.meta.summary,
                wcag: this.meta.wcag,
                impact: this.meta.impact,
            },
            message: `Page is missing a "main" landmark. Screen reader users rely on landmarks to navigate directly to main content.`,
            tool: 'screen-reader-audit',
            timestamp: firstLandmark.timestamp,
            context,
        };
    }

    private createContext(landmark: LandmarkInfo, screenReader: ScreenReaderName): ScreenReaderContext {
        return createScreenReaderContext(
            {
                identifier: landmark.identifier,
                spokenPhrases: landmark.spokenPhrases,
                itemText: landmark.itemText,
                axNode: landmark.axNode,
            },
            'landmark',
            landmark.stepIndex,
            screenReader
        );
    }
}

export const rule = new MissingMainLandmarkRule();
