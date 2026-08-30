/**
 * Analyzer: Landmark Structure
 *
 * Detects landmark issues:
 * - Duplicate landmarks without unique names
 * - Missing essential landmarks (main)
 *
 * Maps to WCAG 1.3.1 (Info and Relationships).
 */

import type { NvdaViolation, NvdaContext } from '../../core/violation';
import type { AuditContext } from '../../core/context';
import { createNvdaContext } from '../../utils/tool-details';
import { getRule } from '../../registry/rule-catalog';
import { captureScreenshot } from '../../utils/screenshot-capture';

type LandmarkIssue = 'duplicate-landmark' | 'missing-main-landmark';

/** Essential landmarks that should be present on every page */
const ESSENTIAL_LANDMARKS = ['main'] as const;

export interface LandmarkStructureAnalyzerResult {
    violations: NvdaViolation[];
    summary: {
        totalLandmarks: number;
        landmarkRoles: string[];
        violationsFound: number;
        byIssue: Record<LandmarkIssue, number>;
    };
}

interface LandmarkInfo {
    role: string;
    name: string;
    stepIndex: number;
    htmlSnippet: string | null;
    spokenPhrases: string[];
    itemText: string;
    identifier: string;
    timestamp: number;
    axNode: unknown;
    backendNodeId?: number;
}

export async function analyzeLandmarkStructure(ctx: AuditContext): Promise<LandmarkStructureAnalyzerResult> {
    const { transcript, page, cdp } = ctx;
    const violations: NvdaViolation[] = [];
    const byIssue: Record<LandmarkIssue, number> = {
        'duplicate-landmark': 0,
        'missing-main-landmark': 0,
    };

    // Collect all landmarks from landmark strategy
    const landmarks: LandmarkInfo[] = [];

    for (const result of transcript) {
        const strategyType = result.meta.type ?? result.meta.name;

        if (strategyType !== 'landmark') continue;

        for (let stepIndex = 0; stepIndex < result.navigationSteps.length; stepIndex++) {
            const step = result.navigationSteps[stepIndex]!;
            const node = step.axNode;

            if (!node) continue;

            const role = node.role?.value ?? '';
            const name = node.name?.value ?? '';

            landmarks.push({
                role,
                name,
                stepIndex,
                htmlSnippet: step.htmlSnippet,
                spokenPhrases: step.spokenPhrases,
                itemText: step.itemText,
                identifier: step.identifier,
                timestamp: step.timestamp,
                axNode: node,
                backendNodeId: node.backendDOMNodeId,
            });
        }
    }

    const landmarkRoles = landmarks.map((l) => l.role);

    // Check: Missing essential landmarks (no screenshot - absence of element)
    for (const essential of ESSENTIAL_LANDMARKS) {
        const hasLandmark = landmarks.some((l) => l.role === essential);
        if (!hasLandmark && landmarks.length > 0) {
            byIssue['missing-main-landmark']++;
            violations.push(createMissingLandmarkViolation(essential, landmarks[0]!));
        }
    }

    // Check: Duplicate landmarks without unique names (has screenshot)
    const landmarkGroups = groupBy(landmarks, (l) => l.role);

    for (const [role, group] of Object.entries(landmarkGroups)) {
        if (group.length <= 1) continue;

        // Check if all have unique names
        const names = group.map((l) => l.name.trim().toLowerCase());
        const duplicateNames = findDuplicates(names);

        if (duplicateNames.length > 0) {
            // Find landmarks with duplicate/empty names
            for (const landmark of group) {
                const normalizedName = landmark.name.trim().toLowerCase();
                if (duplicateNames.includes(normalizedName) || normalizedName === '') {
                    byIssue['duplicate-landmark']++;
                    const context = createContext(landmark);
                    if (typeof landmark.backendNodeId === 'number') {
                        context.screenshot = (await captureScreenshot(page, cdp, landmark.backendNodeId)) ?? undefined;
                    }
                    violations.push(createDuplicateLandmarkViolation(landmark, group.length, context));
                }
            }
        }
    }

    return {
        violations,
        summary: {
            totalLandmarks: landmarks.length,
            landmarkRoles,
            violationsFound: violations.length,
            byIssue,
        },
    };
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

function createContext(landmark: LandmarkInfo): NvdaContext {
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

function createMissingLandmarkViolation(missingRole: string, firstLandmark: LandmarkInfo): NvdaViolation {
    return {
        id: `missing-${missingRole}-${firstLandmark.identifier}`,
        rule: getRule('missing-main-landmark'),
        message: `Page is missing a "${missingRole}" landmark. Screen reader users rely on landmarks to navigate directly to main content.`,
        tool: 'nvda-audit',
        timestamp: firstLandmark.timestamp,
        context: createContext(firstLandmark),
    };
}

function createDuplicateLandmarkViolation(
    landmark: LandmarkInfo,
    totalCount: number,
    context: NvdaContext
): NvdaViolation {
    const hasName = landmark.name.trim() !== '';
    const message = hasName
        ? `Multiple "${landmark.role}" landmarks with same name "${landmark.name}" (${totalCount} total). Each landmark of the same type should have a unique accessible name.`
        : `Multiple "${landmark.role}" landmarks without unique names (${totalCount} total). When multiple landmarks of the same type exist, each should have a unique accessible name.`;

    return {
        id: `duplicate-landmark-${landmark.identifier}`,
        rule: getRule('duplicate-landmark'),
        message,
        ...(landmark.htmlSnippet != null && { element: { htmlSnippet: landmark.htmlSnippet } }),
        tool: 'nvda-audit',
        timestamp: landmark.timestamp,
        context,
    };
}
