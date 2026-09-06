import { parse, HTMLElement } from 'node-html-parser';
import { create } from 'xmlbuilder2';
import type { XMLBuilder } from 'xmlbuilder2/lib/interfaces';
import type { StrategyResult, NavigationStep } from '../../../screen-reader/strategies/navigation-strategy';
import type {
    PromptTranscript,
    PromptStrategySection,
    PromptNavigationStep,
    PromptAxNode,
    TranscriptSectionConfig,
    ResolvedTranscriptConfig,
} from '../schemas';
import { mergeTranscriptConfig } from '../schemas';

function cleanAndTruncateHtml(html: string, maxLength: number): string {
    try {
        const root = parse(html, {
            comment: false,
        });

        root.querySelectorAll('script, style, noscript, svg').forEach((el) => el.remove());

        const removeEventHandlers = (element: HTMLElement) => {
            const attrs = element.attributes;
            for (const attr of Object.keys(attrs)) {
                if (attr.startsWith('on')) {
                    element.removeAttribute(attr);
                }
            }
            for (const child of element.childNodes) {
                if (child instanceof HTMLElement) {
                    removeEventHandlers(child);
                }
            }
        };
        removeEventHandlers(root);

        let cleaned = root.outerHTML.trim();

        // If root is just a text wrapper, get the inner content
        if (root.childNodes.length === 1 && root.firstChild) {
            const firstChild = root.firstChild;
            if (firstChild instanceof HTMLElement) {
                cleaned = firstChild.outerHTML.trim();
            }
        }

        if (cleaned.length <= maxLength) {
            return cleaned;
        }

        // Truncate at the last complete element that fits
        const truncated = cleaned.slice(0, maxLength);
        const lastTagClose = truncated.lastIndexOf('>');

        if (lastTagClose > 0) {
            const partial = truncated.slice(0, lastTagClose + 1);
            try {
                const partialRoot = parse(partial);
                const partialHtml = partialRoot.outerHTML.trim();
                if (partialHtml.length > 0) {
                    return partialHtml + (cleaned.length > maxLength ? '...' : '');
                }
            } catch {
                // Fall through to text fallback
            }
        }

        // Fall back to text content if HTML structure is too complex
        const text = root.textContent.trim();
        if (text.length <= maxLength) {
            return text;
        }

        // Truncate text at word boundary
        const truncatedText = text.slice(0, maxLength);
        const lastSpace = truncatedText.lastIndexOf(' ');
        if (lastSpace > maxLength * 0.7) {
            return truncatedText.slice(0, lastSpace) + '...';
        }

        return truncatedText + '...';
    } catch {
        if (html.length <= maxLength) {
            return html;
        }
        return html.slice(0, maxLength) + '...';
    }
}

function simplifyAxNode(axNode: unknown): PromptAxNode | null {
    if (!axNode || typeof axNode !== 'object') {
        return null;
    }

    const node = axNode as Record<string, unknown>;

    // Extract name from AX node (could be in name.value or directly)
    let name = '';
    if (node.name && typeof node.name === 'object') {
        const nameObj = node.name as Record<string, unknown>;
        const rawValue = nameObj.value;
        name = typeof rawValue === 'string' ? rawValue : typeof rawValue === 'number' ? String(rawValue) : '';
    } else if (typeof node.name === 'string') {
        name = node.name;
    }

    let role = '';
    if (node.role && typeof node.role === 'object') {
        const roleObj = node.role as Record<string, unknown>;
        const rawValue = roleObj.value;
        role = typeof rawValue === 'string' ? rawValue : typeof rawValue === 'number' ? String(rawValue) : '';
    } else if (typeof node.role === 'string') {
        role = node.role;
    }

    let description: string | undefined;
    if (node.description && typeof node.description === 'object') {
        const descObj = node.description as Record<string, unknown>;
        const rawValue = descObj.value;
        description =
            typeof rawValue === 'string' ? rawValue : typeof rawValue === 'number' ? String(rawValue) : undefined;
    }

    let value: string | undefined;
    if (node.value && typeof node.value === 'object') {
        const valObj = node.value as Record<string, unknown>;
        const rawValue = valObj.value;
        value = typeof rawValue === 'string' ? rawValue : typeof rawValue === 'number' ? String(rawValue) : undefined;
    }

    const properties: PromptAxNode['properties'] = {};
    if (Array.isArray(node.properties)) {
        for (const prop of node.properties) {
            if (typeof prop === 'object' && prop !== null) {
                const propRecord = prop as Record<string, unknown>;
                const propName = propRecord.name as string;
                const propValue = (propRecord.value as Record<string, unknown>)?.value;

                switch (propName) {
                    case 'focusable':
                        properties.focusable = propValue === true;
                        break;
                    case 'focused':
                        properties.focused = propValue === true;
                        break;
                    case 'disabled':
                        properties.disabled = propValue === true;
                        break;
                    case 'expanded':
                        properties.expanded = propValue === true;
                        break;
                    case 'selected':
                        properties.selected = propValue === true;
                        break;
                    case 'checked':
                        properties.checked = propValue as boolean | 'mixed';
                        break;
                    case 'level':
                        properties.level = propValue as number;
                        break;
                    case 'required':
                        properties.required = propValue === true;
                        break;
                    case 'invalid':
                        properties.invalid = propValue === true;
                        break;
                }
            }
        }
    }

    const hasProperties = Object.keys(properties).length > 0;

    return {
        role,
        name,
        ...(description && { description }),
        ...(value && { value }),
        ...(hasProperties && { properties }),
    };
}

function transformStep(step: NavigationStep, config: ResolvedTranscriptConfig): PromptNavigationStep {
    const spoken = step.spokenPhrases.join(' ').trim();

    let htmlSnippet: string | null = null;
    if (config.includeHtmlSnippets && step.htmlSnippet) {
        htmlSnippet = cleanAndTruncateHtml(step.htmlSnippet, config.maxHtmlSnippetLength);
    }

    let axNode: PromptAxNode | null = null;
    if (config.includeAxNodes && step.axNode) {
        axNode = simplifyAxNode(step.axNode);
    }

    return {
        index: step.index,
        identifier: step.identifier,
        spoken,
        focusedElementText: step.focusedElementText,
        axNode,
        htmlSnippet,
    };
}

function transformStrategy(result: StrategyResult, config: ResolvedTranscriptConfig): PromptStrategySection {
    return {
        strategyName: result.meta.name,
        description: result.meta.description,
        completionReason: result.completionReason,
        totalSteps: result.navigationSteps.length,
        steps: result.navigationSteps.map((step) => transformStep(step, config)),
    };
}

function shouldIncludeStrategy(strategyName: string, config: ResolvedTranscriptConfig): boolean {
    if (config.includeStrategies.length > 0) {
        return config.includeStrategies.includes(strategyName);
    }

    if (config.excludeStrategies.length > 0) {
        return !config.excludeStrategies.includes(strategyName);
    }

    return true;
}

export function buildTranscriptData(
    transcript: StrategyResult[],
    config: TranscriptSectionConfig = {}
): PromptTranscript {
    const mergedConfig = mergeTranscriptConfig(config);

    const sections = transcript
        .filter((result) => shouldIncludeStrategy(result.meta.name, mergedConfig))
        .map((result) => transformStrategy(result, mergedConfig));

    const totalSteps = sections.reduce((sum, section) => sum + section.totalSteps, 0);

    return {
        sections,
        totalStrategies: sections.length,
        totalSteps,
    };
}

function addStepXml(
    parent: XMLBuilder,
    step: PromptNavigationStep,
    includeAxNode: boolean,
    includeHtml: boolean
): void {
    const stepEle = parent.ele('step', { index: step.index, id: step.identifier });

    stepEle.ele('spoken').txt(step.spoken);
    stepEle.ele('item_text').txt(step.focusedElementText);

    if (includeAxNode && step.axNode) {
        const axNodeEle = stepEle.ele('ax_node');
        axNodeEle.ele('role').txt(step.axNode.role);
        axNodeEle.ele('name').txt(step.axNode.name);

        if (step.axNode.description) {
            axNodeEle.ele('description').txt(step.axNode.description);
        }
        if (step.axNode.value) {
            axNodeEle.ele('value').txt(step.axNode.value);
        }
        if (step.axNode.properties) {
            const props = step.axNode.properties;
            const propAttrs: Record<string, string | number | boolean> = {};

            if (props.focusable !== undefined) propAttrs.focusable = props.focusable;
            if (props.focused !== undefined) propAttrs.focused = props.focused;
            if (props.disabled !== undefined) propAttrs.disabled = props.disabled;
            if (props.expanded !== undefined) propAttrs.expanded = props.expanded;
            if (props.selected !== undefined) propAttrs.selected = props.selected;
            if (props.checked !== undefined) propAttrs.checked = props.checked;
            if (props.level !== undefined) propAttrs.level = props.level;
            if (props.required !== undefined) propAttrs.required = props.required;
            if (props.invalid !== undefined) propAttrs.invalid = props.invalid;

            if (Object.keys(propAttrs).length > 0) {
                axNodeEle.ele('properties', propAttrs);
            }
        }
    }

    if (includeHtml && step.htmlSnippet) {
        // CDATA sections cannot contain ']]>' - we need to handle this edge case
        // by splitting into multiple CDATA sections. Since xmlbuilder2 validates
        // CDATA content, we build the raw content manually.
        const htmlSnippetEle = stepEle.ele('html_snippet');

        if (step.htmlSnippet.includes(']]>')) {
            // Split CDATA at ]]> sequences: "foo]]>bar" becomes "<![CDATA[foo]]]]><![CDATA[>bar]]>"
            const parts = step.htmlSnippet.split(']]>');
            parts.forEach((part, i) => {
                htmlSnippetEle.dat(part);
                if (i < parts.length - 1) {
                    // Insert the '>' part after closing previous CDATA
                    htmlSnippetEle.dat('>');
                }
            });
        } else {
            htmlSnippetEle.dat(step.htmlSnippet);
        }
    }
}

function addSectionXml(parent: XMLBuilder, section: PromptStrategySection, config: ResolvedTranscriptConfig): void {
    const strategyEle = parent.ele('strategy', {
        name: section.strategyName,
    });

    strategyEle.ele('description').txt(section.description);
    strategyEle.ele('completion_reason', { kind: section.completionReason.kind }).txt(section.completionReason.detail);

    const stepsEle = strategyEle.ele('steps', { total: section.totalSteps });

    for (const step of section.steps) {
        addStepXml(stepsEle, step, config.includeAxNodes, config.includeHtmlSnippets);
    }
}

export function renderTranscriptXml(transcript: PromptTranscript, config: TranscriptSectionConfig = {}): string {
    const mergedConfig = mergeTranscriptConfig(config);

    const root = create().ele('transcript', {
        strategies: transcript.totalStrategies,
        total_steps: transcript.totalSteps,
    });

    for (const section of transcript.sections) {
        addSectionXml(root, section, mergedConfig);
    }

    return root.end({ prettyPrint: true, indent: '    ', headless: true });
}

export function buildTranscriptSection(transcript: StrategyResult[], config: TranscriptSectionConfig = {}): string {
    const data = buildTranscriptData(transcript, config);
    return renderTranscriptXml(data, config);
}
