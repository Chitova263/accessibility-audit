// Core types
export type { Violation, WcagCriterion, NvdaViolation, NvdaToolDetails } from './violation';

// Analyzers
export { analyzeEmptyAccessibleNames } from './analyzers/empty-accessible-name';
export type { EmptyAccessibleNameAnalyzerResult } from './analyzers/empty-accessible-name';

export { analyzeHeadingStructure } from './analyzers/heading-structure';
export type { HeadingStructureAnalyzerResult } from './analyzers/heading-structure';

export { analyzeLandmarkStructure } from './analyzers/landmark-structure';
export type { LandmarkStructureAnalyzerResult } from './analyzers/landmark-structure';

export { analyzeLinkText } from './analyzers/link-text';
export type { LinkTextAnalyzerResult } from './analyzers/link-text';

export { analyzeFocusTraps } from './analyzers/focus-trap';
export type { FocusTrapAnalyzerResult } from './analyzers/focus-trap';

export { analyzeKeyboardAccessibility } from './analyzers/keyboard-accessibility';
export type { KeyboardAccessibilityAnalyzerResult } from './analyzers/keyboard-accessibility';

export { analyzeImageAltText } from './analyzers/image-alt-text';
export type { ImageAltTextAnalyzerResult } from './analyzers/image-alt-text';

export { analyzeRoleMismatch } from './analyzers/role-mismatch';
export type { RoleMismatchAnalyzerResult } from './analyzers/role-mismatch';

export { analyzeFocusOrder } from './analyzers/focus-order';
export type { FocusOrderAnalyzerResult } from './analyzers/focus-order';

export { analyzeSkipLink } from './analyzers/skip-link';
export type { SkipLinkAnalyzerResult } from './analyzers/skip-link';

export { analyzeFormLabels } from './analyzers/form-labels';
export type { FormLabelsAnalyzerResult } from './analyzers/form-labels';

export { analyzeAriaHiddenFocusable } from './analyzers/aria-hidden-focusable';
export type { AriaHiddenFocusableAnalyzerResult } from './analyzers/aria-hidden-focusable';

export { analyzeNavigationSize } from './analyzers/navigation-size';
export type { NavigationSizeAnalyzerResult } from './analyzers/navigation-size';

export { analyzeWithAxeCore } from './analyzers/axe-core';
export type { AxeCoreAnalyzerResult, AxeViolation, AxeToolDetails } from './analyzers/axe-core';
