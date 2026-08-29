/**
 * Analyzer: Image Alt Text
 *
 * Detects image alt text issues:
 * - Filename used as alt text (e.g., "IMG_1234.jpg")
 * - Suspicious auto-generated alt text patterns
 *
 * Maps to WCAG 1.1.1 (Non-text Content).
 */

import type { StrategyResult } from '../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';
import type { NvdaViolation, NvdaToolDetails } from '../violation';
import type { TranscriptContext } from '../context';
import { createToolDetails as buildToolDetails } from '../tool-details';
import { ruleMetadata } from '../rule-catalog';

type ImageIssue = 'filename-as-alt';

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

export interface ImageAltTextAnalyzerResult {
    violations: NvdaViolation[];
    summary: {
        totalImages: number;
        violationsFound: number;
        byIssue: Record<ImageIssue, number>;
    };
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
}

export function analyzeImageAltText({ strategyResults }: TranscriptContext): ImageAltTextAnalyzerResult {
    const violations: NvdaViolation[] = [];
    const byIssue: Record<ImageIssue, number> = {
        'filename-as-alt': 0,
    };

    // Collect all images from all strategies
    const images: ImageInfo[] = [];

    for (const result of strategyResults) {
        for (let stepIndex = 0; stepIndex < result.navigationSteps.length; stepIndex++) {
            const step = result.navigationSteps[stepIndex]!;
            const node = step.axNode;

            if (!node) continue;

            // Check for image role or img in HTML
            const isImage =
                node.role?.value === 'img' ||
                node.role?.value === 'image' ||
                step.htmlSnippet?.toLowerCase().includes('<img');

            if (!isImage) continue;

            const name = node.name?.value ?? '';

            images.push({
                name,
                stepIndex,
                htmlSnippet: step.htmlSnippet,
                spokenPhrases: step.spokenPhrases,
                itemText: step.itemText,
                identifier: step.identifier,
                timestamp: step.timestamp,
                axNode: node,
            });
        }
    }

    // Deduplicate images
    const uniqueImages = deduplicateImages(images);

    // Check: Filename as alt text
    for (const image of uniqueImages) {
        const name = image.name.trim();

        if (isFilenameAlt(name) || isStockPhotoId(name)) {
            byIssue['filename-as-alt']++;
            violations.push(createFilenameAltViolation(image));
        }
    }

    return {
        violations,
        summary: {
            totalImages: uniqueImages.length,
            violationsFound: violations.length,
            byIssue,
        },
    };
}

function isFilenameAlt(text: string): boolean {
    return FILENAME_PATTERNS.some((pattern) => pattern.test(text));
}

function isStockPhotoId(text: string): boolean {
    return STOCK_PHOTO_PATTERNS.some((pattern) => pattern.test(text));
}

function deduplicateImages(images: ImageInfo[]): ImageInfo[] {
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

function createToolDetails(image: ImageInfo): NvdaToolDetails {
    return buildToolDetails(image, 'graphics', image.stepIndex);
}

function createFilenameAltViolation(image: ImageInfo): NvdaViolation {
    return {
        id: `filename-alt-${image.identifier}`,
        ...ruleMetadata('filename-as-alt'),
        message: `Image has filename as alt text: "${image.name}". Alt text should describe the image content, not be a filename or auto-generated identifier.`,
        element: {
            htmlSnippet: image.htmlSnippet ?? undefined,
        },
        tool: 'nvda-audit',
        timestamp: image.timestamp,
        toolDetails: createToolDetails(image),
    };
}
