import type { Page, CDPSession } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type {
    ScreenshotSuccess,
    ScreenshotFailure,
    Screenshot,
    BoundingBox,
} from '../core/violation';

/* eslint-disable @typescript-eslint/no-explicit-any */
// Browser globals used in page.evaluate() contexts - declared as any since DOM lib not included
declare const document: any;
declare const window: any;
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface ScreenshotOptions {
    /** Highlight border color (default: #e53935 - red) */
    highlightColor?: string;
    /** Highlight border width in pixels (default: 3) */
    highlightWidth?: number;
    /** Whether to add a semi-transparent overlay on the element (default: true) */
    highlightOverlay?: boolean;
    /** Overlay background color with alpha (default: rgba(229, 57, 53, 0.15)) */
    overlayColor?: string;
    /** Label text to display near the highlighted element (e.g., rule ID like "empty-heading") */
    label?: string;
}

const DEFAULT_OPTIONS = {
    highlightColor: '#e53935',
    highlightWidth: 3,
    highlightOverlay: true,
    overlayColor: 'rgba(229, 57, 53, 0.15)',
} satisfies Omit<Required<ScreenshotOptions>, 'label'>;

// Unique attributes to mark elements for cleanup
const HIGHLIGHT_ATTR = 'data-a11y-audit-highlight';
const LABEL_ID = 'a11y-audit-violation-label';

/**
 * Capture a viewport screenshot with the target element highlighted and scrolled into view.
 * 
 * This approach:
 * 1. Scrolls the element to the center of the viewport
 * 2. Applies a visible CSS-based highlight (outline + overlay)
 * 3. Adds an optional label/tag showing the violation name
 * 4. Takes a full viewport screenshot
 * 5. Cleans up the highlight and label
 * 6. Returns the screenshot with element bounds for reference
 */
export async function captureViewportWithHighlight(
    page: Page,
    cdp: CDPSession,
    backendNodeId: number,
    screenshotsDir: string,
    filename: string,
    options: ScreenshotOptions = {}
): Promise<Screenshot> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const viewport = page.viewportSize();
    let elementBounds: BoundingBox | null = null;

    const failure = (error: string): ScreenshotFailure => ({
        error,
        backendNodeId,
        boundingBox: elementBounds,
        viewport,
    });

    try {
        // 1. Scroll element into view (centered)
        await scrollElementToCenter(cdp, backendNodeId);

        // Small delay to let any scroll animations settle
        await page.waitForTimeout(100);

        // 2. Get element's bounding box after scroll
        const { model } = await cdp.send('DOM.getBoxModel', { backendNodeId });
        if (!model) {
            return failure('DOM.getBoxModel returned no model');
        }
        elementBounds = quadToBoundingBox(model.content);

        // 3. Apply CSS-based highlight (this will appear in the screenshot)
        await applyHighlight(page, cdp, backendNodeId, opts);

        // 4. Add label if provided
        if (opts.label) {
            await addLabel(page, elementBounds, opts.label, opts.highlightColor);
        }

        // 5. Take full viewport screenshot
        const screenshotBuffer = await page.screenshot({ type: 'png' });

        // 6. Remove the highlight and label
        await removeHighlight(page, cdp, backendNodeId);
        await removeLabel(page);

        // 7. Save to file
        await mkdir(screenshotsDir, { recursive: true });
        const filePath = join(screenshotsDir, `${filename}.png`);
        await writeFile(filePath, screenshotBuffer);

        return {
            path: `screenshots/${filename}.png`,
            width: viewport?.width ?? 1920,
            height: viewport?.height ?? 1080,
            elementBounds: elementBounds,
        };
    } catch (e) {
        // Attempt cleanup on error
        try {
            await removeHighlight(page, cdp, backendNodeId);
            await removeLabel(page);
        } catch {
            // Ignore cleanup errors
        }
        return failure(e instanceof Error ? e.message : String(e));
    }
}

/**
 * Legacy function for backward compatibility - now redirects to viewport capture.
 * @deprecated Use captureViewportWithHighlight instead
 */
export async function captureScreenshotToFile(
    page: Page,
    cdp: CDPSession,
    backendNodeId: number,
    screenshotsDir: string,
    filename: string,
    options: ScreenshotOptions = {}
): Promise<Screenshot> {
    return captureViewportWithHighlight(page, cdp, backendNodeId, screenshotsDir, filename, options);
}

/**
 * Ensure the screenshots directory exists within the output directory.
 */
export async function ensureScreenshotsDir(outputDir: string): Promise<string> {
    const screenshotsDir = join(outputDir, 'screenshots');
    await mkdir(screenshotsDir, { recursive: true });
    return screenshotsDir;
}

// Re-export types from violation.ts
export type { Screenshot, ScreenshotSuccess, ScreenshotFailure, BoundingBox } from '../core/violation';
export { isScreenshotSuccess } from '../core/violation';

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Scroll the element to the center of the viewport for better context.
 */
async function scrollElementToCenter(cdp: CDPSession, backendNodeId: number): Promise<void> {
    // First, ensure it's in view
    await cdp.send('DOM.scrollIntoViewIfNeeded', { backendNodeId });

    // Resolve to a remote object so we can run JS on it
    const { object } = await cdp.send('DOM.resolveNode', { backendNodeId });
    if (!object.objectId) return;

    // Use Runtime.callFunctionOn to center the element
    await cdp.send('Runtime.callFunctionOn', {
        objectId: object.objectId,
        functionDeclaration: `
            function() {
                this.scrollIntoView({
                    behavior: 'instant',
                    block: 'center',
                    inline: 'center'
                });
            }
        `,
    });

    // Release the object
    await cdp.send('Runtime.releaseObject', { objectId: object.objectId });
}

/**
 * Apply a visible CSS highlight to the element.
 * Uses inline styles + a pseudo-element overlay via a wrapper.
 */
async function applyHighlight(
    page: Page,
    cdp: CDPSession,
    backendNodeId: number,
    opts: Required<Omit<ScreenshotOptions, 'label'>>
): Promise<void> {
    // Resolve backendNodeId to a remote object
    const { object } = await cdp.send('DOM.resolveNode', { backendNodeId });
    if (!object.objectId) return;

    const { highlightColor, highlightWidth, highlightOverlay, overlayColor } = opts;

    // Apply highlight styles via JavaScript
    await cdp.send('Runtime.callFunctionOn', {
        objectId: object.objectId,
        functionDeclaration: `
            function(attr, color, width, showOverlay, bgColor) {
                // Mark element for later cleanup
                this.setAttribute(attr, 'true');
                
                // Store original styles
                this.dataset.a11yOriginalOutline = this.style.outline || '';
                this.dataset.a11yOriginalOutlineOffset = this.style.outlineOffset || '';
                this.dataset.a11yOriginalPosition = this.style.position || '';
                this.dataset.a11yOriginalZIndex = this.style.zIndex || '';
                this.dataset.a11yOriginalBoxShadow = this.style.boxShadow || '';
                
                // Apply highlight styles
                this.style.outline = width + 'px solid ' + color;
                this.style.outlineOffset = '2px';
                this.style.boxShadow = '0 0 0 ' + (width + 4) + 'px rgba(255,255,255,0.9), 0 0 20px 5px ' + color;
                
                // Ensure element is visible above others
                const computed = window.getComputedStyle(this);
                if (computed.position === 'static') {
                    this.style.position = 'relative';
                }
                this.style.zIndex = '999999';
                
                // Add overlay background if requested
                if (showOverlay) {
                    this.dataset.a11yOriginalBackground = this.style.background || '';
                    // Only apply if element doesn't have a complex background
                    const currentBg = computed.backgroundColor;
                    if (currentBg === 'rgba(0, 0, 0, 0)' || currentBg === 'transparent') {
                        this.style.background = bgColor;
                    }
                }
            }
        `,
        arguments: [
            { value: HIGHLIGHT_ATTR },
            { value: highlightColor },
            { value: highlightWidth },
            { value: highlightOverlay },
            { value: overlayColor },
        ],
    });

    // Release the object
    await cdp.send('Runtime.releaseObject', { objectId: object.objectId });
}

/**
 * Add a floating label near the highlighted element showing the violation name.
 */
async function addLabel(
    page: Page,
    elementBounds: BoundingBox,
    labelText: string,
    color: string
): Promise<void> {
    await page.evaluate(
        ({ id, bounds, text, bgColor }) => {
            // Remove any existing label first
            const existing = document.getElementById(id);
            if (existing) existing.remove();

            // Create label element
            const label = document.createElement('div');
            label.id = id;
            label.textContent = text;

            // Position above the element, or below if near top of viewport
            const labelHeight = 28;
            const padding = 8;
            const arrowSize = 6;
            
            let top: number;
            let arrowPosition: 'bottom' | 'top';
            
            if (bounds.y > labelHeight + padding + arrowSize) {
                // Position above element
                top = bounds.y - labelHeight - padding - arrowSize;
                arrowPosition = 'bottom';
            } else {
                // Position below element
                top = bounds.y + bounds.height + padding + arrowSize;
                arrowPosition = 'top';
            }

            // Center horizontally on the element, but keep within viewport
            let left = bounds.x + (bounds.width / 2);
            
            // Style the label
            Object.assign(label.style, {
                position: 'fixed',
                top: `${top}px`,
                left: `${left}px`,
                transform: 'translateX(-50%)',
                backgroundColor: bgColor,
                color: '#ffffff',
                padding: '4px 12px',
                borderRadius: '4px',
                fontSize: '13px',
                fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, monospace',
                fontWeight: '600',
                letterSpacing: '0.025em',
                whiteSpace: 'nowrap',
                zIndex: '9999999',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.2)',
                border: '2px solid rgba(255,255,255,0.9)',
                pointerEvents: 'none',
            });

            // Add arrow pointing to element
            const arrow = document.createElement('div');
            Object.assign(arrow.style, {
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '0',
                height: '0',
                borderLeft: `${arrowSize}px solid transparent`,
                borderRight: `${arrowSize}px solid transparent`,
            });

            if (arrowPosition === 'bottom') {
                // Arrow pointing down (label is above element)
                Object.assign(arrow.style, {
                    bottom: `-${arrowSize}px`,
                    borderTop: `${arrowSize}px solid ${bgColor}`,
                });
            } else {
                // Arrow pointing up (label is below element)
                Object.assign(arrow.style, {
                    top: `-${arrowSize}px`,
                    borderBottom: `${arrowSize}px solid ${bgColor}`,
                });
            }

            label.appendChild(arrow);
            document.body.appendChild(label);

            // Adjust if label goes off-screen horizontally
            const labelRect = label.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            
            if (labelRect.left < 8) {
                label.style.left = `${8 + labelRect.width / 2}px`;
            } else if (labelRect.right > viewportWidth - 8) {
                label.style.left = `${viewportWidth - 8 - labelRect.width / 2}px`;
            }
        },
        { id: LABEL_ID, bounds: elementBounds, text: labelText, bgColor: color }
    );
}

/**
 * Remove the violation label from the page.
 */
async function removeLabel(page: Page): Promise<void> {
    await page.evaluate((id) => {
        const label = document.getElementById(id);
        if (label) label.remove();
    }, LABEL_ID);
}

/**
 * Remove the CSS highlight from the element, restoring original styles.
 */
async function removeHighlight(
    page: Page,
    cdp: CDPSession,
    backendNodeId: number
): Promise<void> {
    // Resolve backendNodeId to a remote object
    const { object } = await cdp.send('DOM.resolveNode', { backendNodeId });
    if (!object.objectId) return;

    await cdp.send('Runtime.callFunctionOn', {
        objectId: object.objectId,
        functionDeclaration: `
            function(attr) {
                // Only clean up if we marked it
                if (!this.hasAttribute(attr)) return;
                
                // Restore original styles
                this.style.outline = this.dataset.a11yOriginalOutline || '';
                this.style.outlineOffset = this.dataset.a11yOriginalOutlineOffset || '';
                this.style.position = this.dataset.a11yOriginalPosition || '';
                this.style.zIndex = this.dataset.a11yOriginalZIndex || '';
                this.style.boxShadow = this.dataset.a11yOriginalBoxShadow || '';
                
                if (this.dataset.a11yOriginalBackground !== undefined) {
                    this.style.background = this.dataset.a11yOriginalBackground;
                }
                
                // Clean up data attributes
                delete this.dataset.a11yOriginalOutline;
                delete this.dataset.a11yOriginalOutlineOffset;
                delete this.dataset.a11yOriginalPosition;
                delete this.dataset.a11yOriginalZIndex;
                delete this.dataset.a11yOriginalBoxShadow;
                delete this.dataset.a11yOriginalBackground;
                
                // Remove marker
                this.removeAttribute(attr);
            }
        `,
        arguments: [{ value: HIGHLIGHT_ATTR }],
    });

    // Release the object
    await cdp.send('Runtime.releaseObject', { objectId: object.objectId });
}

/**
 * Convert a CDP quad (8 numbers: 4 x,y pairs) to a bounding box.
 */
function quadToBoundingBox(quad: number[]): BoundingBox {
    const xs = [quad[0]!, quad[2]!, quad[4]!, quad[6]!];
    const ys = [quad[1]!, quad[3]!, quad[5]!, quad[7]!];
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
        x: Math.round(minX),
        y: Math.round(minY),
        width: Math.round(maxX - minX),
        height: Math.round(maxY - minY),
    };
}
