/**
 * Unified violation interface for accessibility findings.
 * Tool-agnostic abstraction that preserves tool-specific details.
 */

export interface WcagCriterion {
    criterion: string; // e.g., "4.1.2"
    level: 'A' | 'AA' | 'AAA';
}

export interface Violation<TDetails = unknown> {
    /** Unique identifier for this violation instance */
    id: string;

    /** Rule identifier, e.g., "empty-accessible-name", "heading-order" */
    ruleId: string;

    /** WCAG mapping */
    wcag: {
        primary: WcagCriterion;
        related?: WcagCriterion[];
    };

    /** Tool-native severity (e.g., "serious", "violation", "error") */
    impact: string;

    /** Human-readable description of the issue */
    message: string;

    /** Element location */
    element: {
        htmlSnippet?: string | undefined;
        selector?: string | undefined;
    };

    /** Tool identification */
    tool: string;
    toolVersion?: string;

    /** When the violation was detected */
    timestamp: number;

    /** Tool-specific details - full context preserved */
    toolDetails: TDetails;
}

/** NVDA-specific violation details */
export interface NvdaToolDetails {
    spokenPhrases: string[];
    itemText: string;
    navigationStrategy: string;
    stepIndex: number;
    axNode?:
        | {
              nodeId: string;
              role?: string | undefined;
              name?: string | undefined;
              properties?: unknown | undefined;
          }
        | undefined;
}

export type NvdaViolation = Violation<NvdaToolDetails>;
