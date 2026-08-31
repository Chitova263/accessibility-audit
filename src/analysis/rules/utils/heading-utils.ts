import type { AuditContext } from '../../core/context';
import type { NvdaContext } from '../../core/violation';
import { createNvdaContext } from '../../utils/tool-details';

export interface HeadingInfo {
    level: number;
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

/**
 * Collects all unique headings from transcript heading-strategy results.
 * Deduplicates by level + name + htmlSnippet so headings appearing in
 * multiple strategies are only counted once.
 */
export function collectHeadings(ctx: AuditContext): HeadingInfo[] {
    const { transcript } = ctx;
    const raw: HeadingInfo[] = [];

    for (const result of transcript) {
        const strategyType = result.meta.type ?? result.meta.name;

        if (!strategyType.startsWith('heading')) continue;

        for (let stepIndex = 0; stepIndex < result.navigationSteps.length; stepIndex++) {
            const step = result.navigationSteps[stepIndex]!;
            const node = step.axNode;

            if (!node || node.role?.value !== 'heading') continue;

            const levelProp = node.properties?.find((p: { name: string }) => p.name === 'level');
            const level: number = levelProp?.value?.value ?? 0;

            raw.push({
                level,
                name: node.name?.value ?? '',
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

/** Build an NvdaContext from a HeadingInfo entry. */
export function createHeadingContext(heading: HeadingInfo): NvdaContext {
    return createNvdaContext(
        {
            identifier: heading.identifier,
            spokenPhrases: heading.spokenPhrases,
            itemText: heading.itemText,
            axNode: heading.axNode,
        },
        'heading',
        heading.stepIndex
    );
}
