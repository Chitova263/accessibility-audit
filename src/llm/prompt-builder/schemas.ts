import { z } from 'zod';

// =============================================================================
// INPUT SCHEMAS - Data going INTO the prompt
// =============================================================================

/**
 * Simplified AX node properties for prompt inclusion.
 */
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

/**
 * Simplified AX node for prompt inclusion.
 */
export const promptAxNodeSchema = z.object({
    role: z.string(),
    name: z.string(),
    description: z.string().optional(),
    value: z.string().optional(),
    properties: promptAxNodePropertiesSchema.optional(),
});

export type PromptAxNode = z.infer<typeof promptAxNodeSchema>;

/**
 * A single navigation step formatted for prompt inclusion.
 */
export const promptNavigationStepSchema = z.object({
    index: z.number().int().nonnegative(),
    identifier: z.string(),
    spoken: z.string(),
    itemText: z.string(),
    axNode: promptAxNodeSchema.nullable(),
    htmlSnippet: z.string().nullable(),
});

export type PromptNavigationStep = z.infer<typeof promptNavigationStepSchema>;

/**
 * Navigation mode.
 */
export const navigationModeSchema = z.enum(['browse', 'focus']);

export type NavigationMode = z.infer<typeof navigationModeSchema>;

/**
 * A strategy's transcript section for the prompt.
 */
export const promptStrategySectionSchema = z.object({
    strategyName: z.string(),
    strategyType: z.string(),
    description: z.string(),
    mode: navigationModeSchema,
    completionReason: z.string(),
    totalSteps: z.number().int().nonnegative(),
    steps: z.array(promptNavigationStepSchema),
});

export type PromptStrategySection = z.infer<typeof promptStrategySectionSchema>;

/**
 * Complete transcript data for prompt building.
 */
export const promptTranscriptSchema = z.object({
    sections: z.array(promptStrategySectionSchema),
    totalStrategies: z.number().int().nonnegative(),
    totalSteps: z.number().int().nonnegative(),
});

export type PromptTranscript = z.infer<typeof promptTranscriptSchema>;

/**
 * Transcript correlation for violations.
 */
export const transcriptCorrelationSchema = z.object({
    strategyName: z.string(),
    stepIndex: z.number().int().nonnegative(),
    spoken: z.string(),
    confidence: z.enum(['high', 'medium', 'low']),
});

export type TranscriptCorrelation = z.infer<typeof transcriptCorrelationSchema>;

/**
 * A violation formatted for prompt inclusion.
 */
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

/**
 * Violations grouped by rule for the prompt.
 */
export const promptViolationGroupSchema = z.object({
    ruleId: z.string(),
    wcag: z.string(),
    wcagLevel: z.enum(['A', 'AA', 'AAA']),
    impact: z.string(),
    count: z.number().int().positive(),
    violations: z.array(promptViolationSchema),
});

export type PromptViolationGroup = z.infer<typeof promptViolationGroupSchema>;

/**
 * Complete violations data for prompt building.
 */
export const promptViolationsDataSchema = z.object({
    groups: z.array(promptViolationGroupSchema),
    totalViolations: z.number().int().nonnegative(),
    totalRules: z.number().int().nonnegative(),
    byImpact: z.record(z.string(), z.number().int().nonnegative()),
});

export type PromptViolationsData = z.infer<typeof promptViolationsDataSchema>;

// =============================================================================
// OUTPUT SCHEMAS - Data coming FROM the LLM
// =============================================================================

/**
 * Categories of findings the LLM can identify.
 */
export const findingCategorySchema = z
    .enum(['reading-order', 'cognitive', 'semantic', 'consistency', 'context'])
    .describe('Category of accessibility issue identified');

export type FindingCategory = z.infer<typeof findingCategorySchema>;

/**
 * Classification of finding source/validity.
 * - confirmed: Rule finding verified as genuinely problematic
 * - contextually-acceptable: Rule flagged but page context makes it acceptable (requires strong justification)
 * - llm-only-finding: Semantic issue that no rule could detect
 */
export const findingClassificationSchema = z
    .enum(['confirmed', 'contextually-acceptable', 'llm-only-finding'])
    .describe(
        'Classification: confirmed (rule finding verified), contextually-acceptable (rule flagged but context makes it okay - USE SPARINGLY), llm-only-finding (semantic issue rules missed)'
    );

export type FindingClassification = z.infer<typeof findingClassificationSchema>;

/**
 * Confidence level for LLM findings.
 */
export const confidenceLevelSchema = z
    .enum(['high', 'medium', 'low'])
    .describe('How confident you are in this finding based on transcript evidence');

export type ConfidenceLevel = z.infer<typeof confidenceLevelSchema>;

/**
 * A reference to a specific step in the transcript, unambiguously identified
 * by both its navigation strategy and its position/identifier within that strategy.
 */
export const llmStepReferenceSchema = z
    .object({
        /** Name of the navigation strategy (e.g. "tab", "heading", "link") */
        strategy: z.string().describe('The navigation strategy name (e.g. "tab", "heading", "link", "landmark")'),
        /** 0-based index of the step within that strategy */
        stepIndex: z.number().int().nonnegative().describe('0-based index of the step within the strategy'),
        /** Stable UUID identifier for the step, from the id attribute in the transcript XML */
        identifier: z
            .string()
            .describe('Stable UUID identifier for the step, from the id attribute in the transcript XML'),
    })
    .describe('Unambiguous reference to a single step in the transcript');

export type LlmStepReference = z.infer<typeof llmStepReferenceSchema>;

/**
 * Evidence supporting an LLM finding.
 */
export const llmEvidenceSchema = z
    .object({
        /** Exact phrases from the transcript */
        phrases: z
            .array(z.string())
            .min(1)
            .describe('Exact phrases from the transcript that support this finding. Quote verbatim.'),
        /** Rich references to the transcript steps where the evidence was found */
        positions: z
            .array(llmStepReferenceSchema)
            .min(1)
            .describe(
                'References to the transcript steps where the evidence was found. Each entry identifies the strategy, step index, and stable step identifier.'
            ),
        /** Optional pattern description */
        pattern: z.string().optional().describe('Description of the pattern if this finding spans multiple steps'),
    })
    .describe('Evidence from the transcript supporting this finding');

export type LlmEvidence = z.infer<typeof llmEvidenceSchema>;

/**
 * A single finding from the LLM analysis.
 */
export const llmFindingSchema = z
    .object({
        /** Finding category */
        category: findingCategorySchema,
        /** Classification of finding source/validity (optional - omit if unsure) */
        classification: findingClassificationSchema
            .optional()
            .describe(
                'Optional classification. Omit if unsure. Use contextually-acceptable ONLY with strong justification.'
            ),
        /** LLM's confidence in this finding */
        confidence: confidenceLevelSchema,
        /** Description of the issue */
        issue: z.string().min(10).describe('Clear description of the accessibility issue found'),
        /** Evidence from the transcript */
        evidence: llmEvidenceSchema,
        /** Plain language impact on users */
        impact: z.string().min(10).describe('How this issue affects screen reader users in plain language'),
        /** If this relates to a rule-based finding */
        relatedRuleId: z
            .string()
            .optional()
            .describe('Rule ID if this finding relates to an existing violation (e.g., "empty-accessible-name")'),
        /** Semantic justification - REQUIRED if classification is contextually-acceptable */
        semanticJustification: z
            .string()
            .optional()
            .describe(
                'REQUIRED if contextually-acceptable: strong justification why page context makes this okay. For llm-only-finding: why rules could not detect this.'
            ),
        /** If more context (HTML, visual) is needed to confirm */
        requiresHumanReview: z.boolean().default(true).describe('Whether this finding needs human verification'),
    })
    .describe('An accessibility issue identified from transcript analysis');

export type LlmFinding = z.infer<typeof llmFindingSchema>;

/**
 * Overall assessment from the LLM.
 */
export const overallAssessmentSchema = z
    .enum(['good', 'needs-review', 'problematic'])
    .describe(
        'Overall accessibility assessment: good (minor/no issues), needs-review (some concerns), problematic (significant barriers)'
    );

export type OverallAssessment = z.infer<typeof overallAssessmentSchema>;

/**
 * Summary of the LLM analysis.
 */
export const llmAnalysisSummarySchema = z
    .object({
        /** Steps to reach main content (efficiency metric) */
        stepsToMainContent: z
            .number()
            .int()
            .nonnegative()
            .nullable()
            .describe(
                'Number of Tab presses or navigation steps to reach the main content. Null if main landmark not found.'
            ),
        /** Total steps analyzed */
        totalSteps: z
            .number()
            .int()
            .nonnegative()
            .describe('Total number of navigation steps analyzed across all strategies'),
        /** High-level concerns */
        majorConcerns: z.array(z.string()).describe('List of the most significant accessibility concerns found'),
        /** Overall assessment */
        overallAssessment: overallAssessmentSchema,
    })
    .describe('Summary of the accessibility analysis');

export type LlmAnalysisSummary = z.infer<typeof llmAnalysisSummarySchema>;

/**
 * Complete LLM analysis response.
 */
export const llmAnalysisResponseSchema = z
    .object({
        /** Individual findings */
        findings: z.array(llmFindingSchema).describe('List of accessibility issues found from transcript analysis'),
        /** Summary of the analysis */
        summary: llmAnalysisSummarySchema,
        /** What the LLM couldn't determine */
        limitations: z
            .array(z.string())
            .describe(
                'What could not be determined from the transcript alone (e.g., "Cannot verify color contrast", "Visual layout unknown")'
            ),
    })
    .describe('Analysis of the screen reader transcript');

export type LlmAnalysisResponse = z.infer<typeof llmAnalysisResponseSchema>;

/**
 * LLM enhancement to a rule-based violation.
 */
export const llmViolationEnhancementSchema = z
    .object({
        /** Original violation ID */
        violationId: z.string().describe('The ID of the violation being enhanced (from the violations section)'),
        /** LLM's assessment of the finding */
        confidence: z
            .enum(['confirmed', 'likely', 'uncertain'])
            .describe(
                'Your confidence that this is a real issue: confirmed (clear evidence), likely (probable), uncertain (may be false positive)'
            ),
        /** Why this severity level is appropriate */
        severityRationale: z
            .string()
            .optional()
            .describe('Explanation of why this severity level is appropriate given the context'),
        /** Specific fix suggestion */
        remediationSuggestion: z.string().optional().describe('Specific code or content change to fix this issue'),
        /** Plain language user impact */
        userImpactDescription: z
            .string()
            .optional()
            .describe('How this specific issue affects users in plain language'),
        /** Risk this is a false positive */
        falsePositiveRisk: z
            .enum(['low', 'medium', 'high'])
            .describe(
                'Risk that this is a false positive: low (definitely an issue), medium (likely an issue), high (may not be an issue)'
            ),
    })
    .describe('Enhancement to an existing rule-based violation');

export type LlmViolationEnhancement = z.infer<typeof llmViolationEnhancementSchema>;

/**
 * Complete LLM response including findings and enhancements.
 */
export const llmCompleteResponseSchema = z
    .object({
        /** Analysis of the transcript */
        analysis: llmAnalysisResponseSchema.describe('New findings from analyzing the screen reader transcript'),
        /** Enhancements to rule-based violations */
        enhancements: z
            .array(llmViolationEnhancementSchema)
            .describe('Enhancements to the existing violations found by static analyzers'),
    })
    .describe('Complete accessibility analysis response');

export type LlmCompleteResponse = z.infer<typeof llmCompleteResponseSchema>;

// =============================================================================
// CONFIG SCHEMAS
// =============================================================================

/**
 * Configuration for transcript section building.
 */
export const transcriptSectionConfigSchema = z.object({
    includeHtmlSnippets: z.boolean().optional(),
    includeAxNodes: z.boolean().optional(),
    maxHtmlSnippetLength: z.number().int().positive().optional(),
    includeStrategies: z.array(z.string()).optional(),
    excludeStrategies: z.array(z.string()).optional(),
});

export type TranscriptSectionConfig = z.infer<typeof transcriptSectionConfigSchema>;

/** Resolved transcript config with all values filled */
export interface ResolvedTranscriptConfig {
    includeHtmlSnippets: boolean;
    includeAxNodes: boolean;
    maxHtmlSnippetLength: number;
    includeStrategies: string[];
    excludeStrategies: string[];
}

/** Default values for transcript section config */
export const TRANSCRIPT_CONFIG_DEFAULTS: ResolvedTranscriptConfig = {
    includeHtmlSnippets: true,
    includeAxNodes: true,
    maxHtmlSnippetLength: 500,
    includeStrategies: [],
    excludeStrategies: [],
};

/** Merge user config with defaults for transcript section */
export function mergeTranscriptConfig(config: TranscriptSectionConfig = {}): ResolvedTranscriptConfig {
    return {
        includeHtmlSnippets: config.includeHtmlSnippets ?? TRANSCRIPT_CONFIG_DEFAULTS.includeHtmlSnippets,
        includeAxNodes: config.includeAxNodes ?? TRANSCRIPT_CONFIG_DEFAULTS.includeAxNodes,
        maxHtmlSnippetLength: config.maxHtmlSnippetLength ?? TRANSCRIPT_CONFIG_DEFAULTS.maxHtmlSnippetLength,
        includeStrategies: config.includeStrategies ?? TRANSCRIPT_CONFIG_DEFAULTS.includeStrategies,
        excludeStrategies: config.excludeStrategies ?? TRANSCRIPT_CONFIG_DEFAULTS.excludeStrategies,
    };
}

/**
 * Configuration for violations section building.
 */
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

/** Resolved violations config with all values filled */
export interface ResolvedViolationsConfig {
    includeHtmlSnippets: boolean;
    maxHtmlSnippetLength: number;
    includeCorrelations: boolean;
    groupByRule: boolean;
    maxViolationsPerGroup: number;
    includeImpacts: string[];
    includeRules: string[];
}

/** Default values for violations section config */
export const VIOLATIONS_CONFIG_DEFAULTS: ResolvedViolationsConfig = {
    includeHtmlSnippets: true,
    maxHtmlSnippetLength: 300,
    includeCorrelations: true,
    groupByRule: true,
    maxViolationsPerGroup: 5,
    includeImpacts: [],
    includeRules: [],
};

/** Merge user config with defaults for violations section */
export function mergeViolationsConfig(config: ViolationsSectionConfig = {}): ResolvedViolationsConfig {
    return {
        includeHtmlSnippets: config.includeHtmlSnippets ?? VIOLATIONS_CONFIG_DEFAULTS.includeHtmlSnippets,
        maxHtmlSnippetLength: config.maxHtmlSnippetLength ?? VIOLATIONS_CONFIG_DEFAULTS.maxHtmlSnippetLength,
        includeCorrelations: config.includeCorrelations ?? VIOLATIONS_CONFIG_DEFAULTS.includeCorrelations,
        groupByRule: config.groupByRule ?? VIOLATIONS_CONFIG_DEFAULTS.groupByRule,
        maxViolationsPerGroup: config.maxViolationsPerGroup ?? VIOLATIONS_CONFIG_DEFAULTS.maxViolationsPerGroup,
        includeImpacts: config.includeImpacts ?? VIOLATIONS_CONFIG_DEFAULTS.includeImpacts,
        includeRules: config.includeRules ?? VIOLATIONS_CONFIG_DEFAULTS.includeRules,
    };
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Parse and validate LLM response.
 * Returns typed result or throws with descriptive error.
 */
export function parseLlmResponse(json: unknown): LlmCompleteResponse {
    return llmCompleteResponseSchema.parse(json);
}

/**
 * Safely parse LLM response without throwing.
 */
export function safeParseLlmResponse(json: unknown) {
    return llmCompleteResponseSchema.safeParse(json);
}

/**
 * Get JSON Schema representation for the LLM output.
 * Includes descriptions to help LLM understand each field.
 */
export function getLlmOutputJsonSchema(): object {
    return {
        $schema: 'http://json-schema.org/draft-07/schema#',
        title: 'AccessibilityAnalysisResponse',
        description: 'Complete accessibility analysis response from analyzing screen reader transcripts',
        type: 'object',
        required: ['analysis', 'enhancements'],
        properties: {
            analysis: {
                description: 'New findings from analyzing the screen reader transcript',
                type: 'object',
                required: ['findings', 'summary', 'limitations'],
                properties: {
                    findings: {
                        description: 'List of accessibility issues found from transcript analysis',
                        type: 'array',
                        items: {
                            description: 'An accessibility issue identified from transcript analysis',
                            type: 'object',
                            required: ['category', 'confidence', 'issue', 'evidence', 'impact'],
                            properties: {
                                category: {
                                    description:
                                        'Category of accessibility issue: reading-order (content sequence), cognitive (mental load), semantic (meaning mismatch), consistency (pattern breaks), context (missing information)',
                                    enum: ['reading-order', 'cognitive', 'semantic', 'consistency', 'context'],
                                },
                                classification: {
                                    description:
                                        'Optional. Use contextually-acceptable ONLY with strong justification - most rule findings ARE genuine issues. Omit if unsure.',
                                    enum: ['confirmed', 'contextually-acceptable', 'llm-only-finding'],
                                },
                                confidence: {
                                    description:
                                        'How confident you are in this finding: high (clear evidence), medium (probable), low (uncertain)',
                                    enum: ['high', 'medium', 'low'],
                                },
                                issue: {
                                    description: 'Clear description of the accessibility issue found',
                                    type: 'string',
                                    minLength: 10,
                                },
                                evidence: {
                                    description: 'Evidence from the transcript supporting this finding',
                                    type: 'object',
                                    required: ['phrases', 'positions'],
                                    properties: {
                                        phrases: {
                                            description:
                                                'Exact phrases from the transcript that support this finding. Quote verbatim from the spoken text.',
                                            type: 'array',
                                            items: { type: 'string' },
                                            minItems: 1,
                                        },
                                        positions: {
                                            description:
                                                'References to the transcript steps where the evidence was found. Each entry identifies the strategy, step index, and stable step identifier.',
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                required: ['strategy', 'stepIndex', 'identifier'],
                                                properties: {
                                                    strategy: {
                                                        description:
                                                            'The navigation strategy name (e.g. "tab", "heading", "link", "landmark")',
                                                        type: 'string',
                                                    },
                                                    stepIndex: {
                                                        description: '0-based index of the step within the strategy',
                                                        type: 'integer',
                                                        minimum: 0,
                                                    },
                                                    identifier: {
                                                        description:
                                                            'Stable UUID identifier for the step, from the id attribute in the transcript XML',
                                                        type: 'string',
                                                    },
                                                },
                                            },
                                            minItems: 1,
                                        },
                                        pattern: {
                                            description:
                                                'Description of the pattern if this finding spans multiple steps (e.g., "repeated 5 times")',
                                            type: 'string',
                                        },
                                    },
                                },
                                impact: {
                                    description: 'How this issue affects screen reader users in plain language',
                                    type: 'string',
                                    minLength: 10,
                                },
                                relatedRuleId: {
                                    description:
                                        'Rule ID if this relates to an existing violation (e.g., "empty-accessible-name", "heading-level-skipped")',
                                    type: 'string',
                                },
                                semanticJustification: {
                                    description:
                                        'REQUIRED if contextually-acceptable: strong justification why page context makes this okay. For llm-only-finding: why rules could not detect this.',
                                    type: 'string',
                                },
                                requiresHumanReview: {
                                    description:
                                        'Whether this finding needs human verification (default true for LLM findings)',
                                    type: 'boolean',
                                    default: true,
                                },
                            },
                        },
                    },
                    summary: {
                        description: 'Summary of the accessibility analysis',
                        type: 'object',
                        required: ['stepsToMainContent', 'totalSteps', 'majorConcerns', 'overallAssessment'],
                        properties: {
                            stepsToMainContent: {
                                description:
                                    'Number of Tab presses or navigation steps to reach the main content. Null if main landmark not found.',
                                type: ['integer', 'null'],
                                minimum: 0,
                            },
                            totalSteps: {
                                description: 'Total number of navigation steps analyzed across all strategies',
                                type: 'integer',
                                minimum: 0,
                            },
                            majorConcerns: {
                                description: 'List of the most significant accessibility concerns found (top 3-5)',
                                type: 'array',
                                items: { type: 'string' },
                            },
                            overallAssessment: {
                                description:
                                    'Overall accessibility: good (minor/no issues), needs-review (some concerns), problematic (significant barriers)',
                                enum: ['good', 'needs-review', 'problematic'],
                            },
                        },
                    },
                    limitations: {
                        description:
                            'What could not be determined from the transcript (e.g., "Cannot verify color contrast", "Visual layout unknown")',
                        type: 'array',
                        items: { type: 'string' },
                    },
                },
            },
            enhancements: {
                description:
                    'Enhancements to existing violations found by static analyzers. Review each violation and add context.',
                type: 'array',
                items: {
                    description: 'Enhancement to an existing rule-based violation',
                    type: 'object',
                    required: ['violationId', 'confidence', 'falsePositiveRisk'],
                    properties: {
                        violationId: {
                            description: 'The ID of the violation being enhanced (from the violations section)',
                            type: 'string',
                        },
                        confidence: {
                            description:
                                'Your confidence this is a real issue: confirmed (clear evidence), likely (probable), uncertain (may be false positive)',
                            enum: ['confirmed', 'likely', 'uncertain'],
                        },
                        severityRationale: {
                            description:
                                'Why this severity level is appropriate (e.g., "Critical because this is the main CTA button")',
                            type: 'string',
                        },
                        remediationSuggestion: {
                            description:
                                'Specific code or content change to fix this (e.g., "Add aria-label=\'Submit order\'")',
                            type: 'string',
                        },
                        userImpactDescription: {
                            description:
                                'How this specific issue affects users (e.g., "User hears \'button\' with no indication of what it does")',
                            type: 'string',
                        },
                        falsePositiveRisk: {
                            description:
                                'Risk this is a false positive: low (definitely an issue), medium (likely), high (may not be an issue)',
                            enum: ['low', 'medium', 'high'],
                        },
                    },
                },
            },
        },
    };
}

/**
 * Maps strategy types to navigation modes.
 */
export function getNavigationMode(strategyType: string | undefined): NavigationMode {
    if (strategyType === 'tab') {
        return 'focus';
    }
    // All other types (heading, landmark, button, link, arrow, etc.) are browse mode
    return 'browse';
}
