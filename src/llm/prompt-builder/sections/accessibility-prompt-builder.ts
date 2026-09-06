import type { Page } from 'playwright';
import type { StrategyResult } from '../../../screen-reader/strategies/navigation-strategy';
import type { Violation } from '../../../analysis/core/violation';
import type { TranscriptSectionConfig, ViolationsSectionConfig, PromptTranscript } from '../schemas';
import type { ScreenReaderType } from '../../../screen-reader/screen-reader-type';
import { getScreenReaderDisplayName } from '../../../screen-reader/screen-reader-type';
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
    screenReader: ScreenReaderType;
    transcript?: TranscriptSectionConfig;
    violations?: ViolationsSectionConfig;
    /** Default: true */
    includeOutputSchema?: boolean;
    /** Default: all */
    analysisCategories?: AnalysisCategory[];
    systemPromptAdditions?: string;
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

const DEFAULT_CONFIG: Omit<Required<AccessibilityPromptConfig>, 'screenReader'> = {
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
    private transcript: StrategyResult[] = [];
    private violations: Violation[] = [];
    private pageContext: PageContext | null = null;
    private config: Required<AccessibilityPromptConfig>;
    private transcriptData: PromptTranscript | null = null;

    constructor(config: AccessibilityPromptConfig) {
        this.config = {
            ...DEFAULT_CONFIG,
            ...config,
            transcript: { ...DEFAULT_CONFIG.transcript, ...config.transcript },
            violations: { ...DEFAULT_CONFIG.violations, ...config.violations },
        };
    }

    withStrategyResults(results: StrategyResult[]): this {
        this.transcript = results;
        this.transcriptData = null;
        return this;
    }

    withViolations(violations: Violation[]): this {
        this.violations = violations;
        return this;
    }

    withScreenReader(name: ScreenReaderType): this {
        this.config.screenReader = name;
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
            this.transcriptData = buildTranscriptData(this.transcript, this.config.transcript);
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
        const screenReaderDisplayName = getScreenReaderDisplayName(this.config.screenReader);

        parts.push(`You are an expert accessibility auditor analyzing screen reader navigation transcripts.
Your role is to identify accessibility issues that deterministic rules cannot catch.

You will receive:
1. A transcript of ${screenReaderDisplayName} screen reader navigation through a web page
2. Violations already found by automated ${screenReaderDisplayName} rules

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
- Never claim something is accessible just because no issue is obvious

STEP REFERENCE FORMAT:
- Whenever you mention a transcript step in ANY free-text field (issue, impact, pattern, stepsToReproduce, semanticJustification, remediationSuggestion, userImpactDescription, severityRationale, majorConcerns), you MUST use the token format: [strategy:index:stepId]
- Format: [strategy:stepIndex:identifier] — e.g. [arrow:48:f6351200-cb74-481f-a507-eaadf5707e04]
- The strategy is the navigation strategy name (tab, heading, arrow, link, landmark, button, etc.)
- The stepIndex is the 0-based integer index of the step within that strategy
- The identifier is the UUID from the step's id attribute in the transcript
- Use this token every time you reference a specific step, even in mid-sentence: "The user hears [arrow:48:f6351200-cb74-481f-a507-eaadf5707e04] and then..."
- Do NOT write "arrow step 48" or "step 48 of arrow" in plain prose — always use the token
- The token will be rendered as a clickable link in the report — this is the ONLY way step references become navigable

VIOLATION REFERENCE FORMAT:
- Whenever you reference an existing rule violation in ANY free-text field (issue, impact, pattern, stepsToReproduce, semanticJustification, remediationSuggestion, userImpactDescription, severityRationale, majorConcerns, limitations), you MUST use the token format: [ruleId:violationId]
- Format: [ruleId:violationId] — e.g. [multiple-h1:multiple-h1-da2c0148-7d23-438b-9ed5-2fc3d38671d2]
- The ruleId is the rule identifier (e.g., multiple-h1, focus-trap, missing-main-landmark, excessive-repetition)
- The violationId is the full violation ID from the violations section (e.g., multiple-h1-da2c0148-7d23-438b-9ed5-2fc3d38671d2)
- Use this token every time you reference a rule finding, even in mid-sentence: "This compounds the issues found in [multiple-h1:multiple-h1-da2c0148-7d23-438b-9ed5-2fc3d38671d2]..."
- Do NOT write "the multiple-h1 rule" or "the focus trap violation" in plain prose without the token — always include the full reference
- The token will be rendered as a clickable anchor link in the report, allowing users to jump to the specific violation
- When a finding relates to multiple violations, reference all of them: "Related to [multiple-h1:multiple-h1-da2c0148-7d23-438b-9ed5-2fc3d38671d2], [multiple-h1:multiple-h1-2159ced1-bc52-43e0-82fd-cb9e836d99d5], and [repeated-pattern-without-heading:repeated-pattern-934b7c40-d5d1-4017-a91c-2d0351bb2668]"

ARROW NAVIGATION ANALYSIS CONSTRAINTS (v1.0):
When analyzing arrow (Down Arrow) navigation transcripts, apply these constraints:

DO NOT flag as issues:
1. **Normal element-by-element announcements** — Each DOM element (image, heading, paragraph, price, badge) being announced separately is CORRECT browser/screen reader behavior. This is how browse mode works.

2. **Subjective reading order preferences** — Do not flag patterns like "category appears between product name and price" unless the order is OBJECTIVELY broken (e.g., a price announced before the product it belongs to, or an error message before the field it describes).

3. **Consistent patterns across repeated items** — If all product cards, list items, or similar components follow the same announcement structure, the structure is intentional design, not a bug. Consistency is good.

4. **Semantic elements being "verbose"** — A heading followed by a paragraph followed by spans is normal, semantic HTML. More announcements ≠ worse accessibility.

5. **Information density in structured content** — Product cards, data tables, and forms naturally have multiple pieces of information announced in sequence.

ONLY flag arrow navigation issues when:
- Same phrase repeats 5+ times consecutively with no user action between (indicates DOM bug, not content repetition)
- Long runs of blank/empty announcements (indicates structural DOM problems like empty divs)
- Content is announced in OBJECTIVELY wrong order (price before its product, answer before question, error before the field it describes)
- Clearly related content is separated by UNRELATED content (not just multiple attributes of the same item)
- Reading order completely contradicts visual layout in a way that would confuse users

When in doubt about arrow navigation findings, DO NOT create a finding. The bar for arrow-based findings should be HIGH because users typically navigate by headings, landmarks, or tab — not by reading every element sequentially.

STEPS TO REPRODUCE:
- For each finding, provide clear step-by-step instructions to reproduce the issue
- Include the specific screen reader commands to use:
  * "Press H" for next heading
  * "Press D" for next landmark
  * "Press K" for next link
  * "Press B" for next button
  * "Press Tab" for next focusable element
  * "Press Down Arrow" for linear reading
  * "Press 1-6" for heading levels 1-6
- Reference exact step numbers from the transcript, e.g. "After step 12, you will hear..."
- Include what the user should hear/notice at each step
- Make steps actionable so someone can verify the issue independently`);

        if (this.config.systemPromptAdditions) {
            parts.push(this.config.systemPromptAdditions);
        }

        return parts.join('\n\n');
    }

    buildUserPrompt(): string {
        if (!this.transcriptData) {
            this.transcriptData = buildTranscriptData(this.transcript, this.config.transcript);
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

        const transcriptXml = buildTranscriptSection(this.transcript, this.config.transcript);
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
            this.transcriptData = buildTranscriptData(this.transcript, this.config.transcript);
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

export function createPromptBuilder(config: AccessibilityPromptConfig): AccessibilityPromptBuilder {
    return new AccessibilityPromptBuilder(config);
}

export async function buildAccessibilityPrompt(
    transcript: StrategyResult[],
    violations: Violation[],
    page: Page,
    config: AccessibilityPromptConfig
): Promise<BuiltPrompt> {
    const builder = new AccessibilityPromptBuilder(config);
    await builder.withPage(page);
    return builder.withStrategyResults(transcript).withViolations(violations).build();
}

function escapeXml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
