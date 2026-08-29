/**
 * Core types for LLM client abstraction.
 *
 * The LlmClient type is a simple function signature that any provider can implement.
 * This allows for easy testing, swapping providers, and extending with new providers.
 */

export interface LlmRequest {
    /** System prompt */
    system: string;
    /** User message */
    user: string;
}

export interface LlmResponse {
    /** Response content from the model */
    content: string;
    /** Token usage statistics */
    usage: {
        inputTokens: number;
        outputTokens: number;
    };
    /** Reason the model stopped generating */
    stopReason: string;
}

/**
 * LLM client function type.
 *
 * Any provider implementation must satisfy this signature.
 * This enables dependency injection and easy mocking for tests.
 *
 * @example
 * ```typescript
 * // Create a client
 * const client = createAnthropicClient({ model: 'claude-sonnet-4-20250514' });
 *
 * // Use it
 * const response = await client({ system: '...', user: '...' });
 *
 * // Or inject a mock for testing
 * const mockClient: LlmClient = async () => ({
 *     content: '{"issues": []}',
 *     usage: { inputTokens: 100, outputTokens: 50 },
 *     stopReason: 'end_turn',
 * });
 * ```
 */
export type LlmClient = (request: LlmRequest) => Promise<LlmResponse>;

/**
 * Normalized error codes for LLM operations.
 */
export type LlmErrorCode = 'rate_limit' | 'auth' | 'context_length' | 'invalid_request' | 'server_error' | 'unknown';

/**
 * Normalized error for LLM operations.
 * Wraps provider-specific errors with consistent handling.
 */
export class LlmError extends Error {
    constructor(
        message: string,
        public readonly code: LlmErrorCode,
        public readonly retryable: boolean,
        public readonly cause?: Error
    ) {
        super(message);
        this.name = 'LlmError';
    }
}
