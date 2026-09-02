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
    itemText: z.string(),
    axNode: promptAxNodeSchema.nullable(),
    htmlSnippet: z.string().nullable(),
});

export type PromptNavigationStep = z.infer<typeof promptNavigationStepSchema>;

export const navigationModeSchema = z.enum(['browse', 'focus']);

export type NavigationMode = z.infer<typeof navigationModeSchema>;

export const completionReasonKindSchema = z.enum(['exhausted', 'limit-reached', 'cycle-complete', 'trapped']);

export const completionReasonSchema = z.object({
    kind: completionReasonKindSchema,
    detail: z.string(),
});

export type CompletionReasonKind = z.infer<typeof completionReasonKindSchema>;
export type PromptCompletionReason = z.infer<typeof completionReasonSchema>;

export const promptStrategySectionSchema = z.object({
    strategyName: z.string(),
    strategyType: z.string(),
    description: z.string(),
    mode: navigationModeSchema,
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
    .describe('Evidence from the transcript supporting this finding');

export type LlmEvidence = z.infer<typeof llmEvidenceSchema>;

export const llmFindingSchema = z
    .object({
        category: findingCategorySchema,
        classification: findingClassificationSchema
            .optional()
            .describe(
                'Optional classification. Omit if unsure. Use contextually-acceptable ONLY with strong justification.'
            ),
        confidence: confidenceLevelSchema,
        issue: z.string().min(10).describe('Clear description of the accessibility issue found'),
        evidence: llmEvidenceSchema,
        stepsToReproduce: z
            .array(z.string())
            .min(1)
            .describe(
                'Step-by-step instructions to reproduce this issue using a screen reader. Include specific keys to press (e.g., "Press H to navigate to next heading", "Press Tab 5 times"). Reference exact step numbers from the transcript.'
            ),
        impact: z.string().min(10).describe('How this issue affects screen reader users in plain language'),
        relatedRuleId: z
            .string()
            .optional()
            .describe('Rule ID if this finding relates to an existing violation (e.g., "empty-accessible-name")'),
        semanticJustification: z
            .string()
            .optional()
            .describe(
                'REQUIRED if contextually-acceptable: strong justification why page context makes this okay. For llm-only-finding: why rules could not detect this.'
            ),
        requiresHumanReview: z.boolean().default(true).describe('Whether this finding needs human verification'),
    })
    .describe('An accessibility issue identified from transcript analysis');

export type LlmFinding = z.infer<typeof llmFindingSchema>;

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
        findings: z.array(llmFindingSchema).describe('List of accessibility issues found from transcript analysis'),
        summary: llmAnalysisSummarySchema,
        limitations: z
            .array(z.string())
            .describe(
                'What could not be determined from the transcript alone (e.g., "Cannot verify color contrast", "Visual layout unknown")'
            ),
    })
    .describe('Analysis of the screen reader transcript');

export type LlmAnalysisResponse = z.infer<typeof llmAnalysisResponseSchema>;

export const llmViolationEnhancementSchema = z
    .object({
        violationId: z.string().describe('The ID of the violation being enhanced (from the violations section)'),
        confidence: z
            .enum(['confirmed', 'likely', 'uncertain'])
            .describe(
                'Your confidence that this is a real issue: confirmed (clear evidence), likely (probable), uncertain (may be false positive)'
            ),
        severityRationale: z
            .string()
            .optional()
            .describe('Explanation of why this severity level is appropriate given the context'),
        remediationSuggestion: z.string().optional().describe('Specific code or content change to fix this issue'),
        userImpactDescription: z
            .string()
            .optional()
            .describe('How this specific issue affects users in plain language'),
        falsePositiveRisk: z
            .enum(['low', 'medium', 'high'])
            .describe(
                'Risk that this is a false positive: low (definitely an issue), medium (likely an issue), high (may not be an issue)'
            ),
    })
    .describe('Enhancement to an existing rule-based violation');

export type LlmViolationEnhancement = z.infer<typeof llmViolationEnhancementSchema>;

export const llmCompleteResponseSchema = z
    .object({
        analysis: llmAnalysisResponseSchema.describe('New findings from analyzing the screen reader transcript'),
        enhancements: z
            .array(llmViolationEnhancementSchema)
            .describe('Enhancements to the existing violations found by static analyzers'),
    })
    .describe('Complete accessibility analysis response');

export type LlmCompleteResponse = z.infer<typeof llmCompleteResponseSchema>;

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
