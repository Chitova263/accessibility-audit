/**
 * Utility functions for safely extracting values from CDP AXNode properties.
 *
 * AXValue.value is typed as `unknown` because CDP can return different types
 * depending on the AXValueType. For commonly-accessed fields like role, name,
 * and description, the value is always a string. These helpers provide type-safe
 * extraction.
 */
import type { AXNode, AXValue, AXProperty } from './cdp';

/**
 * Extract the role string from an AXNode.
 * Returns undefined if the node has no role or the role value is not a string.
 */
export function getRole(node: AXNode | null | undefined): string | undefined {
    return getStringValue(node?.role);
}

/**
 * Extract the accessible name string from an AXNode.
 * Returns undefined if the node has no name or the name value is not a string.
 */
export function getName(node: AXNode | null | undefined): string | undefined {
    return getStringValue(node?.name);
}
/**
 * Extract the string value from an AXValue.
 * Returns undefined if the value is not present or not a string.
 */
export function getStringValue(axValue: AXValue | undefined): string | undefined {
    if (!axValue || typeof axValue.value !== 'string') {
        return undefined;
    }
    return axValue.value;
}

/**
 * Extract the number value from an AXValue.
 * Returns undefined if the value is not present or not a number.
 */
export function getNumberValue(axValue: AXValue | undefined): number | undefined {
    if (!axValue || typeof axValue.value !== 'number') {
        return undefined;
    }
    return axValue.value;
}
/**
 * Find a property by name and extract its number value.
 * Commonly used for 'level' property on headings.
 */
export function getPropertyNumber(node: AXNode | null | undefined, propertyName: string): number | undefined {
    const prop = node?.properties?.find((p) => p.name === propertyName);
    return getNumberValue(prop?.value);
}

/**
 * Get the heading level from an AXNode.
 * Returns undefined if the node is not a heading or has no level property.
 */
export function getHeadingLevel(node: AXNode | null | undefined): number | undefined {
    return getPropertyNumber(node, 'level');
}
export type { AXNode, AXValue, AXProperty };
