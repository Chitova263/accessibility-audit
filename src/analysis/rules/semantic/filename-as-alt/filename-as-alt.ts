/**
 * Rule: Filename as Alt Text
 *
 * Detects images where the alt text is a filename or auto-generated identifier
 * (e.g., "IMG_1234.jpg") rather than a meaningful description.
 *
 * Maps to WCAG 1.1.1 (Non-text Content).
 */

import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { ScreenReaderContext, ScreenReaderViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { createScreenReaderContext } from '../../../utils/tool-details';
import { captureScreenshotToFile } from '../../../utils/screenshot-capture';

/** Patterns that indicate filename used as alt text */
const FILENAME_PATTERNS = [
    /^IMG[_-]?\d+\.(jpe?g|png|gif|webp|svg|bmp)$/i,
    /^DSC[_-]?\d+\.(jpe?g|png|gif|webp|svg|bmp)$/i,
    /^photo[_-]?\d*\.(jpe?g|png|gif|webp|svg|bmp)$/i,
    /^image[_-]?\d*\.(jpe?g|png|gif|webp|svg|bmp)$/i,
    /^screenshot[_-]?\d*\.(jpe?g|png|gif|webp|svg|bmp)$/i,
    /^[a-f0-9]{8,}\.(jpe?g|png|gif|webp|svg|bmp)$/i, // Hash-based filenames
    /^\d{10,}\.(jpe?g|png|gif|webp|svg|bmp)$/i, // Timestamp filenames
    /^[a-z0-9_-]+\.(jpe?g|png|gif|webp|svg|bmp)$/i, // Generic filename pattern
];

/** Patterns for common stock photo IDs */
const STOCK_PHOTO_PATTERNS = [
    /^stock[_-]?photo/i,
    /^shutterstock/i,
    /^getty/i,
    /^istock/i,
    /^adobe[_-]?stock/i,
    /^unsplash/i,
    /^pexels/i,
];

export interface FilenameAsAltStats {
    totalImages: number;
    violationsFound: number;
    byIssue: Record<'filename-as-alt', number>;
}

interface ImageInfo {
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

export class FilenameAsAltRule implements Rule<ScreenReaderContext, FilenameAsAltStats> {
    readonly id = 'filename-as-alt';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '1.1.1', level: 'A' },
        },
        impact: 'serious',
        summary: 'Image has a filename as alt text (e.g., "IMG_1234.jpg")',
    };

    async run(ctx: AuditContext): Promise<RuleResult<ScreenReaderContext, FilenameAsAltStats>> {
        const { transcript, page, cdp, screenshotsDir } = ctx;
        const violations: ScreenReaderViolation[] = [];
        const byIssue: Record<'filename-as-alt', number> = { 'filename-as-alt': 0 };

        const images: ImageInfo[] = [];

        for (const result of transcript) {
            for (let stepIndex = 0; stepIndex < result.navigationSteps.length; stepIndex++) {
                const step = result.navigationSteps[stepIndex]!;
                const node = step.axNode;

                if (!node) continue;

                const isImage =
                    node.role?.value === 'img' ||
                    node.role?.value === 'image' ||
                    step.htmlSnippet?.toLowerCase().includes('<img');

                if (!isImage) continue;

                images.push({
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

        const uniqueImages = this.deduplicateImages(images);

        for (const image of uniqueImages) {
            const name = image.name.trim();

            if (this.isFilenameAlt(name) || this.isStockPhotoId(name)) {
                byIssue['filename-as-alt']++;
                const context = createScreenReaderContext(
                    {
                        identifier: image.identifier,
                        spokenPhrases: image.spokenPhrases,
                        itemText: image.itemText,
                        axNode: image.axNode,
                    },
                    'graphics',
                    image.stepIndex,
                    ctx.screenReader
                );
                if (typeof image.backendNodeId === 'number') {
                    const filename = `${this.id}-${image.identifier}`;
                    context.screenshot = await captureScreenshotToFile(
                        page,
                        cdp,
                        image.backendNodeId,
                        screenshotsDir,
                        filename,
                        { label: `${this.id}: ${this.meta.summary}` }
                    );
                }
                violations.push(this.createViolation(image, context));
            }
        }

        return {
            violations,
            stats: {
                totalImages: uniqueImages.length,
                violationsFound: violations.length,
                byIssue,
            },
        };
    }

    private isFilenameAlt(text: string): boolean {
        return FILENAME_PATTERNS.some((pattern) => pattern.test(text));
    }

    private isStockPhotoId(text: string): boolean {
        return STOCK_PHOTO_PATTERNS.some((pattern) => pattern.test(text));
    }

    private deduplicateImages(images: ImageInfo[]): ImageInfo[] {
        const seen = new Set<string>();
        const unique: ImageInfo[] = [];

        for (const img of images) {
            const key = `${img.name}:${img.htmlSnippet ?? ''}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(img);
            }
        }

        return unique;
    }

    private createViolation(image: ImageInfo, context: ScreenReaderContext): ScreenReaderViolation {
        return {
            id: `filename-alt-${image.identifier}`,
            rule: {
                id: this.id,
                summary: this.meta.summary,
                wcag: this.meta.wcag,
                impact: this.meta.impact,
            },
            message: `Image has filename as alt text: "${image.name}". Alt text should describe the image content, not be a filename or auto-generated identifier.`,
            element: {
                ...(image.htmlSnippet != null && { htmlSnippet: image.htmlSnippet }),
            },
            tool: 'screen-reader-audit',
            timestamp: image.timestamp,
            context,
        };
    }
}

export const rule = new FilenameAsAltRule();
