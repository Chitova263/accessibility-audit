/**
 * Chrome DevTools Protocol Accessibility types.
 *
 * These are copied from playwright-core/types/protocol.d.ts because:
 * 1. playwright-core doesn't export protocol.d.ts in its package.json exports
 * 2. Triple-slash references don't work reliably with ESM and ESLint
 *
 * The types here match CDP's Accessibility domain and are stable (protocol versioned).
 * If playwright-core updates the protocol types, run `npm run typecheck` to catch drift.
 */

export namespace CDP {
    export namespace Accessibility {
        export type AXNodeId = string;

        export type AXValueType =
            | 'boolean'
            | 'tristate'
            | 'booleanOrUndefined'
            | 'idref'
            | 'idrefList'
            | 'integer'
            | 'node'
            | 'nodeList'
            | 'number'
            | 'string'
            | 'computedString'
            | 'token'
            | 'tokenList'
            | 'domRelation'
            | 'role'
            | 'internalRole'
            | 'valueUndefined';

        export interface AXValue {
            type: AXValueType;
            value?: unknown;
            relatedNodes?: AXRelatedNode[];
            sources?: AXValueSource[];
        }

        export interface AXRelatedNode {
            backendDOMNodeId: number;
            idref?: string;
            text?: string;
        }

        export interface AXValueSource {
            type: 'attribute' | 'implicit' | 'style' | 'contents' | 'placeholder' | 'relatedElement';
            value?: AXValue;
            attribute?: string;
            attributeValue?: AXValue;
            superseded?: boolean;
            nativeSource?:
                | 'description'
                | 'figcaption'
                | 'label'
                | 'labelfor'
                | 'labelwrapped'
                | 'legend'
                | 'rubyannotation'
                | 'tablecaption'
                | 'title'
                | 'other';
            nativeSourceValue?: AXValue;
            invalid?: boolean;
            invalidReason?: string;
        }

        export type AXPropertyName =
            | 'actions'
            | 'busy'
            | 'disabled'
            | 'editable'
            | 'focusable'
            | 'focused'
            | 'hidden'
            | 'hiddenRoot'
            | 'invalid'
            | 'keyshortcuts'
            | 'settable'
            | 'roledescription'
            | 'live'
            | 'atomic'
            | 'relevant'
            | 'root'
            | 'autocomplete'
            | 'hasPopup'
            | 'level'
            | 'multiselectable'
            | 'orientation'
            | 'multiline'
            | 'readonly'
            | 'required'
            | 'valuemin'
            | 'valuemax'
            | 'valuetext'
            | 'checked'
            | 'expanded'
            | 'modal'
            | 'pressed'
            | 'selected'
            | 'activedescendant'
            | 'controls'
            | 'describedby'
            | 'details'
            | 'errormessage'
            | 'flowto'
            | 'labelledby'
            | 'owns'
            | 'url'
            | 'activeFullscreenElement'
            | 'activeModalDialog'
            | 'activeAriaModalDialog'
            | 'ariaHiddenElement'
            | 'ariaHiddenSubtree'
            | 'emptyAlt'
            | 'emptyText'
            | 'inertElement'
            | 'inertSubtree'
            | 'labelContainer'
            | 'labelFor'
            | 'notRendered'
            | 'notVisible'
            | 'presentationalRole'
            | 'probablyPresentational'
            | 'inactiveCarouselTabContent'
            | 'uninteresting';

        export interface AXProperty {
            name: AXPropertyName;
            value: AXValue;
        }

        export interface AXNode {
            nodeId: AXNodeId;
            ignored: boolean;
            ignoredReasons?: AXProperty[];
            role?: AXValue;
            chromeRole?: AXValue;
            name?: AXValue;
            description?: AXValue;
            value?: AXValue;
            properties?: AXProperty[];
            parentId?: AXNodeId;
            childIds?: AXNodeId[];
            backendDOMNodeId?: number;
            frameId?: string;
        }

        export interface GetFullAXTreeResult {
            nodes: AXNode[];
        }
    }
}

export type AXNode = CDP.Accessibility.AXNode;
export type AXValue = CDP.Accessibility.AXValue;
export type AXProperty = CDP.Accessibility.AXProperty;
export type GetFullAXTreeResult = CDP.Accessibility.GetFullAXTreeResult;
