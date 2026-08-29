import { parse, HTMLElement } from 'node-html-parser';
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
import { getNavigationMode, mergeTranscriptConfig } from '../schemas';

/**
 * Escapes XML special characters.
 */
function escapeXml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

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
        strategyType: result.meta.type ?? 'unknown',
        description: result.meta.description,
        mode: getNavigationMode(result.meta.type),
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
    strategyResults: StrategyResult[],
    config: TranscriptSectionConfig = {}
): PromptTranscript {
    const mergedConfig = mergeTranscriptConfig(config);

    const sections = strategyResults
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
 * Renders a single navigation step as XML.
 */
function renderStepXml(step: PromptNavigationStep, includeAxNode: boolean, includeHtml: boolean): string {
    const lines: string[] = [];

    lines.push(`    <step index="${step.index}" id="${escapeXml(step.identifier)}">`);
    lines.push(`      <spoken>${escapeXml(step.spoken)}</spoken>`);
    lines.push(`      <item_text>${escapeXml(step.itemText)}</item_text>`);

    if (includeAxNode && step.axNode) {
        lines.push(`      <ax_node>`);
        lines.push(`        <role>${escapeXml(step.axNode.role)}</role>`);
        lines.push(`        <name>${escapeXml(step.axNode.name)}</name>`);
        if (step.axNode.description) {
            lines.push(`        <description>${escapeXml(step.axNode.description)}</description>`);
        }
        if (step.axNode.value) {
            lines.push(`        <value>${escapeXml(step.axNode.value)}</value>`);
        }
        if (step.axNode.properties) {
            const props = step.axNode.properties;
            const propStrings: string[] = [];
            if (props.focusable !== undefined) propStrings.push(`focusable="${props.focusable}"`);
            if (props.focused !== undefined) propStrings.push(`focused="${props.focused}"`);
            if (props.disabled !== undefined) propStrings.push(`disabled="${props.disabled}"`);
            if (props.expanded !== undefined) propStrings.push(`expanded="${props.expanded}"`);
            if (props.selected !== undefined) propStrings.push(`selected="${props.selected}"`);
            if (props.checked !== undefined) propStrings.push(`checked="${props.checked}"`);
            if (props.level !== undefined) propStrings.push(`level="${props.level}"`);
            if (props.required !== undefined) propStrings.push(`required="${props.required}"`);
            if (props.invalid !== undefined) propStrings.push(`invalid="${props.invalid}"`);
            if (propStrings.length > 0) {
                lines.push(`        <properties ${propStrings.join(' ')} />`);
            }
        }
        lines.push(`      </ax_node>`);
    }

    if (includeHtml && step.htmlSnippet) {
        // Wrap HTML in CDATA to avoid escaping issues
        lines.push(`      <html_snippet><![CDATA[${step.htmlSnippet}]]></html_snippet>`);
    }

    lines.push(`    </step>`);

    return lines.join('\n');
}

/**
 * Renders a strategy section as XML.
 */
function renderSectionXml(section: PromptStrategySection, config: ResolvedTranscriptConfig): string {
    const lines: string[] = [];

    lines.push(
        `  <strategy name="${escapeXml(section.strategyName)}" type="${escapeXml(section.strategyType)}" mode="${section.mode}">`
    );
    lines.push(`    <description>${escapeXml(section.description)}</description>`);
    lines.push(`    <completion_reason>${escapeXml(section.completionReason)}</completion_reason>`);
    lines.push(`    <steps total="${section.totalSteps}">`);

    for (const step of section.steps) {
        lines.push(renderStepXml(step, config.includeAxNodes, config.includeHtmlSnippets));
    }

    lines.push(`    </steps>`);
    lines.push(`  </strategy>`);

    return lines.join('\n');
}

/**
 * Renders the complete transcript as XML for prompt inclusion.
 */
export function renderTranscriptXml(transcript: PromptTranscript, config: TranscriptSectionConfig = {}): string {
    const mergedConfig = mergeTranscriptConfig(config);

    const lines: string[] = [];

    lines.push(`<transcript strategies="${transcript.totalStrategies}" total_steps="${transcript.totalSteps}">`);

    for (const section of transcript.sections) {
        lines.push(renderSectionXml(section, mergedConfig));
    }

    lines.push(`</transcript>`);

    return lines.join('\n');
}

/**
 * Convenience function: builds and renders transcript XML in one call.
 */
export function buildTranscriptSection(
    strategyResults: StrategyResult[],
    config: TranscriptSectionConfig = {}
): string {
    const transcript = buildTranscriptData(strategyResults, config);
    return renderTranscriptXml(transcript, config);
}
