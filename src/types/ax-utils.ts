/**
 * Utility functions for safely extracting values from CDP AXNode properties.
 * AXValue.value is typed as `unknown` because CDP can return different types.
 */
import type { AXNode, AXValue, AXProperty } from './cdp';

export function getRole(node: AXNode | null | undefined): string | undefined {
    return getStringValue(node?.role);
}

export function getName(node: AXNode | null | undefined): string | undefined {
    return getStringValue(node?.name);
}

function getStringValue(axValue: AXValue | undefined): string | undefined {
    if (!axValue || typeof axValue.value !== 'string') {
        return undefined;
    }
    return axValue.value;
}

function getNumberValue(axValue: AXValue | undefined): number | undefined {
    if (!axValue || typeof axValue.value !== 'number') {
        return undefined;
    }
    return axValue.value;
}

function getPropertyNumber(node: AXNode | null | undefined, propertyName: string): number | undefined {
    const prop = node?.properties?.find((p) => p.name === propertyName);
    return getNumberValue(prop?.value);
}

export function getHeadingLevel(node: AXNode | null | undefined): number | undefined {
    return getPropertyNumber(node, 'level');
}

export type { AXNode, AXValue, AXProperty };
