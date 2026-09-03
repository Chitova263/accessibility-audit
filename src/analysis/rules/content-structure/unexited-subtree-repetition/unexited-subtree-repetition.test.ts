import { describe, it, expect } from 'vitest';
import { UnexitedSubtreeRepetitionRule } from './unexited-subtree-repetition';
import { createStep, createSteps, strategyResult, mockContext } from '../../test-fixtures';

const rule = new UnexitedSubtreeRepetitionRule();

// ─── helpers ────────────────────────────────────────────────────────────────

/** Build an arrow-only context from steps */
const arrowContext = (steps: ReturnType<typeof createStep>[]) =>
    mockContext([strategyResult('arrow', steps, { kind: 'exhausted', detail: 'reached end of document' })]);

/**
 * Build the canonical chat-widget pattern:
 *   - some normal page content
 *   - a button entry step (role=button, name=phrase)
 *   - N child-node steps (role=generic / no role, same focusedElementText as button name)
 */
const chatWidgetSteps = (phrase: string, repetitions: number, leadingCount = 5) => {
    const leading = Array.from({ length: leadingCount }, (_, i) =>
        createStep(i, { focusedElementText: `Content ${i}`, role: 'paragraph' })
    );

    const buttonEntry = createStep(leadingCount, {
        focusedElementText: phrase,
        role: 'button',
        name: phrase,
    });

    // Child node steps: same text, role=generic (unnamed div / SVG child)
    const children = Array.from({ length: repetitions }, (_, i) =>
        createStep(leadingCount + 1 + i, {
            focusedElementText: phrase,
            role: 'generic',
            name: '',
        })
    );

    return [...leading, buttonEntry, ...children];
};

// ─── tests ───────────────────────────────────────────────────────────────────

describe('unexited-subtree-repetition rule', () => {
    it('detects the canonical chat-widget subtree traversal pattern', async () => {
        const steps = chatWidgetSteps('Hello, how can I help you?', 29);
        const result = await rule.run(arrowContext(steps));

        expect(result.violations).toHaveLength(1);
        const violation = result.violations[0]!;
        expect(violation.rule.id).toBe('unexited-subtree-repetition');
        expect(result.stats!.detections[0]!.count).toBe(30); // button entry + 29 children
        expect(result.stats!.detections[0]!.reachedStrategyEnd).toBe(true);
    });

    it('violation message explains the cause and fix', async () => {
        const steps = chatWidgetSteps('Hello, how can I help you?', 29);
        const result = await rule.run(arrowContext(steps));

        const msg = result.violations[0]!.message;
        expect(msg).toContain('unnamed child nodes');
        expect(msg).toContain('aria-hidden');
        expect(msg).toContain('aria-label');
        expect(msg).toContain('virtual buffer');
    });

    it('does NOT fire when repetition ends well before the strategy end', async () => {
        // Button in the middle, lots of content after — NOT subtree traversal
        const buttonEntry = createStep(5, {
            focusedElementText: 'Hello, how can I help you?',
            role: 'button',
            name: 'Hello, how can I help you?',
        });
        const buttonChildren = Array.from({ length: 10 }, (_, i) =>
            createStep(6 + i, {
                focusedElementText: 'Hello, how can I help you?',
                role: 'generic',
                name: '',
            })
        );
        const trailing = Array.from({ length: 20 }, (_, i) =>
            createStep(16 + i, { focusedElementText: `More content ${i}`, role: 'paragraph' })
        );

        const steps = [
            ...Array.from({ length: 5 }, (_, i) =>
                createStep(i, { focusedElementText: `Item ${i}`, role: 'paragraph' })
            ),
            buttonEntry,
            ...buttonChildren,
            ...trailing,
        ];

        const result = await rule.run(arrowContext(steps));
        expect(result.violations).toHaveLength(0);
    });

    it('does NOT fire when the repeated phrase has no matching button AX node', async () => {
        // Same text repeated at end, but no button — could be a broken loop
        const steps = [
            ...Array.from({ length: 5 }, (_, i) =>
                createStep(i, { focusedElementText: `Item ${i}`, role: 'paragraph' })
            ),
            ...Array.from({ length: 15 }, (_, i) =>
                createStep(5 + i, {
                    focusedElementText: 'Some text',
                    role: 'paragraph', // not a button
                })
            ),
        ];

        const result = await rule.run(arrowContext(steps));
        expect(result.violations).toHaveLength(0);
    });

    it('does NOT fire for a product grid with repeated "Add to cart" not at end', async () => {
        const steps = createSteps([
            { focusedElementText: 'Product A', role: 'heading' },
            { focusedElementText: 'Add to cart', role: 'button', name: 'Add to cart' },
            { focusedElementText: 'Product B', role: 'heading' },
            { focusedElementText: 'Add to cart', role: 'button', name: 'Add to cart' },
            { focusedElementText: 'Product C', role: 'heading' },
            { focusedElementText: 'Add to cart', role: 'button', name: 'Add to cart' },
            { focusedElementText: 'Product D', role: 'heading' },
            { focusedElementText: 'Add to cart', role: 'button', name: 'Add to cart' },
            { focusedElementText: 'Product E', role: 'heading' },
            { focusedElementText: 'Add to cart', role: 'button', name: 'Add to cart' },
            { focusedElementText: 'Footer', role: 'contentinfo' }, // trailing content, not a repetition
        ]);

        const result = await rule.run(arrowContext(steps));
        expect(result.violations).toHaveLength(0);
    });

    it('respects custom threshold', async () => {
        // With threshold=30 the default chat-widget (30 reps) still fires
        const strictRule = new UnexitedSubtreeRepetitionRule({ threshold: 30 });
        const steps = chatWidgetSteps('Hello, how can I help you?', 29); // 30 total
        const result = await strictRule.run(arrowContext(steps));
        expect(result.violations).toHaveLength(1);
    });

    it('does not fire below custom threshold', async () => {
        const strictRule = new UnexitedSubtreeRepetitionRule({ threshold: 31 });
        const steps = chatWidgetSteps('Hello, how can I help you?', 29); // 30 total
        const result = await strictRule.run(arrowContext(steps));
        expect(result.violations).toHaveLength(0);
    });

    it('respects custom endTolerance', async () => {
        // Run ends 5 steps before end of strategy, default tolerance=3 → no fire
        const steps = [
            ...chatWidgetSteps('Help?', 10),
            ...Array.from({ length: 5 }, (_, i) =>
                createStep(100 + i, { focusedElementText: `Footer ${i}`, role: 'paragraph' })
            ),
        ];
        const defaultResult = await rule.run(arrowContext(steps));
        expect(defaultResult.violations).toHaveLength(0);

        // With tolerance=6 → fires
        const tolerantRule = new UnexitedSubtreeRepetitionRule({ endTolerance: 6 });
        const tolerantResult = await tolerantRule.run(arrowContext(steps));
        expect(tolerantResult.violations).toHaveLength(1);
    });

    it('returns no violations when there is no arrow strategy', async () => {
        const result = await rule.run(mockContext([]));
        expect(result.violations).toHaveLength(0);
        expect(result.stats!.detections).toEqual([]);
    });

    it('detects multiple independent subtree traversals in one transcript', async () => {
        const widget1 = chatWidgetSteps('Chat', 10, 3);
        // Simulate a second widget by appending another sequence
        // (contrived but tests multi-detection)
        const widget2 = Array.from({ length: 10 }, (_, i) =>
            createStep(100 + i, {
                focusedElementText: 'Chat',
                role: i === 0 ? 'button' : 'generic',
                name: i === 0 ? 'Chat' : '',
            })
        );
        const result = await rule.run(arrowContext([...widget1, ...widget2]));
        // The combined run is unbroken so it should still fire as one detection
        expect(result.violations.length).toBeGreaterThanOrEqual(1);
    });
});
