import { z } from 'zod';

function stripUndefined<T extends object>(obj: T): Partial<T> {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export const promptAxNodePropertiesSchema = z.object({
    focusable: z.boolean().optional(),
    focused: z.boolean().optional(),
    disabled: z.boolean().optional(),
    expanded: z.boolean().optional(),
    selected: z.boolean().optional(),
    checked: z.union([z.boolean(), z.literal('mixed')]).optional(),
    level: z.number().optional(),
    required: z.boolean().optional(),
    invalid: z.boolean().optional(),
});

export type PromptAxNodeProperties = z.infer<typeof promptAxNodePropertiesSchema>;

export const promptAxNodeSchema = z.object({
    role: z.string(),
    name: z.string(),
    description: z.string().optional(),
    value: z.string().optional(),
    properties: promptAxNodePropertiesSchema.optional(),
});

export type PromptAxNode = z.infer<typeof promptAxNodeSchema>;

export const promptNavigationStepSchema = z.object({
    index: z.number().int().nonnegative(),
    identifier: z.string(),
    spoken: z.string(),
    focusedElementText: z.string(),
    axNode: promptAxNodeSchema.nullable(),
    htmlSnippet: z.string().nullable(),
});

export type PromptNavigationStep = z.infer<typeof promptNavigationStepSchema>;

const completionReasonKindSchema = z.enum(['exhausted', 'limit-reached', 'cycle-complete', 'trapped']);

const completionReasonSchema = z.object({
    kind: completionReasonKindSchema,
    detail: z.string(),
});

export const promptStrategySectionSchema = z.object({
    strategyName: z.string(),
    description: z.string(),
    completionReason: completionReasonSchema,
    totalSteps: z.number().int().nonnegative(),
    steps: z.array(promptNavigationStepSchema),
});

export type PromptStrategySection = z.infer<typeof promptStrategySectionSchema>;

export const promptTranscriptSchema = z.object({
    sections: z.array(promptStrategySectionSchema),
    totalStrategies: z.number().int().nonnegative(),
    totalSteps: z.number().int().nonnegative(),
});

export type PromptTranscript = z.infer<typeof promptTranscriptSchema>;

export const transcriptCorrelationSchema = z.object({
    strategyName: z.string(),
    stepIndex: z.number().int().nonnegative(),
    spoken: z.string(),
    confidence: z.enum(['high', 'medium', 'low']),
});

export type TranscriptCorrelation = z.infer<typeof transcriptCorrelationSchema>;

export const promptViolationSchema = z.object({
    id: z.string(),
    ruleId: z.string(),
    wcag: z.string(),
    wcagLevel: z.enum(['A', 'AA', 'AAA']),
    impact: z.string(),
    message: z.string(),
    selector: z.string().optional(),
    htmlSnippet: z.string().optional(),
    correlation: transcriptCorrelationSchema.optional(),
});

export type PromptViolation = z.infer<typeof promptViolationSchema>;

export const promptViolationGroupSchema = z.object({
    ruleId: z.string(),
    wcag: z.string(),
    wcagLevel: z.enum(['A', 'AA', 'AAA']),
    impact: z.string(),
    count: z.number().int().positive(),
    violations: z.array(promptViolationSchema),
});

export type PromptViolationGroup = z.infer<typeof promptViolationGroupSchema>;

export const promptViolationsDataSchema = z.object({
    groups: z.array(promptViolationGroupSchema),
    totalViolations: z.number().int().nonnegative(),
    totalRules: z.number().int().nonnegative(),
    byImpact: z.record(z.string(), z.number().int().nonnegative()),
});

export type PromptViolationsData = z.infer<typeof promptViolationsDataSchema>;

export const findingCategorySchema = z
    .enum(['reading-order', 'cognitive', 'semantic', 'consistency', 'context'])
    .describe('Category of accessibility issue identified');

export type FindingCategory = z.infer<typeof findingCategorySchema>;

export const findingClassificationSchema = z
    .enum(['confirmed', 'contextually-acceptable', 'llm-only-finding'])
    .describe(
        'Classification: confirmed (rule finding verified), contextually-acceptable (rule flagged but context makes it okay - USE SPARINGLY), llm-only-finding (semantic issue rules missed)'
    );

export type FindingClassification = z.infer<typeof findingClassificationSchema>;

export const confidenceLevelSchema = z
    .enum(['high', 'medium', 'low'])
    .describe('How confident you are in this finding based on transcript evidence');

export type ConfidenceLevel = z.infer<typeof confidenceLevelSchema>;

export const falsePositiveRiskSchema = z
    .enum(['low', 'medium', 'high'])
    .describe(
        'Risk that this is a false positive: low (definitely an issue), medium (likely an issue), high (may not be an issue)'
    );

export type FalsePositiveRisk = z.infer<typeof falsePositiveRiskSchema>;

export const llmIssueTypeSchema = z
    .enum(['finding', 'enhancement'])
    .describe('Type of issue: finding (new issue discovered by LLM) or enhancement (augments existing rule violation)');

export type LlmIssueType = z.infer<typeof llmIssueTypeSchema>;

export const llmEvidenceStepSchema = z
    .object({
        strategy: z.string().describe('The navigation strategy name (e.g. "tab", "heading", "link", "landmark")'),
        stepIndex: z.number().int().nonnegative().describe('0-based index of the step within the strategy'),
        identifier: z
            .string()
            .describe('Stable UUID identifier for the step, from the id attribute in the transcript XML'),
        spokenPhrase: z.string().describe('Exact spoken phrase from the transcript step. Quote verbatim.'),
    })
    .describe('Reference to a transcript step with its spoken phrase');

export type LlmEvidenceStep = z.infer<typeof llmEvidenceStepSchema>;

export const llmEvidenceSchema = z
    .object({
        steps: z
            .array(llmEvidenceStepSchema)
            .min(1)
            .describe(
                'Transcript steps that support this finding, each with strategy, index, identifier, and spoken phrase.'
            ),
        pattern: z.string().optional().describe('Description of the pattern if this finding spans multiple steps'),
    })
    .describe('Evidence from the transcript supporting this issue');

export type LlmEvidence = z.infer<typeof llmEvidenceSchema>;

/**
 * Unified schema for LLM-identified accessibility issues.
 *
 * Two types:
 * - `finding`: New issue discovered by LLM (not found by rules)
 * - `enhancement`: Augments an existing rule-based violation with additional context
 *
 * Field applicability:
 * - `violationId`: Required for enhancements, absent for findings
 * - `category`: Required for findings, absent for enhancements
 * - `classification`: Optional, primarily for findings
 * - `severityRationale`: Optional, primarily for enhancements
 */
export const llmIssueSchema = z
    .object({
        // Discriminator
        type: llmIssueTypeSchema,

        // Identity - one of these identifies what this issue is about
        violationId: z
            .string()
            .optional()
            .describe(
                'For enhancements: The ID of the rule violation being enhanced (from the violations section). Absent for findings.'
            ),
        category: findingCategorySchema
            .optional()
            .describe(
                'For findings: Category of accessibility issue (reading-order, cognitive, semantic, consistency, context). Absent for enhancements.'
            ),

        // Core fields (present on both types)
        confidence: confidenceLevelSchema,
        issue: z.string().min(10).describe('Clear description of the accessibility issue'),
        evidence: llmEvidenceSchema,
        stepsToReproduce: z
            .array(z.string())
            .min(1)
            .describe(
                'Step-by-step instructions to reproduce this issue using a screen reader. Include specific keys to press (e.g., "Press H to navigate to next heading", "Press Tab 5 times"). Reference exact step numbers from the transcript.'
            ),
        impact: z.string().min(10).describe('How this issue affects screen reader users in plain language'),
        remediationSuggestion: z
            .string()
            .optional()
            .describe('Specific code or content change to fix this issue'),

        // Finding-specific fields
        classification: findingClassificationSchema
            .optional()
            .describe(
                'For findings: Optional classification. Use contextually-acceptable ONLY with strong justification.'
            ),
        semanticJustification: z
            .string()
            .optional()
            .describe(
                'For findings: REQUIRED if contextually-acceptable. Explains why page context makes this okay, or why rules could not detect this.'
            ),
        relatedRuleId: z
            .string()
            .optional()
            .describe(
                'For findings: Rule ID if this finding relates to an existing rule (e.g., "empty-accessible-name"), but is not directly enhancing a specific violation.'
            ),
        requiresHumanReview: z
            .boolean()
            .default(true)
            .describe('Whether this issue needs human verification. Defaults to true.'),

        // Enhancement-specific fields
        severityRationale: z
            .string()
            .optional()
            .describe(
                'For enhancements: Explanation of why the severity level is appropriate given the context'
            ),
        falsePositiveRisk: falsePositiveRiskSchema
            .optional()
            .describe(
                'For enhancements: Risk that this is a false positive. Required for enhancements.'
            ),
    })
    .describe('An accessibility issue identified by LLM analysis - either a new finding or an enhancement to a rule violation');

export type LlmIssue = z.infer<typeof llmIssueSchema>;

// Type guards for discriminating issue types
export function isLlmFinding(issue: LlmIssue): issue is LlmIssue & { type: 'finding'; category: FindingCategory } {
    return issue.type === 'finding';
}

export function isLlmEnhancement(issue: LlmIssue): issue is LlmIssue & { type: 'enhancement'; violationId: string } {
    return issue.type === 'enhancement';
}

// Legacy type aliases for backward compatibility during migration
/** @deprecated Use LlmIssue with type: 'finding' instead */
export type LlmFinding = LlmIssue & { type: 'finding'; category: FindingCategory };
/** @deprecated Use LlmIssue with type: 'enhancement' instead */
export type LlmViolationEnhancement = LlmIssue & { type: 'enhancement'; violationId: string };

export const overallAssessmentSchema = z
    .enum(['good', 'needs-review', 'problematic'])
    .describe(
        'Overall accessibility assessment: good (minor/no issues), needs-review (some concerns), problematic (significant barriers)'
    );

export type OverallAssessment = z.infer<typeof overallAssessmentSchema>;

export const llmAnalysisSummarySchema = z
    .object({
        stepsToMainContent: z
            .number()
            .int()
            .nonnegative()
            .nullable()
            .describe(
                'Number of Tab presses or navigation steps to reach the main content. Null if main landmark not found.'
            ),
        totalSteps: z
            .number()
            .int()
            .nonnegative()
            .describe('Total number of navigation steps analyzed across all strategies'),
        majorConcerns: z.array(z.string()).describe('List of the most significant accessibility concerns found'),
        overallAssessment: overallAssessmentSchema,
    })
    .describe('Summary of the accessibility analysis');

export type LlmAnalysisSummary = z.infer<typeof llmAnalysisSummarySchema>;

export const llmAnalysisResponseSchema = z
    .object({
        issues: z
            .array(llmIssueSchema)
            .describe(
                'All accessibility issues: both new findings (type: "finding") and enhancements to existing violations (type: "enhancement")'
            ),
        summary: llmAnalysisSummarySchema,
        limitations: z
            .array(z.string())
            .describe(
                'What could not be determined from the transcript alone (e.g., "Cannot verify color contrast", "Visual layout unknown")'
            ),
    })
    .describe('Complete LLM accessibility analysis');

export type LlmAnalysisResponse = z.infer<typeof llmAnalysisResponseSchema>;

export const llmCompleteResponseSchema = llmAnalysisResponseSchema.describe('Complete accessibility analysis response');

export type LlmCompleteResponse = z.infer<typeof llmCompleteResponseSchema>;

// Helper functions to filter issues by type
export function getFindings(response: LlmCompleteResponse): LlmFinding[] {
    return response.issues.filter(isLlmFinding);
}

export function getEnhancements(response: LlmCompleteResponse): LlmViolationEnhancement[] {
    return response.issues.filter(isLlmEnhancement);
}

export const transcriptSectionConfigSchema = z.object({
    includeHtmlSnippets: z.boolean().optional(),
    includeAxNodes: z.boolean().optional(),
    maxHtmlSnippetLength: z.number().int().positive().optional(),
    includeStrategies: z.array(z.string()).optional(),
    excludeStrategies: z.array(z.string()).optional(),
});

export type TranscriptSectionConfig = z.infer<typeof transcriptSectionConfigSchema>;

export interface ResolvedTranscriptConfig {
    includeHtmlSnippets: boolean;
    includeAxNodes: boolean;
    maxHtmlSnippetLength: number;
    includeStrategies: string[];
    excludeStrategies: string[];
}

export const TRANSCRIPT_CONFIG_DEFAULTS: ResolvedTranscriptConfig = {
    includeHtmlSnippets: true,
    includeAxNodes: true,
    maxHtmlSnippetLength: 500,
    includeStrategies: [],
    excludeStrategies: [],
};

export function mergeTranscriptConfig(config: TranscriptSectionConfig = {}): ResolvedTranscriptConfig {
    return { ...TRANSCRIPT_CONFIG_DEFAULTS, ...stripUndefined(config) } as ResolvedTranscriptConfig;
}

export const violationsSectionConfigSchema = z.object({
    includeHtmlSnippets: z.boolean().optional(),
    maxHtmlSnippetLength: z.number().int().positive().optional(),
    includeCorrelations: z.boolean().optional(),
    groupByRule: z.boolean().optional(),
    maxViolationsPerGroup: z.number().int().nonnegative().optional(),
    includeImpacts: z.array(z.string()).optional(),
    includeRules: z.array(z.string()).optional(),
});

export type ViolationsSectionConfig = z.infer<typeof violationsSectionConfigSchema>;

export interface ResolvedViolationsConfig {
    includeHtmlSnippets: boolean;
    maxHtmlSnippetLength: number;
    includeCorrelations: boolean;
    groupByRule: boolean;
    maxViolationsPerGroup: number;
    includeImpacts: string[];
    includeRules: string[];
}

export const VIOLATIONS_CONFIG_DEFAULTS: ResolvedViolationsConfig = {
    includeHtmlSnippets: true,
    maxHtmlSnippetLength: 300,
    includeCorrelations: true,
    groupByRule: true,
    maxViolationsPerGroup: 5,
    includeImpacts: [],
    includeRules: [],
};

export function mergeViolationsConfig(config: ViolationsSectionConfig = {}): ResolvedViolationsConfig {
    return { ...VIOLATIONS_CONFIG_DEFAULTS, ...stripUndefined(config) } as ResolvedViolationsConfig;
}

export function parseLlmResponse(json: unknown): LlmCompleteResponse {
    return llmCompleteResponseSchema.parse(json);
}

export function safeParseLlmResponse(json: unknown) {
    return llmCompleteResponseSchema.safeParse(json);
}

export function getLlmOutputJsonSchema(): object {
    return z.toJSONSchema(llmCompleteResponseSchema);
}
