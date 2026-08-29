import type { Page } from 'playwright';
import type { StrategyResult } from '../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';
import type { Violation } from '../analysis/violation';
import { buildAccessibilityPrompt, type AccessibilityPromptConfig, type BuiltPrompt } from '../llm/prompt-builder';
import { parseLlmResponse, type LlmCompleteResponse } from '../llm/prompt-builder/schemas';
import { createAnthropicClient, type LlmClient } from '../llm/client';

// =============================================================================
// Types
// =============================================================================

export interface AuditConfig {
    /** Prompt builder configuration */
    prompt?: AccessibilityPromptConfig;
    /** LLM client to use. Defaults to Anthropic with env credentials */
    client?: LlmClient;
}

export interface AuditResult {
    /** Parsed LLM analysis response */
    analysis: LlmCompleteResponse;
    /** The prompt that was sent */
    prompt: BuiltPrompt;
    /** Token usage */
    usage: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
    };
}

// =============================================================================
// Main Audit Function
// =============================================================================

/**
 * Run a complete accessibility audit with LLM analysis.
 *
 * @example
 * ```typescript
 * // Using default Anthropic client (reads ANTHROPIC_API_KEY from env)
 * const result = await auditPage(page, strategyResults, violations);
 *
 * // With custom client
 * const client = createBedrockClient({ region: 'us-west-2' });
 * const result = await auditPage(page, strategyResults, violations, { client });
 *
 * // With mock client for testing
 * const mockClient: LlmClient = async () => ({ content: '{}', usage: {...}, stopReason: 'end_turn' });
 * const result = await auditPage(page, strategyResults, violations, { client: mockClient });
 * ```
 */
export async function auditPage(
    page: Page,
    strategyResults: StrategyResult[],
    violations: Violation[],
    config?: AuditConfig
): Promise<AuditResult> {
    // Build the prompt
    const prompt = await buildAccessibilityPrompt(strategyResults, violations, page, config?.prompt);

    console.log(`[audit] Built prompt: ${prompt.metadata.estimatedTokens} estimated tokens`);
    console.log(
        `[audit] Strategies: ${prompt.metadata.totalStrategies}, Steps: ${prompt.metadata.totalSteps}, Violations: ${prompt.metadata.totalViolations}`
    );

    // Get or create client
    const client = config?.client ?? createAnthropicClient();

    // Call LLM
    const response = await client({ system: prompt.system, user: prompt.user });

    console.log(
        `[audit] LLM response: ${response.usage.inputTokens} input, ${response.usage.outputTokens} output tokens`
    );

    // Parse response
    const parsed = parseAnalysisResponse(response.content);

    console.log(
        `[audit] Found ${parsed.analysis.findings.length} new findings, ${parsed.enhancements.length} enhancements`
    );

    return {
        analysis: parsed,
        prompt,
        usage: {
            inputTokens: response.usage.inputTokens,
            outputTokens: response.usage.outputTokens,
            totalTokens: response.usage.inputTokens + response.usage.outputTokens,
        },
    };
}

/**
 * Quick audit with minimal configuration.
 * Uses default Anthropic client with env credentials.
 *
 * @example
 * ```typescript
 * // Set ANTHROPIC_API_KEY env var, then:
 * const result = await quickAudit(page, strategyResults, violations);
 * ```
 */
export async function quickAudit(
    page: Page,
    strategyResults: StrategyResult[],
    violations: Violation[]
): Promise<AuditResult> {
    return auditPage(page, strategyResults, violations);
}

// =============================================================================
// Internal helpers
// =============================================================================

/**
 * Parse LLM response content into structured analysis.
 * Handles JSON extraction from markdown code blocks.
 */
function parseAnalysisResponse(content: string): LlmCompleteResponse {
    // Extract JSON from response (may be wrapped in markdown code blocks)
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) ?? content.match(/(\{[\s\S]*\})/);

    if (!jsonMatch?.[1]) {
        throw new Error('No JSON found in LLM response');
    }

    const jsonStr = jsonMatch[1].trim();
    const json = JSON.parse(jsonStr) as unknown;

    return parseLlmResponse(json);
}
