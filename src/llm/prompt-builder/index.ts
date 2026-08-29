// =============================================================================
// SCHEMAS - Source of truth for types
// =============================================================================

// Input schemas (data going into prompt)
export {
    promptAxNodeSchema,
    promptAxNodePropertiesSchema,
    promptNavigationStepSchema,
    promptStrategySectionSchema,
    promptTranscriptSchema,
    navigationModeSchema,
    transcriptCorrelationSchema,
    promptViolationSchema,
    promptViolationGroupSchema,
    promptViolationsDataSchema,
    transcriptSectionConfigSchema,
    violationsSectionConfigSchema,
    // Config defaults
    TRANSCRIPT_CONFIG_DEFAULTS,
    VIOLATIONS_CONFIG_DEFAULTS,
    // Config merge utilities
    mergeTranscriptConfig,
    mergeViolationsConfig,
} from './schemas';

// Output schemas (data from LLM)
export {
    findingCategorySchema,
    findingClassificationSchema,
    confidenceLevelSchema,
    llmEvidenceStepSchema,
    llmEvidenceSchema,
    llmFindingSchema,
    llmAnalysisSummarySchema,
    llmAnalysisResponseSchema,
    llmViolationEnhancementSchema,
    llmCompleteResponseSchema,
    overallAssessmentSchema,
} from './schemas';

// =============================================================================
// TYPES - Inferred from schemas
// =============================================================================

export type {
    // Input types
    PromptAxNode,
    PromptAxNodeProperties,
    PromptNavigationStep,
    PromptStrategySection,
    PromptTranscript,
    NavigationMode,
    TranscriptCorrelation,
    PromptViolation,
    PromptViolationGroup,
    PromptViolationsData,
    TranscriptSectionConfig,
    ViolationsSectionConfig,
    ResolvedTranscriptConfig,
    ResolvedViolationsConfig,
    // Output types
    FindingCategory,
    FindingClassification,
    ConfidenceLevel,
    LlmEvidenceStep,
    LlmEvidence,
    LlmFinding,
    LlmAnalysisSummary,
    LlmAnalysisResponse,
    LlmViolationEnhancement,
    LlmCompleteResponse,
    OverallAssessment,
} from './schemas';

// =============================================================================
// UTILITIES
// =============================================================================

export { getNavigationMode, parseLlmResponse, safeParseLlmResponse, getLlmOutputJsonSchema } from './schemas';

// =============================================================================
// SECTION BUILDERS
// =============================================================================

// Transcript section
export { buildTranscriptData, buildTranscriptSection, renderTranscriptXml } from './sections/transcript-section';

// Violations section
export { buildViolationsData, buildViolationsSection, renderViolationsXml } from './sections/violations-section';

// Accessibility prompt builder
export type {
    PageContext,
    BuiltPrompt,
    AccessibilityPromptConfig,
    AnalysisCategory,
} from './sections/accessibility-prompt-builder';

export {
    AccessibilityPromptBuilder,
    createPromptBuilder,
    buildAccessibilityPrompt,
} from './sections/accessibility-prompt-builder';
