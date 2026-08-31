import type { Page, CDPSession } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { ScreenshotSuccess, ScreenshotFailure, Screenshot } from '../core/violation';

export interface ScreenshotOptions {
    padding?: number;
    maxWidth?: number;
    maxHeight?: number;
    highlightColor?: string;
}

const DEFAULT_OPTIONS: Required<ScreenshotOptions> = {
    padding: 20,
    maxWidth: 800,
    maxHeight: 600,
    highlightColor: '#ff0000',
};

/**
 * Capture a screenshot of an element and write it to the screenshots directory.
 * Returns either a success (path, dimensions) or failure (error, debug info).
 */
export async function captureScreenshotToFile(
    page: Page,
    cdp: CDPSession,
    backendNodeId: number,
    screenshotsDir: string,
    filename: string,
    options: ScreenshotOptions = {}
): Promise<Screenshot> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const viewport = page.viewportSize();
    let boundingBox: BoundingBox | null = null;

    const failure = (error: string): ScreenshotFailure => ({
        error,
        backendNodeId,
        boundingBox,
        viewport,
    });

    try {
        await cdp.send('DOM.scrollIntoViewIfNeeded', { backendNodeId });

        const { model } = await cdp.send('DOM.getBoxModel', { backendNodeId });
        if (!model) {
            return failure('DOM.getBoxModel returned no model');
        }

        boundingBox = quadToBoundingBox(model.content);
        const paddedBox = addPadding(boundingBox, opts.padding);
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

        await mkdir(screenshotsDir, { recursive: true });
        const filePath = join(screenshotsDir, `${filename}.png`);
        await writeFile(filePath, screenshotBuffer);

        return {
            path: `screenshots/${filename}.png`,
            width: Math.round(clampedBox.width),
            height: Math.round(clampedBox.height),
        };
    } catch (e) {
        return failure(e instanceof Error ? e.message : String(e));
    }
}

/**
 * Ensure the screenshots directory exists within the output directory.
 */
export async function ensureScreenshotsDir(outputDir: string): Promise<string> {
    const screenshotsDir = join(outputDir, 'screenshots');
    await mkdir(screenshotsDir, { recursive: true });
    return screenshotsDir;
}

export type { Screenshot, ScreenshotSuccess, ScreenshotFailure } from '../core/violation';
export { isScreenshotSuccess } from '../core/violation';

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

function hexToRgba(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? {
              r: parseInt(result[1]!, 16),
              g: parseInt(result[2]!, 16),
              b: parseInt(result[3]!, 16),
          }
        : { r: 255, g: 0, b: 0 };
}
