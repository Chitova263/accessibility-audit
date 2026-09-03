import type { AuditContext } from '../../core/context';
import type { ScreenReaderContext } from '../../core/violation';
import { createScreenReaderContext } from '../../utils/tool-details';
import type { AXNode } from '../../../types/cdp';
import { getRole, getName, getHeadingLevel } from '../../../types/ax-utils';

export interface HeadingInfo {
    level: number;
    name: string;
    stepIndex: number;
    htmlSnippet: string | null;
    spokenPhrases: string[];
    focusedElementText: string;
    identifier: string;
    timestamp: number;
    axNode: AXNode | undefined;
    backendNodeId?: number | undefined;
}

/**
 * Collects all unique headings from transcript heading-strategy results.
 * Deduplicates by level + name + htmlSnippet so headings appearing in
 * multiple strategies are only counted once.
 */
export function collectHeadings(ctx: AuditContext): HeadingInfo[] {
    const { transcript } = ctx;
    const raw: HeadingInfo[] = [];

    for (const result of transcript) {
        const strategyType = result.meta.name;

        if (!strategyType.startsWith('heading')) continue;

        for (let stepIndex = 0; stepIndex < result.navigationSteps.length; stepIndex++) {
            const step = result.navigationSteps[stepIndex]!;
            const node = step.axNode;

            if (!node || getRole(node) !== 'heading') continue;

            const level = getHeadingLevel(node) ?? 0;
            const name = getName(node) ?? '';

            raw.push({
                level,
                name,
                stepIndex,
                htmlSnippet: step.htmlSnippet,
                spokenPhrases: step.spokenPhrases,
                focusedElementText: step.focusedElementText,
                identifier: step.identifier,
                timestamp: step.timestamp,
                axNode: node,
                backendNodeId: node.backendDOMNodeId,
            });
        }
    }

    return deduplicateHeadings(raw);
}

function deduplicateHeadings(headings: HeadingInfo[]): HeadingInfo[] {
    const seen = new Set<string>();
    const unique: HeadingInfo[] = [];

    for (const h of headings) {
        const key = `${h.level}:${h.name}:${h.htmlSnippet ?? ''}`;
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(h);
        }
    }

    return unique;
}

import type { ScreenReaderName } from '../../../screen-reader/drivers/types';

/** Build a ScreenReaderContext from a HeadingInfo entry. */
export function createHeadingContext(heading: HeadingInfo, screenReader: ScreenReaderName): ScreenReaderContext {
    return createScreenReaderContext(
        {
            identifier: heading.identifier,
            spokenPhrases: heading.spokenPhrases,
            focusedElementText: heading.focusedElementText,
            axNode: heading.axNode,
        },
        'heading',
        heading.stepIndex,
        screenReader
    );
}
