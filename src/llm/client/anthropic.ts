/**
 * Anthropic API client implementation.
 */

import type { LlmClient, LlmRequest, LlmResponse } from './types';
import { LlmError } from './types';

export interface AnthropicClientConfig {
    /** API key. Defaults to ANTHROPIC_API_KEY env var */
    apiKey?: string;
    /** Model ID. Defaults to claude-sonnet-4-20250514 */
    model?: string;
    /** Max tokens in response. Defaults to 8192 */
    maxTokens?: number;
    /** Temperature (0-1). Defaults to 0 */
    temperature?: number;
    /** Base URL for API. Defaults to https://api.anthropic.com */
    baseUrl?: string;
}

const DEFAULT_CONFIG = {
    model: 'claude-sonnet-4-20250514',
    maxTokens: 8192,
    temperature: 0,
    baseUrl: 'https://api.anthropic.com',
} as const;

/**
 * Creates an Anthropic API client.
 *
 * @example
 * ```typescript
 * // Using environment variable for API key
 * const client = createAnthropicClient();
 *
 * // With explicit config
 * const client = createAnthropicClient({
 *     apiKey: 'sk-...',
 *     model: 'claude-sonnet-4-20250514',
 *     maxTokens: 4096,
 * });
 *
 * const response = await client({
 *     system: 'You are an accessibility expert.',
 *     user: 'Analyze this page...',
 * });
 * ```
 */
export function createAnthropicClient(config: AnthropicClientConfig = {}): LlmClient {
    const apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY;
    const model = config.model ?? DEFAULT_CONFIG.model;
    const maxTokens = config.maxTokens ?? DEFAULT_CONFIG.maxTokens;
    const temperature = config.temperature ?? DEFAULT_CONFIG.temperature;
    const baseUrl = config.baseUrl ?? DEFAULT_CONFIG.baseUrl;

    if (!apiKey) {
        throw new LlmError(
            'Anthropic API key required. Set ANTHROPIC_API_KEY env var or pass apiKey in config.',
            'auth',
            false
        );
    }

    return async (request: LlmRequest): Promise<LlmResponse> => {
        const response = await fetch(`${baseUrl}/v1/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model,
                max_tokens: maxTokens,
                temperature,
                system: request.system,
                messages: [{ role: 'user', content: request.user }],
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw mapAnthropicError(response.status, errorText);
        }

        const data = (await response.json()) as AnthropicResponse;
        const textContent = data.content.find((c) => c.type === 'text');

        return {
            content: textContent?.text ?? '',
            usage: {
                inputTokens: data.usage.input_tokens,
                outputTokens: data.usage.output_tokens,
            },
            stopReason: data.stop_reason,
        };
    };
}

// =============================================================================
// Internal types and helpers
// =============================================================================

interface AnthropicResponse {
    content: Array<{ type: string; text: string }>;
    usage: { input_tokens: number; output_tokens: number };
    stop_reason: string;
}

function mapAnthropicError(status: number, errorText: string): LlmError {
    switch (status) {
        case 401:
            return new LlmError(`Authentication failed: ${errorText}`, 'auth', false);
        case 429:
            return new LlmError(`Rate limit exceeded: ${errorText}`, 'rate_limit', true);
        case 400:
            if (errorText.includes('context_length') || errorText.includes('too long')) {
                return new LlmError(`Context length exceeded: ${errorText}`, 'context_length', false);
            }
            return new LlmError(`Invalid request: ${errorText}`, 'invalid_request', false);
        case 500:
        case 502:
        case 503:
            return new LlmError(`Server error: ${errorText}`, 'server_error', true);
        default:
            return new LlmError(`Anthropic API error (${status}): ${errorText}`, 'unknown', false);
    }
}
