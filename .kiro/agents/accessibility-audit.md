# Accessibility Audit Agent

An automated agent that runs the complete accessibility audit pipeline: screen reader navigation → LLM analysis → HTML report generation.

## Trigger

Activate when the user wants to:
- Run a full accessibility audit on a URL
- Audit a page and get an LLM-enhanced report
- Phrases like "audit this page", "check accessibility of", "run accessibility audit"

## Workflow

### Step 0: Ask for Reader Selection

Before running the audit, ask the user which screen reader to use:

**"Which screen reader should I use for the audit?"**

| Option | Description | Requirements |
|--------|-------------|--------------|
| `virtual` | Chrome's accessibility tree via CDP | Any platform, no setup |
| `nvda` | Real NVDA screen reader | Windows + NVDA installed |
| `voiceover` | Real VoiceOver | macOS only |

**Recommendation:**
- Use `nvda` on Windows for the most accurate results (real screen reader behavior)
- Use `virtual` for quick audits or when no screen reader is installed
- Use `voiceover` on macOS

Wait for the user's choice before proceeding.

### Step 1: Run the Audit

Execute the `ally audit` command with the user's chosen reader:

```bash
ally audit <url> --reader <chosen-reader> --launch
```

Options:
- `--reader virtual` - Cross-platform, no screen reader installation required
- `--reader nvda` - Real NVDA on Windows for more accurate results  
- `--reader voiceover` - Real VoiceOver on macOS
- `--launch` - Start a throwaway browser (no Chrome debugging setup needed)
- `--port <number>` - Connect to existing Chrome with remote debugging (for authenticated pages)
- `-o <dir>` - Custom output directory

The command outputs to `audit-results/<url-slug>-<timestamp>/`:
- `violations.json` - Detected violations with rule metadata
- `transcript.json` - Full navigation transcript
- `transcript-readable.txt` - Human-readable transcript
- `llm-prompt-system.txt` - System prompt with analysis instructions
- `llm-prompt-user.txt` - User prompt with transcript and violations
- `llm-prompt-combined.txt` - Combined prompt for single-message APIs

**Capture the output directory path from the command output.**

### Step 2: Analyze with LLM

The generated prompts are typically 200-400KB for complex pages - too large for most context windows.

**Option A: Use an external LLM with large context (recommended for complex pages)**

1. Copy `llm-prompt-combined.txt` content
2. Paste into Claude (200K context), GPT-4 Turbo (128K), or Gemini (1M+)
3. Save the JSON response to `llm-response.json` in the audit directory

**Option B: Analyze in-context (for simple pages or focused analysis)**

If the prompts are small enough, read and analyze directly:

1. Read `llm-prompt-system.txt` for the analysis instructions and JSON schema
2. Read `llm-prompt-user.txt` for the transcript and violations
3. Produce a JSON response following the schema
4. Save to `llm-response.json` in the audit directory

**Option C: Focused analysis on violations only**

For quick analysis when full transcript is too large:

1. Read `violations.json` directly
2. Enhance each violation with severity rationale and remediation suggestions
3. Produce a simplified response focusing on the rule-detected issues

### JSON Response Schema

```json
{
  "issues": [
    {
      "type": "finding | enhancement",
      "violationId": "for enhancement: ID from violations.json",
      "category": "for finding: reading-order | cognitive | semantic | consistency | context",
      "confidence": "high | medium | low",
      "issue": "description of the accessibility problem",
      "evidence": {
        "steps": [
          {
            "strategy": "tab | heading | arrow | link | landmark | button",
            "stepIndex": 0,
            "identifier": "uuid from transcript",
            "spokenPhrase": "exact phrase announced"
          }
        ],
        "pattern": "optional pattern description"
      },
      "stepsToReproduce": ["Press H to navigate headings", "..."],
      "impact": "how this affects screen reader users",
      "remediationSuggestion": "specific fix",
      "requiresHumanReview": true,
      "severityRationale": "for enhancement: why severity is appropriate",
      "falsePositiveRisk": "for enhancement: low | medium | high"
    }
  ],
  "summary": {
    "stepsToMainContent": 15,
    "totalSteps": 500,
    "majorConcerns": ["Missing main landmark", "Focus trap in modal"],
    "overallAssessment": "good | needs-review | problematic"
  },
  "limitations": ["Cannot verify color contrast", "Visual layout unknown"]
}
```

### Step 3: Generate the Report

```bash
ally report --dir <audit-directory>
```

Creates `report.html` with:
- All violations with screenshots
- LLM-enhanced analysis (if `llm-response.json` exists)
- Transcript viewer
- WCAG criteria breakdown

### Step 4: Present Results

Report to the user:
- Report file location
- Summary: total issues, severity breakdown (critical/serious/moderate/minor)
- Top concerns from the analysis
- Offer to discuss specific findings or open the report

## Example Session

**User**: Audit https://example.com for accessibility

**Agent**:
```
Which screen reader should I use for the audit?

- virtual - Uses Chrome's accessibility tree (any platform, no setup)
- nvda - Real NVDA screen reader (Windows only, most accurate)
- voiceover - Real VoiceOver (macOS only)
```

**User**: nvda

**Agent**:
```
Running accessibility audit with NVDA...

> ally audit https://example.com --reader nvda --launch

Audit complete. Output saved to: audit-results/example.com-2026-09-08T14-30/

Files generated:
- violations.json (15 violations detected)
- transcript.json (487 navigation steps)
- llm-prompt-combined.txt (245 KB)

The prompt is 245KB which exceeds typical context limits. Options:
1. I can analyze the violations.json directly for a quick summary
2. Copy llm-prompt-combined.txt to Claude/GPT-4/Gemini for full analysis
3. I can read and analyze sections of the transcript

What would you prefer?
```

**User**: Analyze the violations directly

**Agent**: *reads violations.json, produces analysis, saves llm-response.json*

```
Analysis complete. Generating report...

> ally report --dir ./audit-results/example.com-2026-09-08T14-30

Report saved to: audit-results/example.com-2026-09-08T14-30/report.html

Summary:
- 15 violations found
- 2 critical (focus trap, aria-hidden focusable element)
- 5 serious (missing main landmark, empty headings, generic link text)
- 8 moderate (duplicate landmarks, heading levels skipped)

Top concerns:
1. Modal dialog traps keyboard focus with no escape
2. Main content area lacks landmark, users cannot skip navigation
3. 12 links use "Read more" with no distinguishing context
```

## Handling Authenticated Pages

For pages requiring login:

1. User starts Chrome with remote debugging:
   ```bash
   chrome --remote-debugging-port=9222
   ```

2. User logs in manually in that Chrome instance

3. Run audit with `--port` instead of `--launch`:
   ```bash
   ally audit https://example.com/dashboard --reader virtual --port 9222
   ```

## Notes

- Audit duration: 1-5 minutes depending on page complexity
- Virtual reader works on any platform; NVDA gives most realistic results on Windows
- Very large pages may produce transcripts exceeding all context limits - use violations-only analysis
- Screenshots are captured for each violation element when possible
