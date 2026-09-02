import { parse, HTMLElement } from 'node-html-parser';
import { create } from 'xmlbuilder2';
import type { XMLBuilder } from 'xmlbuilder2/lib/interfaces';
import type {
    StrategyResult,
    NavigationStep,
} from '../../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';
import type {
    PromptTranscript,
    PromptStrategySection,
    PromptNavigationStep,
    PromptAxNode,
    TranscriptSectionConfig,
    ResolvedTranscriptConfig,
} from '../schemas';
import { mergeTranscriptConfig } from '../schemas';

/**
 * Cleans and truncates HTML snippet using node-html-parser.
 * - Removes script, style, and noscript elements
 * - Removes event handler attributes (onclick, onload, etc.)
 * - Truncates intelligently at element boundaries
 * - Falls back to text content if HTML is too complex
 */
function cleanAndTruncateHtml(html: string, maxLength: number): string {
    try {
        const root = parse(html, {
            comment: false, // Remove comments
        });

        // Remove noise elements
        root.querySelectorAll('script, style, noscript, svg').forEach((el) => el.remove());

        // Remove event handler attributes from all elements
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

        // Get cleaned HTML
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

        // Try to truncate at element boundary
        // Find the last complete element within maxLength
        const truncated = cleaned.slice(0, maxLength);
        const lastTagClose = truncated.lastIndexOf('>');

        if (lastTagClose > 0) {
            // Parse the truncated portion to check if it's valid
            const partial = truncated.slice(0, lastTagClose + 1);
            try {
                const partialRoot = parse(partial);
                // If we got valid HTML, use it
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
        // If parsing fails, return original truncated
        if (html.length <= maxLength) {
            return html;
        }
        return html.slice(0, maxLength) + '...';
    }
}

/**
 * Extracts relevant properties from full AX node.
 */
function simplifyAxNode(axNode: unknown): PromptAxNode | null {
    if (!axNode || typeof axNode !== 'object') {
        return null;
    }

    const node = axNode as Record<string, unknown>;

    // Extract name from AX node (could be in name.value or directly)
    let name = '';
    if (node.name && typeof node.name === 'object') {
        const nameObj = node.name as Record<string, unknown>;
        name = String(nameObj.value ?? '');
    } else if (typeof node.name === 'string') {
        name = node.name;
    }

    // Extract role
    let role = '';
    if (node.role && typeof node.role === 'object') {
        const roleObj = node.role as Record<string, unknown>;
        role = String(roleObj.value ?? '');
    } else if (typeof node.role === 'string') {
        role = node.role;
    }

    // Extract description
    let description: string | undefined;
    if (node.description && typeof node.description === 'object') {
        const descObj = node.description as Record<string, unknown>;
        description = descObj.value ? String(descObj.value) : undefined;
    }

    // Extract value
    let value: string | undefined;
    if (node.value && typeof node.value === 'object') {
        const valObj = node.value as Record<string, unknown>;
        value = valObj.value ? String(valObj.value) : undefined;
    }

    // Extract properties from the properties array
    const properties: PromptAxNode['properties'] = {};
    if (Array.isArray(node.properties)) {
        for (const prop of node.properties) {
            if (typeof prop === 'object' && prop !== null) {
                const p = prop as Record<string, unknown>;
                const propName = p.name as string;
                const propValue = (p.value as Record<string, unknown>)?.value;

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

    // Only include properties object if it has values
    const hasProperties = Object.keys(properties).length > 0;

    return {
        role,
        name,
        ...(description && { description }),
        ...(value && { value }),
        ...(hasProperties && { properties }),
    };
}

/**
 * Transforms a NavigationStep into prompt-ready format.
 */
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
        itemText: step.itemText,
        axNode,
        htmlSnippet,
    };
}

/**
 * Transforms a StrategyResult into a prompt section.
 */
function transformStrategy(result: StrategyResult, config: ResolvedTranscriptConfig): PromptStrategySection {
    return {
        strategyName: result.meta.name,
        description: result.meta.description,
        mode: result.meta.mode,
        completionReason: result.completionReason,
        totalSteps: result.navigationSteps.length,
        steps: result.navigationSteps.map((step) => transformStep(step, config)),
    };
}

/**
 * Filters strategies based on config.
 */
function shouldIncludeStrategy(strategyName: string, config: ResolvedTranscriptConfig): boolean {
    // If include list is specified, only include those
    if (config.includeStrategies.length > 0) {
        return config.includeStrategies.includes(strategyName);
    }

    // If exclude list is specified, exclude those
    if (config.excludeStrategies.length > 0) {
        return !config.excludeStrategies.includes(strategyName);
    }

    return true;
}

/**
 * Builds the transcript data structure from strategy results.
 */
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

/**
 * Adds a navigation step to the parent XML element using xmlbuilder2.
 */
function addStepXml(
    parent: XMLBuilder,
    step: PromptNavigationStep,
    includeAxNode: boolean,
    includeHtml: boolean
): void {
    const stepEle = parent.ele('step', { index: step.index, id: step.identifier });

    stepEle.ele('spoken').txt(step.spoken);
    stepEle.ele('item_text').txt(step.itemText);

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

/**
 * Adds a strategy section to the parent XML element using xmlbuilder2.
 */
function addSectionXml(parent: XMLBuilder, section: PromptStrategySection, config: ResolvedTranscriptConfig): void {
    const strategyEle = parent.ele('strategy', {
        name: section.strategyName,
        mode: section.mode,
    });

    strategyEle.ele('description').txt(section.description);
    strategyEle.ele('completion_reason', { kind: section.completionReason.kind }).txt(section.completionReason.detail);

    const stepsEle = strategyEle.ele('steps', { total: section.totalSteps });

    for (const step of section.steps) {
        addStepXml(stepsEle, step, config.includeAxNodes, config.includeHtmlSnippets);
    }
}

/**
 * Renders the complete transcript as XML for prompt inclusion using xmlbuilder2.
 */
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

/**
 * Convenience function: builds and renders transcript XML in one call.
 */
export function buildTranscriptSection(transcript: StrategyResult[], config: TranscriptSectionConfig = {}): string {
    const data = buildTranscriptData(transcript, config);
    return renderTranscriptXml(data, config);
}
