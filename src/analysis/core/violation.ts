export interface WcagCriterion {
    criterion: string;
    level: 'A' | 'AA' | 'AAA';
}

export type Impact = 'critical' | 'serious' | 'moderate' | 'minor';

type Rule = {
    id: string;
    summary: string;
    wcag: {
        primary: WcagCriterion;
        related?: WcagCriterion[];
    };
    impact: Impact;
};

export interface Violation<TContext = unknown> {
    id: string;
    rule: Rule;
    element?: {
        selector?: string;
        htmlSnippet?: string;
    };
    message: string;
    tool: string;
    context: TContext;
    timestamp: number;
}

export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface ScreenshotSuccess {
    path: string;
    width: number;
    height: number;
    /** Bounding box of the highlighted element within the screenshot (viewport coordinates) */
    elementBounds?: BoundingBox;
}

export interface ScreenshotFailure {
    error: string;
    backendNodeId: number;
    boundingBox: BoundingBox | null;
    viewport: { width: number; height: number } | null;
}

export type Screenshot = ScreenshotSuccess | ScreenshotFailure;

/** Type guard to check if screenshot capture succeeded */
export function isScreenshotSuccess(screenshot: Screenshot): screenshot is ScreenshotSuccess {
    return 'path' in screenshot;
}

export interface NvdaContext {
    source: {
        strategy: string;
        stepIndex: number;
        stepId: string;
        spokenPhrase: string;
    };
    axNode?: {
        nodeId: string;
        role?: string;
        name?: string;
        properties?: unknown;
    };
    screenshot?: Screenshot;
}

export type NvdaViolation = Violation<NvdaContext>;

export interface AxeNode {
    html: string;
    target: string[];
    failureSummary?: string | undefined;
}

export interface AxeContext {
    nodes: AxeNode[];
    tags: string[];
}

export type AxeViolation = Violation<AxeContext>;

export function isNvdaViolation(violation: Violation): violation is NvdaViolation {
    return violation.tool === 'nvda-audit' && violation.context != null && 'source' in (violation.context as object);
}
