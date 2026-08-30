import type { Page, CDPSession } from 'playwright';

export interface ScreenshotOptions {
    padding?: number;
    maxWidth?: number;
    maxHeight?: number;
    highlightColor?: string;
    highlightWidth?: number;
}

const DEFAULT_OPTIONS: Required<ScreenshotOptions> = {
    padding: 20,
    maxWidth: 800,
    maxHeight: 600,
    highlightColor: '#ff0000',
    highlightWidth: 3,
};

export interface Screenshot {
    data: string;
    width: number;
    height: number;
}

export async function captureScreenshot(
    page: Page,
    cdp: CDPSession,
    backendNodeId: number,
    options: ScreenshotOptions = {}
): Promise<Screenshot | null> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    try {
        const { model } = await cdp.send('DOM.getBoxModel', { backendNodeId });
        if (!model) return null;

        const quad = model.content;
        const box = quadToBoundingBox(quad);
        const paddedBox = addPadding(box, opts.padding);
        const viewport = page.viewportSize();
        const clampedBox = clampToViewport(paddedBox, viewport, opts.maxWidth, opts.maxHeight);

        await highlightElement(cdp, backendNodeId, opts.highlightColor);

        const clip = {
            x: clampedBox.x,
            y: clampedBox.y,
            width: clampedBox.width,
            height: clampedBox.height,
        };

        const screenshotBuffer = await page.screenshot({ clip, type: 'png' });
        await cdp.send('Overlay.hideHighlight');

        return {
            data: screenshotBuffer.toString('base64'),
            width: Math.round(clampedBox.width),
            height: Math.round(clampedBox.height),
        };
    } catch {
        return null;
    }
}

interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

function quadToBoundingBox(quad: number[]): BoundingBox {
    const xs = [quad[0]!, quad[2]!, quad[4]!, quad[6]!];
    const ys = [quad[1]!, quad[3]!, quad[5]!, quad[7]!];
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function addPadding(box: BoundingBox, padding: number): BoundingBox {
    return {
        x: box.x - padding,
        y: box.y - padding,
        width: box.width + 2 * padding,
        height: box.height + 2 * padding,
    };
}

function clampToViewport(
    box: BoundingBox,
    viewport: { width: number; height: number } | null,
    maxWidth: number,
    maxHeight: number
): BoundingBox {
    const vw = viewport?.width ?? 1920;
    const vh = viewport?.height ?? 1080;

    let { x, y, width, height } = box;

    x = Math.max(0, x);
    y = Math.max(0, y);
    width = Math.min(width, vw - x, maxWidth);
    height = Math.min(height, vh - y, maxHeight);

    return { x, y, width, height };
}

async function highlightElement(cdp: CDPSession, backendNodeId: number, color: string): Promise<void> {
    const rgba = hexToRgba(color);
    await cdp.send('Overlay.enable');
    await cdp.send('Overlay.highlightNode', {
        highlightConfig: {
            contentColor: { r: rgba.r, g: rgba.g, b: rgba.b, a: 0.2 },
            borderColor: { r: rgba.r, g: rgba.g, b: rgba.b, a: 1 },
            paddingColor: { r: rgba.r, g: rgba.g, b: rgba.b, a: 0.1 },
        },
        backendNodeId,
    });
}

function hexToRgba(hex: string): { r: number; g: number; b: number; a: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? {
              r: parseInt(result[1]!, 16),
              g: parseInt(result[2]!, 16),
              b: parseInt(result[3]!, 16),
              a: 1,
          }
        : { r: 255, g: 0, b: 0, a: 1 };
}
