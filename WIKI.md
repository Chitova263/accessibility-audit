# Accessibility Audit Tool - Pipeline Documentation

This document describes the complete audit pipeline from URL input to final HTML report.

## High-Level Pipeline Overview

```mermaid
flowchart LR
    URL[URL Input] --> AUDIT[a11y audit]
    AUDIT --> FILES[Audit Files]
    FILES --> LLM[LLM Analysis]
    LLM --> REPORT[a11y report]
    REPORT --> HTML[HTML Report]
```

## Complete Pipeline Diagram

```mermaid
flowchart TB
    subgraph INPUT["1️⃣ INPUT"]
        URL["Target URL"]
        OPTIONS["Options<br/>--reader nvda|virtual<br/>--max-steps N<br/>--output-dir path"]
    end

    subgraph CONNECT["2️⃣ BROWSER CONNECTION"]
        CDP["Chrome DevTools Protocol<br/>Connection"]
        PAGE["Load Page in Browser"]
    end

    subgraph SCREENREADER["3️⃣ SCREEN READER SETUP"]
        DRIVER["Create Driver<br/>(NVDA or Virtual)"]
        NAVIGATOR["Initialize Navigator<br/>with Key Bindings"]
        SESSION["Create PageSession"]
    end

    subgraph NAVIGATION["4️⃣ NAVIGATION STRATEGIES"]
        direction TB
        HEADING["Heading Navigation<br/>(H key)"]
        LANDMARK["Landmark Navigation<br/>(D key)"]
        BUTTON["Button Navigation<br/>(B key)"]
        LINK["Link Navigation<br/>(K key)"]
        H1_6["Heading Levels 1-6<br/>(1-6 keys)"]
        ARROW["Down Arrow<br/>(Linear Reading)"]
        TAB["Tab Navigation<br/>(Focus Order)"]
    end

    subgraph TRANSCRIPT["5️⃣ TRANSCRIPT OUTPUT"]
        STEPS["Navigation Steps<br/>• Spoken phrases<br/>• AX node data<br/>• HTML snippets"]
        RESULTS["Strategy Results<br/>• Completion reason<br/>• Step count"]
    end

    subgraph ANALYSIS["6️⃣ RULE-BASED ANALYSIS"]
        direction TB
        RULES["28 Custom Rules"]
        AXE["axe-core<br/>(90+ rules)"]
        VIOLATIONS["Violations<br/>with Screenshots"]
    end

    subgraph PROMPTGEN["7️⃣ LLM PROMPT GENERATION"]
        BUILDER["Prompt Builder"]
        SYSTEM["System Prompt<br/>(Instructions)"]
        USER["User Prompt<br/>(Data)"]
        COMBINED["Combined Prompt"]
    end

    subgraph LLMSTEP["8️⃣ LLM ANALYSIS (Manual)"]
        SEND["Send to LLM<br/>(Claude, GPT, etc.)"]
        RESPONSE["LLM Response JSON"]
    end

    subgraph REPORTGEN["9️⃣ REPORT GENERATION"]
        MERGE["Merge Data Sources"]
        RENDER["Render HTML/JSON"]
        FINAL["Final Report"]
    end

    URL --> CDP
    OPTIONS --> CDP
    CDP --> PAGE
    PAGE --> DRIVER
    DRIVER --> NAVIGATOR
    NAVIGATOR --> SESSION
    SESSION --> HEADING
    SESSION --> LANDMARK
    SESSION --> BUTTON
    SESSION --> LINK
    SESSION --> H1_6
    SESSION --> ARROW
    SESSION --> TAB
    HEADING --> STEPS
    LANDMARK --> STEPS
    BUTTON --> STEPS
    LINK --> STEPS
    H1_6 --> STEPS
    ARROW --> STEPS
    TAB --> STEPS
    STEPS --> RESULTS
    RESULTS --> RULES
    RESULTS --> AXE
    PAGE --> AXE
    RULES --> VIOLATIONS
    AXE --> VIOLATIONS
    RESULTS --> BUILDER
    VIOLATIONS --> BUILDER
    BUILDER --> SYSTEM
    BUILDER --> USER
    BUILDER --> COMBINED
    COMBINED --> SEND
    SEND --> RESPONSE
    RESPONSE --> MERGE
    VIOLATIONS --> MERGE
    RESULTS --> MERGE
    MERGE --> RENDER
    RENDER --> FINAL
```

## Stage-by-Stage Breakdown

### Stage 1: Input

```mermaid
flowchart LR
    subgraph Inputs
        URL["URL to audit"]
        READER["--reader<br/>nvda | virtual"]
        STEPS["--max-steps<br/>default: 500"]
        OUT["--output-dir<br/>auto-generated"]
    end

    subgraph Outputs
        DIR["Output Directory<br/>audit-results/example.com-2026-09-01T13-09/"]
    end

    Inputs --> DIR
```

**Command:** `a11y audit <url> [options]`

| Input          | Description            | Default        |
| -------------- | ---------------------- | -------------- |
| `url`          | Target URL to audit    | Required       |
| `--reader`     | Screen reader driver   | `nvda`         |
| `--max-steps`  | Max steps per strategy | `500`          |
| `--output-dir` | Output directory       | Auto-generated |

---

### Stage 2: Browser Connection

```mermaid
flowchart LR
    subgraph Input
        URL["Target URL"]
    end

    subgraph Process
        CDP["ChromeDevToolsProtocolConnection"]
        CONNECT["connect()"]
        GOTO["goToPage(url)"]
    end

    subgraph Output
        PAGE["Playwright Page Object"]
        CDPSESSION["CDP Session"]
    end

    URL --> CDP --> CONNECT --> GOTO --> PAGE
    GOTO --> CDPSESSION
```

The tool connects to Chrome via the DevTools Protocol, enabling:

- Page navigation and control
- Accessibility tree inspection
- DOM queries for HTML snippets
- Screenshot capture

---

### Stage 3: Screen Reader Setup

```mermaid
flowchart TB
    subgraph Input
        PAGE["Page Object"]
        TYPE["Reader Type"]
    end

    subgraph DriverFactory["createDriver()"]
        NVDA["NVDA Driver<br/>• Real screen reader<br/>• Windows only<br/>• @guidepup/guidepup"]
        VIRTUAL["Virtual Driver<br/>• Headless<br/>• Cross-platform<br/>• @guidepup/virtual-screen-reader"]
    end

    subgraph Output
        READER["ScreenReader Interface"]
        KEYS["Key Bindings"]
        END["End Detection Config"]
        NAV["Navigator"]
    end

    PAGE --> DriverFactory
    TYPE --> DriverFactory
    DriverFactory --> READER
    DriverFactory --> KEYS
    DriverFactory --> END
    READER --> NAV
    KEYS --> NAV
    END --> NAV
```

**Driver Capabilities:**

| Driver  | Platform | Real SR      | Speed  |
| ------- | -------- | ------------ | ------ |
| NVDA    | Windows  | ✅ Yes       | Slower |
| Virtual | Any      | ❌ Simulated | Faster |

---

### Stage 4: Navigation Strategies

```mermaid
flowchart TB
    subgraph Input
        SESSION["PageSession"]
        AXTREE["Accessibility Tree"]
    end

    subgraph BrowseMode["Browse Mode Strategies"]
        H["HeadingNavigationStrategy<br/>H key → next heading"]
        L["LandmarkNavigationStrategy<br/>D key → next landmark"]
        B["ButtonNavigationStrategy<br/>B key → next button"]
        K["LinkNavigationStrategy<br/>K key → next link"]
        H1["HeadingHierarchyStrategy<br/>1-6 keys → heading level"]
        ARROW["DownArrowNavigationStrategy<br/>↓ key → linear reading"]
    end

    subgraph FocusMode["Focus Mode Strategy"]
        TAB["TabNavigationStrategy<br/>Tab key → focus order"]
    end

    subgraph Output
        RESULT["StrategyResult[]<br/>• meta (name, mode, type)<br/>• navigationSteps[]<br/>• completionReason"]
    end

    SESSION --> BrowseMode
    SESSION --> FocusMode
    AXTREE --> BrowseMode
    AXTREE --> FocusMode
    BrowseMode --> RESULT
    FocusMode --> RESULT
```

**Execution Order:**

1. Headings (H key) - max 100 steps
2. Landmarks (D key) - max 100 steps
3. Buttons (B key) - max 100 steps
4. Links (K key) - max 500 steps
5. Heading levels 1-6 - max 500 steps each
6. Down arrow (linear) - max 1000 steps
7. Tab (focus order) - max 500 steps

**Completion Reasons:**

- `exhausted` - No more elements found
- `limit-reached` - Hit max steps
- `cycle-complete` - Returned to start (Tab)
- `trapped` - Focus trap detected

---

### Stage 5: Transcript Generation

```mermaid
flowchart LR
    subgraph Input
        STEPS["Navigation Steps"]
    end

    subgraph NavigationStep
        IDX["index"]
        ID["identifier"]
        PHRASES["spokenPhrases[]"]
        TEXT["itemText"]
        AX["axNode"]
        HTML["htmlSnippet"]
    end

    subgraph Output
        JSON["transcript.json"]
        TXT["transcript-readable.txt"]
    end

    STEPS --> NavigationStep --> JSON
    NavigationStep --> TXT
```

**NavigationStep Structure:**

```json
{
    "index": 0,
    "identifier": "main-heading",
    "spokenPhrases": ["Products", "heading level 1"],
    "itemText": "Products",
    "axNode": {
        "role": { "value": "heading" },
        "name": { "value": "Products" },
        "level": { "value": 1 }
    },
    "htmlSnippet": "<h1 id=\"main-heading\">Products</h1>"
}
```

---

### Stage 6: Rule-Based Analysis

```mermaid
flowchart TB
    subgraph Input
        TRANSCRIPT["Transcript<br/>(StrategyResult[])"]
        PAGE["Live Page"]
        CDP["CDP Session"]
    end

    subgraph RuleCategories["28 Custom Rules"]
        HEADING["Heading Structure<br/>• missing-h1<br/>• multiple-h1<br/>• heading-level-skipped<br/>• empty-heading"]
        LANDMARK["Landmark Structure<br/>• missing-main-landmark<br/>• duplicate-landmark"]
        FOCUS["Focus & Keyboard<br/>• focus-trap<br/>• focus-order-anomaly<br/>• button/link-not-in-tab-order<br/>• positive-tabindex"]
        LINKTEXT["Link Text<br/>• generic-link-text<br/>• duplicate-link-text<br/>• fragmented-link-text"]
        CONTENT["Content Structure<br/>• large-content-gap<br/>• steps-to-main-content<br/>• excessive-navigation-links<br/>• ..."]
        INTERACTIVE["Interactive Elements<br/>• empty-accessible-name<br/>• form-field-no-label<br/>• aria-hidden-focusable<br/>• missing-skip-link"]
        SEMANTIC["Semantic<br/>• filename-as-alt<br/>• role-mismatch"]
    end

    subgraph AxeCore["axe-core (90+ rules)"]
        AXE["Industry standard<br/>DOM-based checks"]
    end

    subgraph Output
        VIOLATIONS["violations.json<br/>• ruleId<br/>• impact<br/>• wcag<br/>• htmlSnippet<br/>• screenshot (base64)"]
        SCREENSHOTS["screenshots/<br/>violation-*.png"]
    end

    TRANSCRIPT --> RuleCategories
    PAGE --> AxeCore
    CDP --> SCREENSHOTS
    RuleCategories --> VIOLATIONS
    AxeCore --> VIOLATIONS
    VIOLATIONS --> SCREENSHOTS
```

**Violation Structure:**

```json
{
    "ruleId": "focus-trap",
    "impact": "critical",
    "wcag": ["2.1.2"],
    "message": "Focus trap detected in modal dialog",
    "htmlSnippet": "<div class=\"modal\">...</div>",
    "context": {
        "strategy": "tab",
        "stepIndex": 45,
        "screenshot": "data:image/png;base64,..."
    }
}
```

---

### Stage 7: LLM Prompt Generation

```mermaid
flowchart TB
    subgraph Input
        TRANSCRIPT["Transcript Data"]
        VIOLATIONS["Violations"]
        PAGEINFO["Page Context<br/>(URL, Title)"]
    end

    subgraph PromptBuilder
        CONFIG["Configuration<br/>• includeHtmlSnippets<br/>• includeAxNodes<br/>• maxViolationsPerGroup"]
        BUILD["Build Sections"]
    end

    subgraph SystemPrompt["System Prompt"]
        ROLE["Role: Accessibility expert"]
        CATEGORIES["Analysis categories<br/>• reading-order<br/>• cognitive-load<br/>• semantic-mismatch<br/>• consistency<br/>• missing-context"]
        SCHEMA["Output JSON schema"]
    end

    subgraph UserPrompt["User Prompt"]
        TRANSXML["<transcript> XML"]
        VIOLXML["<violations> XML"]
        INSTRUCT["Analysis instructions"]
    end

    subgraph Output
        SYS["llm-prompt-system.txt"]
        USR["llm-prompt-user.txt"]
        COMB["llm-prompt-combined.txt"]
    end

    TRANSCRIPT --> PromptBuilder
    VIOLATIONS --> PromptBuilder
    PAGEINFO --> PromptBuilder
    CONFIG --> PromptBuilder
    PromptBuilder --> SystemPrompt
    PromptBuilder --> UserPrompt
    SystemPrompt --> SYS
    UserPrompt --> USR
    SYS --> COMB
    USR --> COMB
```

**Prompt Files:**

| File                      | Purpose                         | Size     |
| ------------------------- | ------------------------------- | -------- |
| `llm-prompt-system.txt`   | Instructions and schema         | ~3KB     |
| `llm-prompt-user.txt`     | Transcript + violations data    | Variable |
| `llm-prompt-combined.txt` | Full prompt for chat interfaces | Combined |

---

### Stage 8: LLM Analysis (Manual Step)

```mermaid
flowchart LR
    subgraph Input
        PROMPT["llm-prompt-combined.txt"]
    end

    subgraph Manual["Manual Step"]
        COPY["Copy prompt"]
        PASTE["Paste into LLM<br/>(Claude, GPT, etc.)"]
        SAVE["Save response"]
    end

    subgraph Output
        RESPONSE["llm-response.json"]
    end

    PROMPT --> COPY --> PASTE --> SAVE --> RESPONSE
```

**Expected LLM Response Schema:**

```json
{
  "summary": {
    "overallAssessment": "needs-review",
    "keyIssues": ["Focus trap in modal", "..."],
    "positiveAspects": ["Good heading structure"]
  },
  "findings": [
    {
      "category": "reading-order",
      "title": "Footer announced before main content",
      "severity": "serious",
      "confidence": "high",
      "evidence": { "steps": [...] },
      "recommendation": "Move footer landmark after main"
    }
  ],
  "violationEnhancements": [
    {
      "ruleId": "focus-trap",
      "assessment": "confirmed",
      "reasoning": "Modal has no escape route"
    }
  ]
}
```

---

### Stage 9: Report Generation

```mermaid
flowchart TB
    subgraph Input
        LLM["llm-response.json"]
        VIOL["violations.json"]
        TRANS["transcript.json"]
    end

    subgraph Process["generateReportFromFiles()"]
        PARSE["Parse & Validate<br/>(Zod schemas)"]
        MERGE["Merge Data Sources"]
        ENHANCE["Enhance violations<br/>with LLM insights"]
    end

    subgraph Reporters
        HTML["HtmlReporter"]
        JSON["JsonReporter"]
    end

    subgraph Output
        REPORT["report.html<br/>or report.json"]
    end

    LLM --> PARSE
    VIOL --> PARSE
    TRANS --> PARSE
    PARSE --> MERGE --> ENHANCE
    ENHANCE --> HTML --> REPORT
    ENHANCE --> JSON --> REPORT
```

**Command:** `a11y report --dir <audit-dir>`

**HTML Report Sections:**

1. **Summary** - Overall assessment, key issues
2. **LLM Findings** - Semantic analysis results
3. **Rule Violations** - Grouped by impact
4. **Screenshots** - Embedded violation screenshots
5. **Transcript** - Collapsible navigation logs

---

## Output Files Summary

```
audit-results/example.com-2026-09-01T13-09/
├── violations.json          # Rule-detected violations
├── transcript.json          # Raw navigation data
├── transcript-readable.txt  # Human-readable transcript
├── llm-prompt-system.txt    # System prompt for LLM
├── llm-prompt-user.txt      # User prompt with data
├── llm-prompt-combined.txt  # Full prompt for chat
├── screenshots/             # Violation screenshots
│   ├── focus-trap-001.png
│   └── ...
├── llm-response.json        # (User adds after LLM analysis)
└── report.html              # (Generated by a11y report)
```

---

## Data Flow Diagram

```mermaid
flowchart TB
    subgraph Stage1["CLI Input"]
        A1[URL + Options]
    end

    subgraph Stage2["Browser"]
        A2[Page Object]
    end

    subgraph Stage3["Screen Reader"]
        A3[Navigator + Driver]
    end

    subgraph Stage4["Navigation"]
        A4[12 Strategies Execute]
    end

    subgraph Stage5["Transcript"]
        A5[transcript.json<br/>StrategyResult[]]
    end

    subgraph Stage6["Analysis"]
        A6[violations.json<br/>Violation[]]
    end

    subgraph Stage7["Prompts"]
        A7[llm-prompt-*.txt]
    end

    subgraph Stage8["LLM"]
        A8[llm-response.json]
    end

    subgraph Stage9["Report"]
        A9[report.html]
    end

    A1 --> A2 --> A3 --> A4 --> A5
    A5 --> A6
    A2 --> A6
    A5 --> A7
    A6 --> A7
    A7 -.->|manual| A8
    A5 --> A9
    A6 --> A9
    A8 --> A9
```

---

## Key Interfaces

### StrategyResult

```typescript
interface StrategyResult {
    meta: {
        name: string; // e.g., "heading", "tab"
        description: string;
        mode: 'browse' | 'focus';
        type?: string; // e.g., "heading", "tab"
    };
    navigationSteps: NavigationStep[];
    completionReason: {
        kind: 'exhausted' | 'limit-reached' | 'cycle-complete' | 'trapped';
        detail: string;
    };
}
```

### Violation

```typescript
interface Violation {
    ruleId: string;
    impact: 'critical' | 'serious' | 'moderate' | 'minor';
    wcag: string[];
    message: string;
    htmlSnippet?: string;
    context?: {
        strategy?: string;
        stepIndex?: number;
        screenshot?: string; // base64 or file path
    };
}
```

### ReportData

```typescript
interface ReportData {
    analysis: LlmCompleteResponse; // Parsed LLM response
    violations: Violation[]; // Rule violations
    transcript?: StrategyResult[]; // Navigation data
    meta: {
        timestamp: number;
        duration?: number;
        strategies?: string[];
    };
}
```
