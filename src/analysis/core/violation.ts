export interface WcagCriterion {
    criterion: string;
    level: 'A' | 'AA' | 'AAA';
}

export type Impact = 'critical' | 'serious' | 'moderate' | 'minor';

export interface Violation<TContext = unknown> {
    id: string;
    rule: {
        id: string;
        summary: string;
        wcag: {
            primary: WcagCriterion;
            related?: WcagCriterion[];
        };
        impact: Impact;
    };
    element?: {
        selector?: string;
        htmlSnippet?: string;
    };
    message: string;
    tool: string;
    context: TContext;
    timestamp: number;
}

export interface NvdaContext {
    step: {
        strategy: string;
        index: number;
        id: string;
        spokenPhrase: string;
    };
    axNode?:
        | {
              nodeId: string;
              role?: string | undefined;
              name?: string | undefined;
              properties?: unknown | undefined;
          }
        | undefined;
    screenshot?:
        | {
              data: string;
              width: number;
              height: number;
          }
        | undefined;
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
    return violation.tool === 'nvda-audit' && violation.context != null && 'step' in (violation.context as object);
}
