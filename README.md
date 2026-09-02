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
| `-r, --reader <type>`    | Screen reader: `nvda`, `virtual`, or `voiceover` | _(required)_                           |
| `-v, --verbose`          | Enable verbose output                            | `false`                                |
| `-h, --help`             | Display help                                     |                                        |

**Example:**

```bash
# Using NVDA (requires Windows)
a11y audit https://example.com --reader nvda --verbose

# Using virtual screen reader (works on any platform)
a11y audit https://example.com --reader virtual

# Using VoiceOver (requires macOS)
a11y audit https://example.com --reader voiceover

# Specify a custom output directory
a11y audit https://example.com --reader nvda -o ./my-audit
```

**Output files (inside the run directory):**

| File                      | Description                                                       | Example                                     |
| ------------------------- | ----------------------------------------------------------------- | ------------------------------------------- |
| `violations.json`         | All detected violations with rule metadata and element context    | [example](examples/violations.json)         |
| `transcript.json`         | Screen reader navigation transcript with accessibility tree nodes | [example](examples/transcript.json)         |
| `transcript-readable.txt` | Human-readable transcript for quick review                        | [example](examples/transcript-readable.txt) |
| `llm-prompt-system.txt`   | System prompt for LLM API                                         | [example](examples/llm-prompt-system.txt)   |
| `llm-prompt-user.txt`     | User prompt for LLM API                                           | [example](examples/llm-prompt-user.txt)     |
| `llm-prompt-combined.txt` | Combined prompt for chat interfaces                               | [example](examples/llm-prompt-combined.txt) |
| `screenshots/`            | Element screenshots highlighting the violation location           | -                                           |
| `llm-response.json`       | Drop your LLM response here before generating the report          | [example](examples/llm-response.json)       |
| `report.html`             | Generated by `a11y report`                                        | -                                           |

### 2. Generate Report

```bash
a11y report [options]
```

**Options:**

| Option                  | Description                                                  | Default                   |
| ----------------------- | ------------------------------------------------------------ | ------------------------- |
| `--dir <dir>`           | Audit run directory - sets default paths for all files below | _none_                    |
| `--llm-response <path>` | Path to LLM response JSON                                    | `<dir>/llm-response.json` |
| `--violations <path>`   | Path to violations JSON                                      | `<dir>/violations.json`   |
| `--transcript <path>`   | Path to transcript JSON                                      | `<dir>/transcript.json`   |
| `-f, --format <format>` | Output format: `html` or `json`                              | `html`                    |
| `-o, --output <path>`   | Output file path                                             | `<dir>/report.html`       |
| `-h, --help`            | Display help                                                 |                           |

**Example:**

```bash
# Point at a run directory - all paths resolved automatically
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
    a11y audit https://example.com --reader virtual
    # Output goes to audit-results/example.com-2026-09-01T13-09/
    ```

2. (Optional) Send `llm-prompt-combined.txt` to an LLM and save the response as `llm-response.json` in the run directory

3. Generate the HTML report:
    ```bash
    a11y report --dir ./audit-results/example.com-2026-09-01T13-09
    ```

## Navigation Strategies

The tool navigates web pages using multiple strategies that mimic how visually impaired users explore websites with screen readers. Each strategy produces a transcript of what the screen reader announced.

| Strategy              | Description                                                                                                                                                                | NVDA | VoiceOver |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | --------- |
| **Heading**           | Navigates through all headings. Reveals heading hierarchy, missing headings, skipped levels, and whether the page structure is scannable.                                  | H    | VO+Cmd+H  |
| **Heading Level 1-6** | Navigates through headings of a specific level. Detects missing H1, multiple H1s, and whether section headings exist at expected levels.                                   | 1-6  | -         |
| **Landmark**          | Navigates through ARIA landmarks. Reveals missing main landmark, duplicate unlabeled landmarks, and whether users can skip to major page regions.                          | D    | VO+Cmd+L  |
| **Link**              | Navigates through all links. Detects generic link text ("click here"), duplicate link text pointing to different URLs, and links missing from tab order.                   | K    | VO+Cmd+L  |
| **Button**            | Navigates through all buttons. Detects buttons with empty accessible names, buttons missing from tab order, and mislabeled controls.                                       | B    | VO+Cmd+J  |
| **Tab**               | Navigates through focusable elements. Reveals tab order issues, focus traps, positive tabindex problems, missing skip links, and elements that aren't keyboard accessible. | Tab  | Tab       |
| **Arrow**             | Reads content linearly from top to bottom. Reveals reading order issues, content gaps without headings, excessive repetition, and how the page actually sounds to a user.  | ↓    | VO+↓      |

Example transcript entry: [examples/transcript-entry.jsonc](examples/transcript-entry.jsonc)

## Rules

The tool includes custom rules that detect violations beyond what axe-core covers. Each rule maps to specific WCAG success criteria.

### Rule Reference

Each entry below describes **exactly what the rule checks**, so that when you see a violation in a report you know what triggered it, what the screen reader observed, and what needs to be fixed.

#### Heading Structure

---

**`missing-h1`** - WCAG 1.3.1 A - serious

Navigates every heading on the page using NVDA's H key. If no H1 is found, the rule fires. A page without an H1 has no primary topic declaration - screen reader users cannot orient themselves by pressing `1` to jump to the page title.

Fix: Add exactly one `<h1>` that describes the main purpose of the page.

---

**`multiple-h1`** - WCAG 1.3.1 A - moderate

Navigates all headings and counts how many are H1. If more than one H1 is found, each additional H1 fires a separate violation. Having multiple H1s tells screen reader users there are multiple "top-level topics", which is structurally incorrect - a page has one primary heading.

Fix: Keep one H1 as the page title. Demote all other H1s to the appropriate level (H2 for sections, H3 for subsections, etc.).

---

**`heading-level-skipped`** - WCAG 1.3.1 A - moderate

Walks the sequence of headings in DOM order and checks that no level is skipped (e.g. H1 → H3 with no H2 in between). Skipped levels break the document outline - a screen reader user pressing `3` to find H3s would hear them without the expected H2 context above them.

Fix: Ensure heading levels form a continuous hierarchy. You may skip from H3 back up to H1, but you must not skip forward (H1 → H3 without H2).

---

**`empty-heading`** - WCAG 1.3.1 A - serious

Navigates all headings and checks whether each one has text content. An empty heading (`<h2></h2>` or `<h2><span aria-hidden="true">icon</span></h2>`) is announced as "heading level 2" with no label - users hear the role but get no information.

Fix: Remove headings with no content, or give them a meaningful accessible name.

#### Landmark Structure

---

**`missing-main-landmark`** - WCAG 1.3.1 A - serious

Navigates all ARIA landmarks using NVDA's D key and checks whether a `main` landmark exists. Without a `<main>` element (or `role="main"`), screen reader users cannot jump directly to the primary content - they must read through the header and navigation on every page visit.

Fix: Wrap your primary page content in a `<main>` element.

---

**`duplicate-landmark`** - WCAG 1.3.1 A - moderate

Navigates all landmarks and checks whether any landmark type (e.g. `navigation`, `complementary`) appears more than once without a unique accessible name. When two `<nav>` elements exist with no labels, NVDA announces both as "navigation landmark" - users cannot distinguish between them.

Fix: Add `aria-label` or `aria-labelledby` to each duplicate landmark to give it a unique name (e.g. `<nav aria-label="Main navigation">`, `<nav aria-label="Footer links">`).

#### Focus and Keyboard

---

**`focus-trap`** - WCAG 2.1.2 A - critical

Navigates all focusable elements using Tab and monitors whether focus escapes the page or returns to the same element repeatedly. A trap is declared when the Tab key cannot move focus to a new element after a set number of presses. Users who cannot use a mouse are permanently stuck.

Fix: Ensure all interactive components release Tab focus naturally. Modal dialogs should trap focus intentionally but must release it when closed (Escape key). No non-modal component should trap focus.

---

**`focus-order-anomaly`** - WCAG 2.4.3 A - serious

Records the sequence of elements receiving focus during Tab navigation and checks for large backwards jumps (focus moving significantly earlier in the DOM than expected) or large forward skips (focus jumping past a large block of content). This indicates that `tabindex` values or DOM order is disrupting the natural reading sequence.

Fix: Avoid positive `tabindex` values. Ensure DOM order matches visual reading order. Remove `tabindex` from non-interactive elements.

---

**`positive-tabindex`** - WCAG 2.4.3 A - serious

During Tab navigation, inspects the `tabindex` attribute of each focused element. If any element has `tabindex` greater than 0, the rule fires. Positive `tabindex` values create a separate, unpredictable focus sequence that overrides natural DOM order - an element with `tabindex="5"` will receive focus before elements that visually appear earlier on the page.

Fix: Remove all positive `tabindex` values. Use `tabindex="0"` to make non-interactive elements focusable, or `tabindex="-1"` to make them programmatically focusable without entering the tab sequence.

---

**`button-not-in-tab-order`** - WCAG 2.1.1 A - serious

Compares the list of buttons found via NVDA's B key (browse mode) against the list of elements reached via Tab key (focus mode). A button that B key finds but Tab never reaches is keyboard-inaccessible - mouse users can click it, but keyboard users cannot.

Fix: Ensure all actionable buttons are in the natural tab order (`tabindex="0"` or no tabindex on a `<button>` element). Check that buttons are not hidden with `display:none`, `visibility:hidden`, or `aria-hidden="true"` during tab navigation.

---

**`link-not-in-tab-order`** - WCAG 2.1.1 A - serious

Same logic as `button-not-in-tab-order` but for links. Compares links found via NVDA's K key against elements reached via Tab. A link reachable by K but not by Tab is invisible to keyboard navigation.

Fix: Same as above - ensure links have a natural tab stop. Common causes are `tabindex="-1"` being set on `<a>` elements or links inside `aria-hidden` containers.

#### Link Text

---

**`generic-link-text`** - WCAG 2.4.4 A - serious

Navigates all links using NVDA's K key and checks the announced link text against a list of known generic phrases: "click here", "read more", "learn more", "here", "more", "details", "link", and similar. Generic text fails because when a screen reader user lists all links on the page (NVDA+F7), every link must be self-describing - "read more" is meaningless without the surrounding visual context.

Fix: Make every link's accessible name describe its destination or purpose: "Read more about our privacy policy" rather than "Read more".

---

**`duplicate-link-text`** - WCAG 2.4.4 A - moderate

Navigates all links and groups them by announced text. If two or more links share identical text but point to different URLs, the rule fires. A screen reader user browsing links by K key or via the Elements List hears "Contact" twice with no way to know which contact page each link leads to.

Fix: Differentiate links that go to different destinations. Use `aria-label` or visually-hidden text to add context: `<a href="/contact-sales">Contact <span class="sr-only">sales team</span></a>`.

---

**`fragmented-link-text`** - WCAG 2.4.4 A - critical

Navigates all links and detects sequences where consecutive link announcements each contain a single character that spells out a word when read together. NVDA announces each character as a separate link - users hear "2 link", "2 link", "f link", "r link"... instead of "22 francs link".

**Common causes:**

1. **Separate `<a>` tags per character** - CSS letter-spacing effects or certain frameworks that wrap each character in its own link (e.g., `<a>B</a><a>o</a><a>o</a><a>k</a>`)

2. **Web components with shadow DOM** - When a link wraps content that includes web components with their own shadow DOM containing screen-reader-only text. As NVDA traverses the nested shadow DOM boundaries inside the link, it announces each character separately.

3. **Slotted content inside links** - Web component patterns where a parent component's shadow DOM contains a link with a `<slot>`, and the slotted light DOM content includes nested components with sr-only text.

**Fix options:**

- For separate `<a>` tags: Wrap the entire word or phrase in a single `<a>` element
- For web components inside links: Add `aria-label` to the component element itself (e.g., `<sdx-price aria-label="22 francs 15 per month">`)
- For sr-only spans inside shadow DOM: Add `role="text"` to prevent character-by-character traversal
- Consider moving accessible text to the light DOM level or using `aria-labelledby` to reference it

#### Interactive Elements

---

**`empty-accessible-name`** - WCAG 4.1.2 A - serious

During Tab navigation, inspects each focusable interactive element (buttons, links, inputs) for an accessible name. An element with no name is announced as its role only - "button" with no label gives the user no information about what the button does.

Fix: Every interactive element needs an accessible name. Use visible text content, `aria-label`, or `aria-labelledby`. For icon-only buttons, add `aria-label="Close"` or `aria-label="Search"`.

---

**`aria-hidden-focusable`** - WCAG 4.1.2 A - critical

During Tab navigation, checks whether any element that receives focus has `aria-hidden="true"` on itself or an ancestor. When focus lands on an `aria-hidden` element, NVDA goes silent - the element is in the tab order (so keyboard users reach it) but the screen reader is instructed to ignore it (so nothing is announced). Users hear nothing and do not know where focus is.

Fix: Never set `aria-hidden="true"` on focusable elements or their ancestors. If an element should be hidden from screen readers, also remove it from the tab order with `tabindex="-1"` or `display:none`.

---

**`form-field-no-label`** - WCAG 3.3.2 A - critical

During Tab navigation, inspects each form field (input, textarea, select) for an associated label. A field is considered unlabelled if it has no `<label>` element linked by `for`/`id`, no `aria-label`, and no `aria-labelledby`. NVDA announces unlabelled fields as "edit" or "combo box" with no description - users cannot tell what information to enter.

Fix: Associate a `<label for="fieldId">` with every form field, or add `aria-label="First name"` directly to the field element.

---

**`missing-skip-link`** - WCAG 2.4.1 A - serious

Checks the first five Tab stops on the page for a link whose destination is an anchor pointing to the main content area (e.g. `href="#main-content"`). If no such link exists in the first five stops, the rule fires. Without a skip link, keyboard users must Tab through the entire header and navigation on every page load before reaching content.

Fix: Add `<a href="#main-content" class="sr-only-focusable">Skip to main content</a>` as the very first element in the page body. Ensure the target (`id="main-content"`) exists on the `<main>` element.

---

**`nested-interactive-elements`** - WCAG 4.1.1 A - serious

During Tab and arrow navigation, detects interactive elements nested inside other interactive elements - for example a `<button>` inside an `<a>`, or an `<a>` inside another `<a>`. Nested interactive elements produce invalid HTML and unpredictable screen reader behavior. NVDA may announce both elements, only one, or behave differently across browsers.

Fix: Never nest interactive elements. If you need a clickable card with an inner button, use one of the established patterns: make the entire card a single link, or use a non-interactive container with the inner elements as the only focusable targets.

#### Content Structure

---

**`large-content-gap`** - WCAG 1.3.1 A - moderate

Navigates the main landmark using Down Arrow and counts consecutive steps without a heading announcement. If more than a configured threshold of steps pass with no heading, the rule fires. A long stretch of content with no heading makes it impossible for screen reader users to jump to a specific section - they must read everything linearly.

Fix: Introduce headings to break up long content sections. Every distinct section of content should start with a heading that describes what follows.

---

**`landmark-without-heading`** - WCAG 1.3.1 A - moderate

Identifies landmarks (navigation, complementary, etc.) that contain a significant number of items but have no heading inside them. A dense landmark with no heading is hard for screen reader users to understand - when they jump to it via D key, they hear the landmark role but get no label describing its purpose.

Fix: Add a heading as the first element inside the landmark. If the heading should not be visible, use visually-hidden CSS rather than `aria-hidden`.

---

**`repeated-pattern-without-heading`** - WCAG 1.3.1 A - minor

During Down Arrow navigation, detects sequences of similarly-structured announcements (e.g. multiple "clickable, Product name, graphic, Product name, price, button" patterns) that are not preceded by a heading. Without a heading, the group has no label - users cannot navigate to "Products" or "Search results" directly.

Fix: Add a heading before the repeating group. For product grids: `<h2>Search results</h2>`. For card lists: `<h2>Recommended articles</h2>`.

---

**`steps-to-main-content`** - WCAG 2.4.1 A - moderate

Counts how many Down Arrow presses are required before the main landmark content is first encountered. If the count exceeds a threshold, the rule fires. A high step count means users navigating linearly must read through headers, navigation, and banners before reaching the actual page content - every visit.

Fix: Either add a skip link (see `missing-skip-link`) or restructure the page so the main content appears early in the reading order.

---

**`reading-order-landmark-sequence`** - WCAG 1.3.2 A - serious

Records the order in which landmarks are announced during Down Arrow navigation and compares it against the order in which they appear in the DOM. If a landmark is encountered in linear reading significantly out of the sequence suggested by its DOM position, the rule fires. This indicates CSS positioning is creating a visual order that conflicts with the DOM reading order.

Fix: Ensure DOM order matches visual reading order. Avoid using CSS `position: absolute/fixed` or `order` (flexbox/grid) to place content in a visually different position from its DOM position.

---

**`excessive-navigation-links`** - WCAG 2.4.1 A - moderate

Navigates the navigation landmark using NVDA's K key and counts the total number of links. If the count exceeds a threshold (default: 20), the rule fires. A navigation region with an excessive number of links creates significant cognitive load - users must listen to or skip over many items to find what they need.

Fix: Group navigation items into subsections with headings, or consider progressive disclosure (expandable submenus). Ensure a skip link is present so users can bypass navigation entirely.

---

**`content-density-per-region`** - WCAG 2.4.1 A - moderate

Counts the number of distinct items announced inside each landmark region during arrow navigation. If a single region contains more than a threshold number of items, the rule fires. Overly dense regions are cognitively overwhelming for screen reader users who must listen to every item in sequence.

Fix: Split large regions into smaller, focused sections. Use headings and sub-landmarks to create navigable structure within dense content areas.

---

**`excessive-repetition`** - WCAG 1.3.1 A - minor

During Down Arrow navigation, detects any phrase that is announced 5 or more times consecutively. Consecutive repetition is disorienting - users cannot tell whether they are progressing through content or caught in a loop.

Note: if the repeated phrase is a button's accessible name and the repetition extends to the end of the transcript, see `unexited-subtree-repetition` for the specific cause and fix.

Fix: Identify the source of the repetition. Common causes: duplicate DOM nodes, repeated ARIA labels, or missing `aria-hidden` on decorative elements.

---

**`unexited-subtree-repetition`** - WCAG 4.1.2 A - moderate

During Down Arrow navigation, detects a button's accessible name being announced repeatedly (≥5 times) in a run that extends to (or near) the end of the arrow transcript, where a `button`-role AX node with a matching accessible name is found just before the run begins.

**Root cause (validated from NVDA source code):** NVDA's virtual buffer backend (`gecko_ia2.cpp`) recursively creates a `controlFieldNode` for every DOM descendant of the button. `getTextInfoSpeech()` in `speech.py` emits a speech sequence for each newly-entered control field as the virtual cursor moves. When a button contains unnamed child nodes - generic `<div>` wrappers, decorative `<img>` elements, SVG `<path>` and gradient `<stop>` nodes - NVDA traverses each one. Chrome propagates the button's accessible name down through its accessible name computation, so every child node's speech resolves to the same string. The result is one identical announcement per descendant node until the transcript is exhausted.

This is structurally different from `excessive-repetition`: it is not a content duplication problem but a DOM architecture problem caused by missing `aria-hidden` on internal structure.

Fix: Add `aria-hidden="true"` to all decorative child containers inside the button, and set the accessible name directly on the button via `aria-label`. Example:

```html
<button aria-label="Hello, how can I help you?">
    <div aria-hidden="true">
        <img src="avatar.webp" />
    </div>
    <div aria-hidden="true">
        <svg>...</svg>
        <span>Hello, how can I help you?</span>
    </div>
</button>
```

---

**`excessive-blank-announcements`** - WCAG 1.3.1 A - moderate

During Down Arrow navigation, counts consecutive steps where NVDA announces nothing (blank/empty). A long run of blank announcements indicates structural DOM content - empty divs, spacer elements, hidden containers - that NVDA is traversing but has nothing to say about. Users must keep pressing Down Arrow with no feedback, unsure whether they are progressing or stuck.

Fix: Add `aria-hidden="true"` to purely structural/decorative elements that have no content. Remove empty DOM nodes that serve no semantic purpose.

#### Semantic

---

**`filename-as-alt`** - WCAG 1.1.1 A - serious

During arrow or link navigation, inspects the announced name of images and checks it against filename patterns (`IMG_`, `DSC_`, `photo_`, `.jpg`, `.png`, `.webp`, etc.). An image with a filename as its alt text (`alt="IMG_4521.jpg"`) conveys nothing meaningful - the filename is an implementation detail, not a description.

Fix: Replace filename alt text with a description of what the image shows or what it communicates: `alt="Customer support agent smiling at desk"`.

---

**`role-mismatch`** - WCAG 4.1.2 A - moderate

During navigation, checks whether the ARIA `role` applied to an element matches the element's native HTML semantics. For example, a `<div role="button">` that behaves as a link, or a `<button role="link">`. Mismatched roles tell screen readers to treat the element as something it is not, leading to incorrect keyboard interaction expectations (e.g. users press Space to activate a "button" that is actually a link and expects Enter).

Fix: Use the correct native HTML element for the intended role wherever possible (`<a>` for links, `<button>` for buttons). If a custom element is necessary, ensure the applied ARIA role exactly matches the interaction pattern implemented.

In addition to the above rules, the tool also runs **axe-core** (90+ rules) for industry-standard automated checks.
