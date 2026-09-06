import type { LlmCompleteResponse } from '../llm/prompt-builder';
import type { Violation } from '../analysis/core/violation';
import type { StrategyResult } from '../screen-reader/strategies/navigation-strategy';

export interface ReportMeta {
    timestamp: number;
    duration?: number;
    toolVersion?: string;
    strategies?: string[];
}

export interface ReportData {
    analysis: LlmCompleteResponse;
    /** Screenshots embedded in context for screen reader violations */
    violations: Violation[];
    transcript?: StrategyResult[] | undefined;
    meta: ReportMeta;
}

export interface ReportOutput {
    format: string;
    content: string;
    filename: string;
    mimeType: string;
}

export interface ReporterOptions {
    includeTranscript?: boolean;
    includeHtmlSnippets?: boolean;
    title?: string;
    screenshotsBasePath?: string;
}

export interface Reporter {
    readonly name: string;
    generate(data: ReportData, options?: ReporterOptions): Promise<ReportOutput>;
}

export function generateFilename(prefix: string, extension: string): string {
    const date = new Date();
    const timestamp = date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `${prefix}-${timestamp}.${extension}`;
}

export function formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
}

export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
}
