import type { Rule, RuleMeta, RuleResult } from '../../../core/rule';
import type { ScreenReaderContext, ScreenReaderViolation } from '../../../core/violation';
import type { AuditContext } from '../../../core/context';
import { buildViolation } from '../../rule-catalog';
import { createScreenReaderContext } from '../../../utils/tool-details';
import type { AXNode } from '../../../../types/cdp';
import { getRole, getName } from '../../../../types/ax-utils';

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

/**
 * Pattern to extract image name from NVDA spoken phrases.
 * NVDA announces images as "graphic, [alt text]" or just "graphic" if no alt.
 * This pattern captures the alt text after "graphic, " or "graphic " prefix.
 */
const GRAPHIC_ANNOUNCEMENT_PATTERN = /\bgraphic,?\s+(.+)/i;

interface FilenameAsAltStats {
    totalImages: number;
    violationsFound: number;
    byIssue: Record<'filename-as-alt', number>;
}

interface ImageInfo {
    name: string;
    stepIndex: number;
    htmlSnippet: string | null;
    spokenPhrases: string[];
    focusedElementText: string;
    identifier: string;
    timestamp: number;
    axNode: AXNode | undefined;
    backendNodeId?: number | undefined;
    strategyName: string;
}

class FilenameAsAltRule implements Rule<ScreenReaderContext, FilenameAsAltStats> {
    readonly id = 'filename-as-alt';

    readonly meta: RuleMeta = {
        wcag: {
            primary: { criterion: '1.1.1', level: 'A' },
        },
        summary: 'Image has a filename as alt text (e.g., "IMG_1234.jpg")',
    };

    async run(ctx: AuditContext): Promise<RuleResult<ScreenReaderContext, FilenameAsAltStats>> {
        const { transcript } = ctx;
        const violations: ScreenReaderViolation[] = [];
        const byIssue: Record<'filename-as-alt', number> = { 'filename-as-alt': 0 };

        const images: ImageInfo[] = [];

        for (const result of transcript) {
            const strategyName = result.meta.name;

            for (let stepIndex = 0; stepIndex < result.navigationSteps.length; stepIndex++) {
                const step = result.navigationSteps[stepIndex]!;
                const node = step.axNode;
                const role = node ? getRole(node) : undefined;

                // Method 1: Check AX node role
                const hasImageRole = role === 'img' || role === 'image';

                // Method 2: Check htmlSnippet for <img> tags
                const hasImgInSnippet = step.htmlSnippet?.toLowerCase().includes('<img');

                // Method 3: Check spoken phrases for "graphic" announcements (NVDA pattern)
                const graphicName = this.extractGraphicNameFromSpoken(step.spokenPhrases);

                if (hasImageRole || hasImgInSnippet || graphicName !== null) {
                    // Determine the image name from available sources
                    let imageName: string;
                    if (hasImageRole && node) {
                        imageName = getName(node) ?? '';
                    } else if (graphicName !== null) {
                        imageName = graphicName;
                    } else if (hasImgInSnippet && node) {
                        // For images inside links/buttons, try to get name from AX node
                        imageName = getName(node) ?? '';
                    } else if (hasImgInSnippet && step.htmlSnippet) {
                        // Extract alt from htmlSnippet as fallback
                        imageName = this.extractAltFromSnippet(step.htmlSnippet) ?? '';
                    } else {
                        imageName = '';
                    }

                    images.push({
                        name: imageName,
                        stepIndex,
                        htmlSnippet: step.htmlSnippet,
                        spokenPhrases: step.spokenPhrases,
                        focusedElementText: step.focusedElementText,
                        identifier: step.identifier,
                        timestamp: step.timestamp,
                        axNode: node,
                        backendNodeId: node?.backendDOMNodeId,
                        strategyName,
                    });
                }
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
                        focusedElementText: image.focusedElementText,
                        axNode: image.axNode,
                    },
                    image.strategyName,
                    image.stepIndex,
                    ctx.screenReader
                );
                violations.push(
                    buildViolation({
                        ruleId: 'filename-as-alt',
                        impact: 'serious',
                        stepId: `filename-as-alt-${image.identifier}`,
                        message: `Image has a filename as alt text: "${image.name}". Alt text should describe the image's purpose or content, not the file name.`,
                        timestamp: image.timestamp,
                        context,
                        htmlSnippet: image.htmlSnippet,
                        screenReader: ctx.screenReader,
                    })
                );
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

    /**
     * Extract image name from NVDA spoken phrases.
     * NVDA announces images as "graphic, [alt text]" or "graphic [alt text]".
     * Returns the extracted name, or null if no graphic announcement found.
     */
    private extractGraphicNameFromSpoken(spokenPhrases: string[]): string | null {
        for (const phrase of spokenPhrases) {
            const match = GRAPHIC_ANNOUNCEMENT_PATTERN.exec(phrase);
            if (match && match[1]) {
                // Clean up the extracted name - remove trailing punctuation, "link", etc.
                let name = match[1].trim();
                // Remove common suffixes that are role announcements, not alt text
                name = name.replace(/,?\s*(link|button|clickable)$/i, '').trim();
                return name;
            }
        }
        return null;
    }

    /**
     * Extract alt attribute value from an HTML snippet containing an <img> tag.
     */
    private extractAltFromSnippet(snippet: string): string | null {
        const altMatch = /alt=["']([^"']*)["']/i.exec(snippet);
        return altMatch ? (altMatch[1] ?? null) : null;
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
}

export const rule = new FilenameAsAltRule();
