import type { Page } from 'playwright';
import type { StrategyResult } from '../../../screen-reader/navigation-strategy/browse-mode-strategies/navigation-strategy';
import type { Violation } from '../../../analysis/violation';
import type { TranscriptSectionConfig, ViolationsSectionConfig, PromptTranscript } from '../schemas';
import { buildTranscriptData, buildTranscriptSection } from './transcript-section';
import { buildViolationsSection } from './violations-section';
import { getLlmOutputJsonSchema } from '../schemas';

export interface PageContext {
    url: string;
    title: string;
}

export interface BuiltPrompt {
    system: string;
    user: string;
    /** Combined prompt for copy-paste into AI chat */
    combined: string;
    metadata: {
        totalStrategies: number;
        totalSteps: number;
        totalViolations: number;
        systemPromptLength: number;
        userPromptLength: number;
        combinedPromptLength: number;
        estimatedTokens: number;
    };
}

export interface AccessibilityPromptConfig {
    /** Configuration for transcript section */
    transcript?: TranscriptSectionConfig;

    /** Configuration for violations section */
    violations?: ViolationsSectionConfig;

    /** Include JSON schema in prompt. Default: true */
    includeOutputSchema?: boolean;

    /** Analysis categories to include. Default: all */
    analysisCategories?: AnalysisCategory[];

    /** Custom system prompt additions */
    systemPromptAdditions?: string;

    /** Custom analysis instructions */
    customInstructions?: string;
}

export type AnalysisCategory =
    'reading-order' | 'cognitive-load' | 'semantic-mismatch' | 'consistency' | 'missing-context';

const CATEGORY_INSTRUCTIONS: Record<AnalysisCategory, string> = {
    'reading-order': `READING ORDER ANOMALIES
   - Content announced in illogical sequence
   - Footer/sidebar before main content
   - Related items announced far apart
   - Price before product name, error before field label`,

    'cognitive-load': `COGNITIVE LOAD
   - Excessive items before main content (count them)
   - Many similar-sounding items in sequence
   - Deeply nested announcements (menus within menus)
   - Information density that would overwhelm`,

    'semantic-mismatch': `SEMANTIC MISMATCH
   - Accessible name doesn't match likely function
   - Context suggests different meaning than announced
   - Visual metaphors that don't translate ("see below")`,

    consistency: `CONSISTENCY PROBLEMS
   - Same action with different names (Save/Submit/Confirm)
   - Pattern breaks (most cards have headings, one doesn't)
   - Inconsistent landmark usage`,

    'missing-context': `MISSING CONTEXT
   - Links/buttons that only make sense visually
   - Ambiguous references ("View details" - of what?)
   - Status communicated only by position/color`,
};

const ALL_CATEGORIES: AnalysisCategory[] = [
    'reading-order',
    'cognitive-load',
    'semantic-mismatch',
    'consistency',
    'missing-context',
];

/**
 * Concise guidance for what ONLY the LLM can analyze.
 * Rules detect patterns; LLM judges whether patterns are problematic in context.
 */
const LLM_UNIQUE_ANALYSIS_GUIDANCE = `
## YOUR UNIQUE VALUE: SEMANTIC JUDGMENT

Rules already detected quantitative issues (counts, presence/absence, DOM order).
You add semantic judgment — deciding if detected patterns are actually problematic.

### What you can uniquely assess:

1. **Reading order judgment** — "Should price come before product name?" "Does this sequence make sense?"

2. **Contextual repetition** — Is "Add to cart" repeated 15x a broken loop, or expected for a product grid?

3. **Cognitive load in context** — Is 50 navigation items overwhelming, or appropriate for a mega-menu?

4. **Implicit relationships** — Does surrounding context make a generic "Continue" button clear?

5. **Cross-section coherence** — Does the navigation match what the content delivers?

### IMAGE ANALYSIS (from arrow/linear navigation)

When you encounter "graphic [name]" in the transcript, assess:

1. **Function vs appearance** — Does the name describe what it DOES or what it LOOKS LIKE?
   - Bad: "red arrow", "smiling person", "blue icon"
   - Good: "Next step", "Customer testimonial - Jane D.", "Search"

2. **Redundancy** — Is the image name redundant with adjacent text?
   - If heading says "Contact Us" and next image is "graphic Contact Us" → redundant

3. **Decorative exposure** — Based on context, should this image be hidden from AT?
   - Decorative dividers, background flourishes, purely aesthetic images
   - If "graphic" has no name AND surrounding content is complete without it → likely should be decorative

4. **Icon literalism** — For icons, does the name describe the ACTION, not the shape?
   - Bad: "graphic magnifying glass", "graphic three horizontal lines"  
   - Good: "graphic Search", "graphic Menu"

5. **Missing context** — "graphic" with no name in a context where the image appears meaningful

Note: You cannot see the actual image. Assess based on the announced name and surrounding content only.

### CONTENT GROUPING (from rule findings)

When you see violations like "large-content-gap", "landmark-without-heading", or "repeated-pattern-without-heading", apply semantic judgment:

1. **Does this content logically belong together?**
   - Product cards, search results, form fields → likely need a section heading
   - Miscellaneous footer links, utility nav → may not need heading

2. **What heading would make sense?**
   - Suggest specific headings: "Products", "Search Results", "Contact Form"
   - Consider the page context and user expectations

3. **Is the gap actually problematic?**
   - 15 steps of related product info → acceptable if products have individual headings
   - 15 steps of disconnected content → needs organizing heading

4. **Landmark purpose clarity**
   - Navigation landmark with many items → consider "Main Navigation" heading
   - Complementary landmark → what is it complementing? Heading helps.

Rules flag the *where* (large gaps, dense landmarks). You judge the *whether* (does it actually need a heading?).

### CRITICAL: Do not dismiss rule findings without strong evidence

- Most rule findings ARE genuine accessibility issues
- Only mark as "contextually-acceptable" if you have HIGH confidence AND strong justification
- When in doubt, confirm the rule finding rather than dismiss it
- Your job is to ADD insights, not to excuse violations
`;

const DEFAULT_CONFIG: Required<AccessibilityPromptConfig> = {
    transcript: {
        includeHtmlSnippets: true,
        includeAxNodes: true,
        maxHtmlSnippetLength: 500,
    },
    violations: {
        includeHtmlSnippets: true,
        includeCorrelations: true,
        groupByRule: true,
        maxViolationsPerGroup: 5,
    },
    includeOutputSchema: true,
    analysisCategories: ALL_CATEGORIES,
    systemPromptAdditions: '',
    customInstructions: '',
};

export class AccessibilityPromptBuilder {
    private strategyResults: StrategyResult[] = [];
    private violations: Violation[] = [];
    private pageContext: PageContext | null = null;
    private config: Required<AccessibilityPromptConfig>;
    private transcriptData: PromptTranscript | null = null;

    constructor(config: AccessibilityPromptConfig = {}) {
        this.config = {
            ...DEFAULT_CONFIG,
            ...config,
            transcript: { ...DEFAULT_CONFIG.transcript, ...config.transcript },
            violations: { ...DEFAULT_CONFIG.violations, ...config.violations },
        };
    }

    withStrategyResults(results: StrategyResult[]): this {
        this.strategyResults = results;
        this.transcriptData = null;
        return this;
    }

    withViolations(violations: Violation[]): this {
        this.violations = violations;
        return this;
    }

    withPageContext(context: PageContext): this {
        this.pageContext = context;
        return this;
    }

    async withPage(page: Page): Promise<this> {
        this.pageContext = {
            url: page.url(),
            title: await page.title(),
        };
        return this;
    }

    withTranscriptConfig(config: TranscriptSectionConfig): this {
        this.config.transcript = { ...this.config.transcript, ...config };
        this.transcriptData = null;
        return this;
    }

    withViolationsConfig(config: ViolationsSectionConfig): this {
        this.config.violations = { ...this.config.violations, ...config };
        return this;
    }

    withCategories(categories: AnalysisCategory[]): this {
        this.config.analysisCategories = categories;
        return this;
    }

    withAllCategories(): this {
        this.config.analysisCategories = ALL_CATEGORIES;
        return this;
    }

    withCustomInstructions(instructions: string): this {
        this.config.customInstructions = instructions;
        return this;
    }

    withSystemPromptAdditions(additions: string): this {
        this.config.systemPromptAdditions = additions;
        return this;
    }

    withOutputSchema(include: boolean): this {
        this.config.includeOutputSchema = include;
        return this;
    }

    build(): BuiltPrompt {
        if (!this.transcriptData) {
            this.transcriptData = buildTranscriptData(this.strategyResults, this.config.transcript);
        }

        const system = this.buildSystemPrompt();
        const user = this.buildUserPrompt();
        const combined = this.buildCombinedPrompt(system, user);

        const estimatedTokens = Math.ceil((system.length + user.length) / 4);

        return {
            system,
            user,
            combined,
            metadata: {
                totalStrategies: this.transcriptData.totalStrategies,
                totalSteps: this.transcriptData.totalSteps,
                totalViolations: this.violations.length,
                systemPromptLength: system.length,
                userPromptLength: user.length,
                combinedPromptLength: combined.length,
                estimatedTokens,
            },
        };
    }

    buildCombinedPrompt(system?: string, user?: string): string {
        const systemPrompt = system ?? this.buildSystemPrompt();
        const userPrompt = user ?? this.buildUserPrompt();

        return `${systemPrompt}

---

${userPrompt}`;
    }

    buildSystemPrompt(): string {
        const parts: string[] = [];

        parts.push(`You are an expert accessibility auditor analyzing screen reader navigation transcripts.
Your role is to identify accessibility issues that deterministic rules cannot catch.

You will receive:
1. A transcript of NVDA screen reader navigation through a web page
2. Violations already found by static analyzers (axe-core and NVDA rules)

Your task is to:
1. Analyze the transcript for issues rules cannot detect (reading order, cognitive load, consistency, context, semantic)
2. Enhance existing violations with severity rationale, remediation suggestions, and user impact
3. Identify patterns across multiple violations`);

        parts.push(LLM_UNIQUE_ANALYSIS_GUIDANCE);

        parts.push(`EVIDENCE RULES:
- You MUST cite exact phrases from the transcript as evidence
- Reference steps using their strategy name and index, e.g. "At tab step 12, the user heard..." or "At heading step 3..."
- The transcript contains multiple strategies (tab, heading, link, landmark, arrow, etc.) — each has its own step indices starting from 0
- When referencing evidence positions, include the strategy name, stepIndex, and the step's id attribute (identifier)
- If you cannot cite evidence, state "insufficient evidence"
- Do NOT infer issues that aren't directly supported by the transcript
- Rate your confidence: high, medium, or low
- Never claim something is accessible just because no issue is obvious`);

        if (this.config.systemPromptAdditions) {
            parts.push(this.config.systemPromptAdditions);
        }

        return parts.join('\n\n');
    }

    buildUserPrompt(): string {
        if (!this.transcriptData) {
            this.transcriptData = buildTranscriptData(this.strategyResults, this.config.transcript);
        }

        const parts: string[] = [];

        parts.push('Analyze this accessibility audit data:');

        if (this.pageContext) {
            parts.push(`
<page_context>
  <url>${escapeXml(this.pageContext.url)}</url>
  <title>${escapeXml(this.pageContext.title)}</title>
</page_context>`);
        }

        const transcriptXml = buildTranscriptSection(this.strategyResults, this.config.transcript);
        parts.push(transcriptXml);

        const violationsXml = buildViolationsSection(
            this.violations,
            this.transcriptData.sections,
            this.config.violations
        );
        parts.push(violationsXml);

        parts.push(this.buildAnalysisInstructions());

        if (this.config.includeOutputSchema) {
            parts.push(`
<output_format>
Respond with JSON matching this schema:
${JSON.stringify(getLlmOutputJsonSchema(), null, 2)}
</output_format>`);
        }

        return parts.join('\n');
    }

    getTranscriptData(): PromptTranscript {
        if (!this.transcriptData) {
            this.transcriptData = buildTranscriptData(this.strategyResults, this.config.transcript);
        }
        return this.transcriptData;
    }

    private buildAnalysisInstructions(): string {
        const categories = this.config.analysisCategories;
        const categoryInstructions = categories.map((cat, i) => `${i + 1}. ${CATEGORY_INSTRUCTIONS[cat]}`).join('\n\n');

        let instructions = `
<analysis_instructions>
## Analyze the transcript for these issue categories:

${categoryInstructions}

## For each existing violation, provide:
- Confidence: confirmed, likely, or uncertain
- Severity rationale based on user impact
- Specific remediation suggestion
- False positive risk (low/medium/high)

## Look for NEW semantic issues rules missed:
- Reading order that's technically valid but confusing
- Repetition that's problematic for this specific page type
- Missing context that makes elements ambiguous
- Cross-section inconsistencies

Remember: Your job is to ADD insights. Do not dismiss rule findings without strong, cited evidence.`;

        if (this.config.customInstructions) {
            instructions += `\n\nAdditional instructions:\n${this.config.customInstructions}`;
        }

        instructions += '\n</analysis_instructions>';

        return instructions;
    }
}

export function createPromptBuilder(config?: AccessibilityPromptConfig): AccessibilityPromptBuilder {
    return new AccessibilityPromptBuilder(config);
}

export async function buildAccessibilityPrompt(
    strategyResults: StrategyResult[],
    violations: Violation[],
    page: Page,
    config?: AccessibilityPromptConfig
): Promise<BuiltPrompt> {
    const builder = new AccessibilityPromptBuilder(config);
    await builder.withPage(page);
    return builder.withStrategyResults(strategyResults).withViolations(violations).build();
}

function escapeXml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
