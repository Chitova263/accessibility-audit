# Accessibility Audit Tool

An automated accessibility auditing tool that uses screen reader navigation to detect WCAG violations. The tool drives screen readers through multiple navigation strategies (headings, landmarks, links, tab order, arrow keys) and analyzes the output to identify accessibility issues.

Static analyzers like axe-core and Lighthouse can only inspect the DOM - they cannot detect issues that require actual user interaction. This tool bridges that gap by using a screen reader to find focus traps, tab order problems, missing skip links in practice, and content structure issues that only become apparent when navigating a page.

## Features

- **Real screen reader testing** with three driver options:
    - **NVDA** (default) - Uses the real NVDA screen reader via [@guidepup/guidepup](https://github.com/guidepup/guidepup). Requires Windows with NVDA installed.
    - **VoiceOver** - Uses the real VoiceOver screen reader via [@guidepup/guidepup](https://github.com/guidepup/guidepup). Requires macOS.
    - **Virtual** - Uses [@guidepup/virtual-screen-reader](https://github.com/guidepup/virtual-screen-reader) which runs headless in the browser. Works on any platform, no screen reader installation required.
- **Multiple navigation strategies** (headings, landmarks, links, buttons, tab order, arrow keys) that mimic how visually impaired people navigate websites
- **Automated violation detection** with WCAG criterion mapping
- **LLM prompt generation** for AI-assisted accessibility analysis
- **HTML report generation** with detailed findings

## Installation

```bash
npm install
```

### Screen Reader Setup (NVDA/VoiceOver)

Before using NVDA or VoiceOver drivers, you need to set up your environment for screen reader automation using [@guidepup/setup](https://github.com/guidepup/setup):

```bash
# One-time machine setup (configures OS for screen reader automation)
npx @guidepup/setup setup

# Install required screen reader assets for your project
npx @guidepup/setup install
```

#### Windows (NVDA)

The setup command installs a portable NVDA instance compatible with Guidepup. No additional configuration needed.

#### macOS (VoiceOver)

You may need to complete manual setup steps:

1. Open **System Settings > Privacy & Security > Accessibility**
2. Add your terminal application (Terminal, iTerm2, VS Code, etc.)
3. Enable VoiceOver in **System Settings > Accessibility > VoiceOver**

For CI environments, use `npx @guidepup/setup setup --ci` to skip interactive prompts.

> **Note:** The `virtual` reader option requires no screen reader setup and works on any platform.

### Chrome Remote Debugging

The tool connects to Chrome via the [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/) on port 9222. You must start Chrome with remote debugging enabled before running an audit:

**Windows:**

```bash
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

**macOS:**

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

**Linux:**

```bash
google-chrome --remote-debugging-port=9222
```

> **Tip:** Create a shortcut or alias for convenience. Make sure to close all existing Chrome instances before starting with the debug flag, or use a separate user data directory with `--user-data-dir=/tmp/chrome-debug`.

### Global CLI Installation

To install the CLI tools globally:

```bash
npm run build
npm link
```

This makes two commands available:

- `a11y audit` - Run accessibility audits
- `a11y report` - Generate HTML reports

To uninstall:

```bash
npm unlink -g accessibility-audit
```

## Usage

### 1. Run Accessibility Audit

```bash
a11y audit <url> [options]
```

**Arguments:**

- `url` - URL to audit (required)

**Options:**

| Option                   | Description                                      | Default                                |
| ------------------------ | ------------------------------------------------ | -------------------------------------- |
| `-o, --output-dir <dir>` | Output directory for audit files                 | `audit-results/<url-slug>-<timestamp>` |
| `--max-steps <number>`   | Maximum steps per navigation strategy            | `500`                                  |
| `-r, --reader <type>`    | Screen reader: `nvda`, `virtual`, or `voiceover` | `nvda`                                 |
| `-s, --speech`           | Enable NVDA speech audio output                  | `false`                                |
| `-v, --verbose`          | Enable verbose output                            | `false`                                |
| `-h, --help`             | Display help                                     |                                        |

**Example:**

```bash
# Using NVDA (default, requires Windows + NVDA installed)
# Output goes to audit-results/example.com-shop-products-step-1-2026-09-01T13-09/
a11y audit https://example.com/shop/products --verbose

# Specify a custom output directory
a11y audit -o ./my-audit --verbose

# Using virtual screen reader (works on any platform)
npx a11y audit https://example.com --reader virtual
```

**Output files (inside the run directory):**

- `violations.json` - All detected violations (with embedded screenshot references)
- `transcript.json` - Screen reader navigation transcript
- `transcript-readable.txt` - Human-readable transcript
- `llm-prompt-system.txt` - System prompt for LLM API
- `llm-prompt-user.txt` - User prompt for LLM API
- `llm-prompt-combined.txt` - Combined prompt for chat interfaces
- `screenshots/` - Element screenshots for violations (when available)
- `llm-response.json` - Drop your LLM response here before generating the report
- `report.html` - Generated by `a11y report`

### 2. Generate Report

```bash
a11y report [options]
```

**Options:**

| Option                  | Description                                                  | Default                   |
| ----------------------- | ------------------------------------------------------------ | ------------------------- |
| `--dir <dir>`           | Audit run directory — sets default paths for all files below | _none_                    |
| `--llm-response <path>` | Path to LLM response JSON                                    | `<dir>/llm-response.json` |
| `--violations <path>`   | Path to violations JSON                                      | `<dir>/violations.json`   |
| `--transcript <path>`   | Path to transcript JSON                                      | `<dir>/transcript.json`   |
| `-f, --format <format>` | Output format: `html` or `json`                              | `html`                    |
| `-o, --output <path>`   | Output file path                                             | `<dir>/report.html`       |
| `-h, --help`            | Display help                                                 |                           |

**Example:**

```bash
# Point at a run directory — all paths resolved automatically
a11y report --dir ./audit-results/example.com-2026-09-01T13-09

# Or specify individual file paths
a11y report \
  --violations ./my-audit/violations.json \
  --transcript ./my-audit/transcript.json \
  -o report.html
```

## Typical Workflow

1. Run the audit to collect violations and generate LLM prompts:

    ```bash
    a11y audit https://example.com
    # Output goes to audit-results/example.com-2026-09-01T13-09/
    ```

2. (Optional) Send `llm-prompt-combined.txt` to an LLM and save the response as `llm-response.json` in the run directory

3. Generate the HTML report:
    ```bash
    a11y report --dir ./audit-results/example.com-2026-09-01T13-09
    ```

## Rules

The tool includes custom rules that detect violations beyond what axe-core covers. Each rule maps to specific WCAG success criteria. Rules are organized into categories under `src/analysis/rules/`:

```
rules/
├── heading-structure/      # missing-h1, multiple-h1, heading-level-skipped, empty-heading
├── landmark-structure/     # missing-main-landmark, duplicate-landmark
├── focus-and-keyboard/     # focus-trap, focus-order-anomaly, positive-tabindex, button/link-not-in-tab-order
├── link-text/              # generic-link-text, duplicate-link-text
├── content-structure/      # large-content-gap, landmark-without-heading, steps-to-main-content, etc.
├── interactive-elements/   # empty-accessible-name, aria-hidden-focusable, form-field-no-label, missing-skip-link
├── semantic/               # filename-as-alt, role-mismatch
└── axe-core/               # Integration with axe-core (90+ rules)
```

### Rule Summary

| Rule ID                            | Summary                                                         | WCAG  | Level | Impact   | Why Static Analyzers Cannot Detect (axe-core, Lighthouse)     |
| ---------------------------------- | --------------------------------------------------------------- | ----- | ----- | -------- | ------------------------------------------------------------- |
| `empty-accessible-name`            | Interactive element has no accessible name                      | 4.1.2 | A     | serious  | -                                                             |
| `missing-h1`                       | Page has no H1 heading                                          | 1.3.1 | A     | serious  | -                                                             |
| `multiple-h1`                      | Page has more than one H1                                       | 1.3.1 | A     | moderate | Requires understanding page context and intent                |
| `heading-level-skipped`            | Heading levels are skipped (e.g., H1 to H3)                     | 1.3.1 | A     | moderate | -                                                             |
| `empty-heading`                    | Heading has no text content                                     | 1.3.1 | A     | serious  | -                                                             |
| `missing-main-landmark`            | Page has no main landmark                                       | 1.3.1 | A     | serious  | -                                                             |
| `duplicate-landmark`               | Multiple landmarks of same type without unique names            | 1.3.1 | A     | moderate | -                                                             |
| `generic-link-text`                | Link uses generic text like "click here" or "read more"         | 2.4.4 | A     | serious  | Requires semantic understanding of link text quality          |
| `duplicate-link-text`              | Multiple links with same text but different destinations        | 2.4.4 | A     | moderate | -                                                             |
| `fragmented-link-text`             | Link text fragmented into individual characters                 | 2.4.4 | A     | critical | Requires detecting character-by-character link sequences      |
| `focus-trap`                       | Keyboard focus trap where the user cannot escape using Tab      | 2.1.2 | A     | critical | Requires real keyboard navigation to detect traps             |
| `button-not-in-tab-order`          | Button reachable via B key but not Tab                          | 2.1.1 | A     | serious  | Requires comparing screen reader vs keyboard navigation       |
| `link-not-in-tab-order`            | Link reachable via K key but not Tab                            | 2.1.1 | A     | serious  | Requires comparing screen reader vs keyboard navigation       |
| `filename-as-alt`                  | Image has a filename as alt text (e.g., "IMG_1234.jpg")         | 1.1.1 | A     | serious  | Requires pattern recognition of filename formats              |
| `role-mismatch`                    | Element's ARIA role doesn't match the underlying HTML element   | 4.1.2 | A     | moderate | -                                                             |
| `focus-order-anomaly`              | Focus jumps backwards or skips large sections                   | 2.4.3 | A     | serious  | Requires tracking actual focus movement sequence              |
| `positive-tabindex`                | Element has positive tabindex disrupting natural order          | 2.4.3 | A     | serious  | -                                                             |
| `missing-skip-link`                | No skip link found in the first tab stops                       | 2.4.1 | A     | serious  | -                                                             |
| `form-field-no-label`              | Form field has no accessible label                              | 3.3.2 | A     | critical | -                                                             |
| `aria-hidden-focusable`            | Focusable element has aria-hidden="true", creating silent focus | 4.1.2 | A     | critical | -                                                             |
| `nested-interactive-elements`      | Interactive elements are improperly nested (link in link, etc.) | 4.1.1 | A     | serious  | Requires detecting nested link/button patterns                |
| `excessive-navigation-links`       | Page has an excessive number of navigation links                | 2.4.1 | A     | moderate | Requires understanding what count is "excessive" for users    |
| `large-content-gap`                | Long run of main content with no heading between items          | 1.3.1 | A     | moderate | Requires analyzing content structure within main landmark     |
| `landmark-without-heading`         | Landmark contains many items but no heading                     | 1.3.1 | A     | moderate | Requires analyzing content density and structure              |
| `repeated-pattern-without-heading` | Repeated content pattern with no heading introducing the group  | 1.3.1 | A     | minor    | Requires pattern recognition across content                   |
| `steps-to-main-content`            | Main content reached only after excessive linear reading steps  | 2.4.1 | A     | moderate | Requires simulating linear screen reader navigation           |
| `reading-order-landmark-sequence`  | Landmarks announced out of logical reading order                | 1.3.2 | A     | serious  | Requires analyzing actual reading order experience            |
| `excessive-repetition`             | Same phrase announced many times consecutively                  | 1.3.1 | A     | minor    | Requires analyzing screen reader output patterns              |
| `excessive-blank-announcements`    | Long run of blank announcements in linear reading               | 1.3.1 | A     | moderate | Requires detecting empty/structural content via screen reader |
| `content-density-per-region`       | Landmark region contains an overwhelming number of items        | 2.4.1 | A     | moderate | Requires understanding cognitive load from user perspective   |

In addition to the above rules, the tool also runs **axe-core** (90+ rules) for industry-standard automated checks.
