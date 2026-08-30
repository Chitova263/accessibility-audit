# Accessibility Audit Tool

An automated accessibility auditing tool that uses real NVDA screen reader navigation to detect WCAG violations. The tool drives NVDA through multiple navigation strategies (headings, landmarks, links, tab order, arrow keys) and analyzes the screen reader output to identify accessibility issues.

Static analyzers like axe-core and Lighthouse can only inspect the DOM - they cannot detect issues that require actual user interaction. This tool bridges that gap by using a real screen reader to find focus traps, tab order problems, missing skip links in practice, and content structure issues that only become apparent when navigating a page.

## Features

- **Real screen reader testing** using NVDA via [@guidepup/guidepup](https://github.com/guidepup/guidepup)
- **Multiple navigation strategies** (headings, landmarks, links, buttons, tab order, arrow keys) that mimic how visually impaired people navigate websites
- **Automated violation detection** with WCAG criterion mapping
- **LLM prompt generation** for AI-assisted accessibility analysis
- **HTML report generation** with detailed findings

## Installation

```bash
npm install
```

## Usage

### 1. Run Accessibility Audit

```bash
npx tsx src/run-audit.ts <url> [options]
```

**Arguments:**
- `url` - URL to audit (required)

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `-o, --output-dir <dir>` | Output directory for audit files | `.` |
| `--max-steps <number>` | Maximum steps per navigation strategy | `500` |
| `-v, --verbose` | Enable verbose output | `false` |
| `-h, --help` | Display help | |

**Example:**
```bash
npx tsx src/run-audit.ts https://example.com -o ./audit-results --verbose
```

**Output files:**
- `violations.json` - All detected violations
- `transcript.json` - Screen reader navigation transcript
- `transcript-readable.txt` - Human-readable transcript
- `llm-prompt-system.txt` - System prompt for LLM API
- `llm-prompt-user.txt` - User prompt for LLM API
- `llm-prompt-combined.txt` - Combined prompt for chat interfaces

### 2. Generate Report

```bash
npx tsx src/generate-report.ts [options]
```

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `--url <url>` | Page URL for the report | *required* |
| `--title <title>` | Page title for the report | *required* |
| `--llm-response <path>` | Path to LLM response JSON | `./llm-response.json` |
| `--violations <path>` | Path to violations JSON | `./violations.json` |
| `--transcript <path>` | Path to transcript JSON | `./transcript.json` |
| `-f, --format <format>` | Output format: `html` or `json` | `html` |
| `-o, --output <path>` | Output file path | `./report.html` |
| `-h, --help` | Display help | |

**Example:**
```bash
npx tsx src/generate-report.ts --url https://example.com --title "Example Site" -o report.html
```

## Typical Workflow

1. Run the audit to collect violations and generate LLM prompts:
   ```bash
   npx tsx src/run-audit.ts https://example.com
   ```

2. (Optional) Send `llm-prompt-combined.txt` to an LLM and save the response to `llm-response.json`

3. Generate the HTML report:
   ```bash
   npx tsx src/generate-report.ts --url https://example.com --title "My Page"
   ```

## Rules

The tool includes custom analyzers that detect violations beyond what axe-core covers. Each rule maps to specific WCAG success criteria.

### Rule Summary

| Rule ID | Summary | WCAG | Level | Impact | axe-core Equivalent | Why axe-core Cannot Detect |
|---------|---------|------|-------|--------|---------------------|---------------------------|
| `empty-accessible-name` | Interactive element has no accessible name | 4.1.2 | A | serious | `button-name`, `link-name`, `aria-command-name` | - |
| `missing-h1` | Page has no H1 heading | 1.3.1 | A | serious | `page-has-heading-one` | - |
| `multiple-h1` | Page has more than one H1 | 1.3.1 | A | moderate | - | Requires understanding page context and intent |
| `heading-level-skipped` | Heading levels are skipped (e.g., H1 to H3) | 1.3.1 | A | moderate | `heading-order` | - |
| `empty-heading` | Heading has no text content | 1.3.1 | A | serious | `empty-heading` | - |
| `missing-main-landmark` | Page has no main landmark | 1.3.1 | A | serious | `landmark-one-main` | - |
| `duplicate-landmark` | Multiple landmarks of same type without unique names | 1.3.1 | A | moderate | `landmark-unique` | - |
| `generic-link-text` | Link uses generic text like "click here" or "read more" | 2.4.4 | A | serious | - | Requires semantic understanding of link text quality |
| `duplicate-link-text` | Multiple links with same text but different destinations | 2.4.4 | A | moderate | `identical-links-same-purpose` | - |
| `focus-trap` | Keyboard focus trap where the user cannot escape using Tab | 2.1.2 | A | critical | - | Requires real keyboard navigation to detect traps |
| `button-not-in-tab-order` | Button reachable via B key but not Tab | 2.1.1 | A | serious | - | Requires comparing screen reader vs keyboard navigation |
| `link-not-in-tab-order` | Link reachable via K key but not Tab | 2.1.1 | A | serious | - | Requires comparing screen reader vs keyboard navigation |
| `filename-as-alt` | Image has a filename as alt text (e.g., "IMG_1234.jpg") | 1.1.1 | A | serious | - | Requires pattern recognition of filename formats |
| `role-mismatch` | Element's ARIA role doesn't match the underlying HTML element | 4.1.2 | A | moderate | `aria-allowed-role` | - |
| `focus-order-anomaly` | Focus jumps backwards or skips large sections | 2.4.3 | A | serious | - | Requires tracking actual focus movement sequence |
| `positive-tabindex` | Element has positive tabindex disrupting natural order | 2.4.3 | A | serious | `tabindex` | - |
| `missing-skip-link` | No skip link found in the first tab stops | 2.4.1 | A | serious | `bypass`, `skip-link` | - |
| `form-field-no-label` | Form field has no accessible label | 3.3.2 | A | critical | `label`, `aria-input-field-name` | - |
| `aria-hidden-focusable` | Focusable element has aria-hidden="true", creating silent focus | 4.1.2 | A | critical | `aria-hidden-focus` | - |
| `excessive-navigation-links` | Page has an excessive number of links | 2.4.1 | A | moderate | - | Requires understanding what count is "excessive" for users |
| `large-content-gap` | Long run of content with no heading between items | 1.3.1 | A | moderate | - | Requires analyzing content structure from user perspective |
| `landmark-without-heading` | Landmark contains many items but no heading | 1.3.1 | A | moderate | - | Requires analyzing content density and structure |
| `repeated-pattern-without-heading` | Repeated content pattern with no heading introducing the group | 1.3.1 | A | minor | - | Requires pattern recognition across content |
| `steps-to-main-content` | Main content reached only after excessive linear reading steps | 2.4.1 | A | moderate | - | Requires simulating linear screen reader navigation |
| `reading-order-landmark-sequence` | Landmarks announced out of logical reading order | 1.3.2 | A | serious | - | Requires analyzing actual reading order experience |
| `excessive-repetition` | Same phrase announced many times consecutively | 1.3.1 | A | minor | - | Requires analyzing screen reader output patterns |
| `content-density-per-region` | Landmark region contains an overwhelming number of items | 2.4.1 | A | moderate | - | Requires understanding cognitive load from user perspective |

### Impact Levels

| Impact | Description |
|--------|-------------|
| **critical** | Blocks users entirely; must fix immediately |
| **serious** | Significant barrier; high priority fix |
| **moderate** | Causes difficulty; should fix |
| **minor** | Inconvenience; fix when possible |

### Analyzers

The rules are organized into analyzers, each focusing on a specific aspect of accessibility:

| Analyzer | Rules | Description |
|----------|-------|-------------|
| Empty Accessible Names | `empty-accessible-name` | Detects interactive elements without accessible names |
| Heading Structure | `missing-h1`, `multiple-h1`, `heading-level-skipped`, `empty-heading` | Validates heading hierarchy |
| Landmark Structure | `missing-main-landmark`, `duplicate-landmark` | Checks ARIA landmark usage |
| Link Text | `generic-link-text`, `duplicate-link-text` | Analyzes link text quality |
| Focus Traps | `focus-trap` | Detects keyboard traps |
| Keyboard Accessibility | `button-not-in-tab-order`, `link-not-in-tab-order` | Verifies keyboard navigation |
| Image Alt Text | `filename-as-alt` | Checks image alternative text |
| Role Mismatch | `role-mismatch` | Validates ARIA role usage |
| Focus Order | `focus-order-anomaly`, `positive-tabindex` | Analyzes focus sequence |
| Skip Link | `missing-skip-link` | Checks for bypass mechanisms |
| Form Labels | `form-field-no-label` | Validates form field labeling |
| Aria Hidden Focusable | `aria-hidden-focusable` | Detects hidden focusable elements |
| Navigation Size | `excessive-navigation-links` | Checks navigation complexity |
| Content Grouping | `large-content-gap`, `landmark-without-heading`, `repeated-pattern-without-heading` | Analyzes content structure |
| Steps To Main Content | `steps-to-main-content`, `missing-main-landmark` | Measures effort to reach main content |
| Reading Order | `reading-order-landmark-sequence` | Validates reading order |
| Excessive Repetition | `excessive-repetition` | Detects repetitive announcements |
| Content Density | `content-density-per-region` | Checks region complexity |
| axe-core | *(90+ rules)* | Industry-standard automated checks |

## Development

```bash
# Type checking
npm run typecheck

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Format code
npm run format
```

## License

Private
