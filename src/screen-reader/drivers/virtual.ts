import type { ScreenReader, KeyPressResult } from './types';
import type { BrowserTarget } from '../browser-target';
import type { AXNode, AXProperty } from '../../types/cdp';
import { Logger } from '../../utils/logger';

/**
 * Role categories for navigation filtering.
 */
const LANDMARK_ROLES = new Set([
    'banner',
    'navigation',
    'main',
    'complementary',
    'contentinfo',
    'form',
    'region',
    'search',
]);

const HEADING_ROLES = new Set(['heading']);

const LINK_ROLES = new Set(['link']);

const BUTTON_ROLES = new Set(['button']);

const FOCUSABLE_ROLES = new Set([
    'button',
    'checkbox',
    'combobox',
    'link',
    'listbox',
    'menuitem',
    'menuitemcheckbox',
    'menuitemradio',
    'option',
    'radio',
    'searchbox',
    'slider',
    'spinbutton',
    'switch',
    'tab',
    'textbox',
    'treeitem',
]);

/**
 * Roles that NVDA treats as PRESCAT_SINGLELINE - atomic units whose children
 * are NOT traversed separately during browse mode navigation.
 *
 * From NVDA's textInfos/__init__.py getPresentationCategory():
 * These controls announce their name once, then the cursor moves past them.
 * Children (SVG paths, inner divs, icon spans) are NOT announced individually.
 *
 * This prevents the "Close, button" x30 repetition when a button contains
 * many DOM children that all inherit the button's accessible name.
 */
const SINGLELINE_ROLES = new Set([
    'button',
    'link',
    'checkbox',
    'radio',
    'switch',
    'menuitem',
    'menuitemcheckbox',
    'menuitemradio',
    'option',
    'tab',
    'treeitem',
    'slider',
    'spinbutton',
    'progressbar',
    'scrollbar',
]);

/**
 * CDP-based virtual screen reader driver.
 *
 * Uses Chrome's accessibility tree (via CDP) to simulate screen reader navigation.
 * Unlike other virtual screen reader implementations that parse the DOM directly,
 * this driver uses Chrome's actual accessibility tree - the same tree that real
 * screen readers (NVDA, VoiceOver) see. This means it fully supports shadow DOM
 * and web components.
 *
 * Trade-offs vs real screen readers:
 * - Phrase generation is simplified (no TTS engine quirks)
 * - No focus mode/browse mode distinction
 * - Works headless on any platform without screen reader installation
 */
export class VirtualScreenReader implements ScreenReader {
    readonly name = 'virtual' as const;
    private readonly log = Logger.context('VirtualDriver');
    private readonly target: BrowserTarget;

    private flatTree: AXNode[] = [];
    private cursorIndex = -1;

    // Track parent-child relationships for container context announcements
    private nodeParentMap = new Map<string, string>(); // nodeId -> parentId
    private nodeById = new Map<string, AXNode>(); // nodeId -> node

    constructor(target: BrowserTarget) {
        this.target = target;
    }

    async start(): Promise<void> {
        this.log.debug('Starting CDP virtual screen reader');
        await this.refreshTree();
        this.cursorIndex = -1;

        const focusableNodes = this.flatTree.filter((n) => this.isFocusable(n));
        const uniqueBackendNodeIds = new Set(focusableNodes.map((n) => n.backendDOMNodeId).filter(Boolean));
        const focusableWithoutDomId = focusableNodes.filter((n) => !n.backendDOMNodeId).length;
        const linkCount = this.flatTree.filter((n) => n.role?.value === 'link').length;
        const buttonCount = this.flatTree.filter((n) => n.role?.value === 'button').length;

        this.log.debug(
            `Loaded ${this.flatTree.length} accessible nodes (${focusableNodes.length} focusable [${uniqueBackendNodeIds.size} unique DOM nodes, ${focusableWithoutDomId} without backendDOMNodeId], ${linkCount} links, ${buttonCount} buttons)`
        );
    }

    async stop(): Promise<void> {
        this.log.debug('Stopping');
        this.flatTree = [];
        this.cursorIndex = -1;
    }

    async press(key: string): Promise<KeyPressResult> {
        await this.refreshTree();

        switch (key) {
            case 'Tab':
                return this.navigateToNextFocusable();
            case 'Shift+Tab':
                return this.navigateToPreviousFocusable();
            case 'Down':
            case 'ArrowDown':
                return this.navigateNext();
            case 'Up':
            case 'ArrowUp':
                return this.navigatePrevious();
            case 'h':
            case 'H':
                return this.navigateToNextByRole(HEADING_ROLES);
            case 'Shift+h':
            case 'Shift+H':
                return this.navigateToPreviousByRole(HEADING_ROLES);
            case 'd':
            case 'D':
                return this.navigateToNextByRole(LANDMARK_ROLES);
            case 'Shift+d':
            case 'Shift+D':
                return this.navigateToPreviousByRole(LANDMARK_ROLES);
            case 'k':
            case 'K':
                return this.navigateToNextByRole(LINK_ROLES);
            case 'Shift+k':
            case 'Shift+K':
                return this.navigateToPreviousByRole(LINK_ROLES);
            case 'b':
            case 'B':
                return this.navigateToNextByRole(BUTTON_ROLES);
            case 'Shift+b':
            case 'Shift+B':
                return this.navigateToPreviousByRole(BUTTON_ROLES);
            case '1':
                return this.navigateToNextHeadingLevel(1);
            case '2':
                return this.navigateToNextHeadingLevel(2);
            case '3':
                return this.navigateToNextHeadingLevel(3);
            case '4':
                return this.navigateToNextHeadingLevel(4);
            case '5':
                return this.navigateToNextHeadingLevel(5);
            case '6':
                return this.navigateToNextHeadingLevel(6);
            case 'Control+Home':
                return this.navigateToStart();
            default:
                this.log.debug(`Unhandled key: ${key}`);
                return this.currentState();
        }
    }

    private async refreshTree(): Promise<void> {
        const result = await this.target.getFullAXTreeSnapshot();
        this.flatTree = this.flattenTree(result.nodes);
    }

    /**
     * Flatten the AX tree into document order, mimicking NVDA's browse mode behavior.
     *
     * SINGLELINE_ROLES (button, link, etc.) are treated as atomic units — their children
     * are skipped to prevent repeated announcements when a button contains many internal nodes.
     *
     * Chrome sometimes creates multiple AX nodes for the same DOM element (especially with
     * shadow DOM). We deduplicate by backendDOMNodeId.
     */
    private flattenTree(nodes: AXNode[]): AXNode[] {
        // Build lookup maps for the entire tree
        this.nodeById = new Map<string, AXNode>(nodes.map((n) => [n.nodeId, n]));
        this.nodeParentMap = new Map<string, string>();

        // Populate parent map
        for (const node of nodes) {
            if (node.childIds) {
                for (const childId of node.childIds) {
                    this.nodeParentMap.set(childId, node.nodeId);
                }
            }
        }

        const order: AXNode[] = [];
        const seenDomNodes = new Set<number>(); // Track backendDOMNodeIds we've already announced

        const root = nodes.find((n) => !n.parentId);
        if (!root) return order;

        const visit = (id: string, insideSingleLine: boolean): void => {
            const node = this.nodeById.get(id);
            if (!node) return;

            const role = node.role?.value as string | undefined;
            const isSingleLine = role !== undefined && SINGLELINE_ROLES.has(role);

            // Include non-ignored nodes that have content worth announcing
            // BUT skip if we're inside a SINGLELINE parent (those children shouldn't be announced separately)
            if (!node.ignored && this.isAnnounceable(node) && !insideSingleLine) {
                if (node.backendDOMNodeId) {
                    if (!seenDomNodes.has(node.backendDOMNodeId)) {
                        seenDomNodes.add(node.backendDOMNodeId);
                        order.push(node);
                    }
                } else {
                    // No backendDOMNodeId - typically text nodes
                    order.push(node);
                }
            }

            // If this node is a SINGLELINE control, its children should be skipped
            // Otherwise, propagate the parent's insideSingleLine status
            const childrenInsideSingleLine = isSingleLine || insideSingleLine;
            node.childIds?.forEach((childId) => visit(childId, childrenInsideSingleLine));
        };

        visit(root.nodeId, false);
        return order;
    }

    /**
     * Determine if a node should be announced by a screen reader.
     */
    private isAnnounceable(node: AXNode): boolean {
        const role = node.role?.value as string | undefined;

        // Always announce landmarks, headings, links, buttons
        if (
            role &&
            (LANDMARK_ROLES.has(role) || HEADING_ROLES.has(role) || LINK_ROLES.has(role) || BUTTON_ROLES.has(role))
        ) {
            return true;
        }

        // Announce nodes with names (text content)
        if (node.name?.value) {
            return true;
        }

        // Announce form controls
        if (role && FOCUSABLE_ROLES.has(role)) {
            return true;
        }

        // Announce nodes with interesting roles
        const interestingRoles = new Set([
            'alert',
            'alertdialog',
            'article',
            'cell',
            'columnheader',
            'definition',
            'dialog',
            'directory',
            'document',
            'feed',
            'figure',
            'grid',
            'gridcell',
            'group',
            'img',
            'list',
            'listitem',
            'log',
            'marquee',
            'math',
            'menu',
            'menubar',
            'meter',
            'note',
            'progressbar',
            'row',
            'rowgroup',
            'rowheader',
            'separator',
            'status',
            'table',
            'tablist',
            'tabpanel',
            'term',
            'timer',
            'toolbar',
            'tooltip',
            'tree',
            'treegrid',
        ]);

        if (role && interestingRoles.has(role)) {
            return true;
        }

        return false;
    }

    private navigateToStart(): Promise<KeyPressResult> {
        this.cursorIndex = -1;
        this.lastAnnouncedPhrase = ''; // Reset duplicate detection
        return this.navigateNext();
    }

    private navigateToNextByRole(roles: Set<string>): Promise<KeyPressResult> {
        for (let i = this.cursorIndex + 1; i < this.flatTree.length; i++) {
            const node = this.flatTree[i];
            const role = node?.role?.value as string | undefined;
            if (role && roles.has(role)) {
                this.cursorIndex = i;
                return this.currentStateSimple();
            }
        }
        return this.noMoreElements(roles);
    }

    private navigateToPreviousByRole(roles: Set<string>): Promise<KeyPressResult> {
        for (let i = this.cursorIndex - 1; i >= 0; i--) {
            const node = this.flatTree[i];
            const role = node?.role?.value as string | undefined;
            if (role && roles.has(role)) {
                this.cursorIndex = i;
                return this.currentStateSimple();
            }
        }
        return this.noMoreElements(roles);
    }

    private navigateToNextHeadingLevel(level: number): Promise<KeyPressResult> {
        for (let i = this.cursorIndex + 1; i < this.flatTree.length; i++) {
            const node = this.flatTree[i];
            if (!node) continue;
            const role = node.role?.value as string | undefined;
            if (role === 'heading') {
                const nodeLevel = this.getHeadingLevel(node);
                if (nodeLevel === level) {
                    this.cursorIndex = i;
                    return this.currentStateSimple();
                }
            }
        }
        return Promise.resolve({
            spokenPhrases: [`no next heading level ${level}`],
            focusedElementText: `no next heading level ${level}`,
        });
    }

    private async navigateToNextFocusable(): Promise<KeyPressResult> {
        for (let i = this.cursorIndex + 1; i < this.flatTree.length; i++) {
            const node = this.flatTree[i];
            if (this.isFocusable(node)) {
                this.cursorIndex = i;
                await this.focusNodeInDom(node);
                return this.currentStateSimple();
            }
        }
        // Repeated phrase triggers LoopGuard on subsequent presses
        return this.noMoreElements(new Set(['focusable']));
    }

    private async navigateToPreviousFocusable(): Promise<KeyPressResult> {
        for (let i = this.cursorIndex - 1; i >= 0; i--) {
            const node = this.flatTree[i];
            if (this.isFocusable(node)) {
                this.cursorIndex = i;
                await this.focusNodeInDom(node);
                return this.currentStateSimple();
            }
        }
        return this.noMoreElements(new Set(['focusable']));
    }

    /**
     * Focus an element in the DOM by its backendDOMNodeId.
     * This is necessary for Tab navigation so that getFocusedHtmlElementBackendNodeId()
     * returns the correct element.
     */
    private async focusNodeInDom(node: AXNode | undefined): Promise<void> {
        if (!node?.backendDOMNodeId) return;

        try {
            // Resolve the node to a remote object
            const { object } = await this.target.cdp.send('DOM.resolveNode', {
                backendNodeId: node.backendDOMNodeId,
            });

            if (object?.objectId) {
                // Call focus() on the element
                await this.target.cdp.send('Runtime.callFunctionOn', {
                    objectId: object.objectId,
                    functionDeclaration: 'function() { this.focus(); }',
                    silent: true,
                });
                // Release the object
                await this.target.cdp.send('Runtime.releaseObject', { objectId: object.objectId }).catch(() => {});
            }
        } catch (error) {
            this.log.debug(`Failed to focus node: ${error}`);
        }
    }

    private isFocusable(node: AXNode | undefined): boolean {
        if (!node) return false;

        // Check focusable property
        const focusableProp = node.properties?.find((p: AXProperty) => p.name === 'focusable');
        if (focusableProp?.value?.value === true) {
            return true;
        }

        // Check role
        const role = node.role?.value as string | undefined;
        if (role && FOCUSABLE_ROLES.has(role)) {
            return true;
        }

        return false;
    }

    private getHeadingLevel(node: AXNode): number {
        const levelProp = node.properties?.find((p: AXProperty) => p.name === 'level');
        if (levelProp?.value?.value !== undefined) {
            return levelProp.value.value as number;
        }
        return 0;
    }

    private noMoreElements(roles: Set<string>): Promise<KeyPressResult> {
        const roleNames = Array.from(roles).join('/');
        const phrase = `no next ${roleNames}`;
        return Promise.resolve({
            spokenPhrases: [phrase],
            focusedElementText: phrase,
        });
    }

    // Track the previous node's container ancestry for "out of X" announcements
    private previousContainers: string[] = [];
    // Track last announced phrase to avoid consecutive duplicates
    private lastAnnouncedPhrase: string = '';

    private currentState(): Promise<KeyPressResult> {
        const node = this.flatTree[this.cursorIndex];
        if (!node) {
            return Promise.resolve({
                spokenPhrases: [''],
                focusedElementText: '',
            });
        }

        // Get container ancestry for current node
        const currentContainers = this.getContainerAncestry(node);

        // Find containers we've exited (were in previous but not in current)
        const exitedContainers = this.previousContainers.filter((container) => !currentContainers.includes(container));

        // Build the phrase with "out of X" prefixes
        const exitPhrases = exitedContainers.map((container) => `out of ${container}`);
        const nodePhrase = this.generatePhrase(node);

        // Combine exit announcements with node phrase
        const fullPhrase = [...exitPhrases, nodePhrase].join(', ');

        // Update previous containers for next navigation
        this.previousContainers = currentContainers;
        this.lastAnnouncedPhrase = nodePhrase;

        return Promise.resolve({
            spokenPhrases: [fullPhrase],
            focusedElementText: fullPhrase,
            backendDOMNodeId: node.backendDOMNodeId,
        });
    }

    /**
     * Get current state without container exit tracking.
     * Used for quick navigation (h, k, b, etc.) where "out of list" doesn't apply.
     */
    private currentStateSimple(): Promise<KeyPressResult> {
        const node = this.flatTree[this.cursorIndex];
        if (!node) {
            return Promise.resolve({
                spokenPhrases: [''],
                focusedElementText: '',
            });
        }

        const phrase = this.generatePhrase(node);

        // Reset container tracking when jumping - we don't know what we skipped
        this.previousContainers = this.getContainerAncestry(node);
        this.lastAnnouncedPhrase = phrase;

        return Promise.resolve({
            spokenPhrases: [phrase],
            focusedElementText: phrase,
            backendDOMNodeId: node.backendDOMNodeId,
        });
    }

    /**
     * Navigate to next node, skipping blanks and consecutive duplicates.
     *
     * Key behaviors mimicking NVDA:
     * - Skip blank/empty nodes silently (NVDA doesn't stop on blanks)
     * - Skip consecutive duplicates (Chrome AX tree often has multiple nodes for same content)
     * - Stop at meaningful content
     */
    private navigateNext(): Promise<KeyPressResult> {
        let skippedDuplicates = 0;
        let skippedBlanks = 0;
        const maxDuplicateSkips = 5;
        const maxBlankSkips = 50; // Higher limit for blanks - NVDA silently skips many

        while (this.cursorIndex < this.flatTree.length - 1) {
            this.cursorIndex++;
            const node = this.flatTree[this.cursorIndex];
            if (!node) continue;

            const phrase = this.generatePhrase(node);

            // Check if this is a blank/empty announcement
            const isBlank = phrase === 'blank' || phrase === '' || phrase.trim() === '';

            // NVDA behavior: Skip blanks silently, don't announce them
            if (isBlank) {
                skippedBlanks++;
                if (skippedBlanks >= maxBlankSkips) {
                    // Safety: stop after too many blanks to avoid infinite loop
                    return this.currentState();
                }
                continue; // Skip blank, try next node
            }

            // Check for duplicate announcement
            const isDuplicate = phrase === this.lastAnnouncedPhrase;

            if (isDuplicate) {
                skippedDuplicates++;
                if (skippedDuplicates >= maxDuplicateSkips) {
                    // Safety: announce after too many skips
                    return this.currentState();
                }
                continue; // Skip duplicate, try next node
            }

            // Found meaningful, non-duplicate content - announce it
            return this.currentState();
        }

        // Reached end of tree
        return this.currentState();
    }

    /**
     * Navigate to previous node, skipping blanks and consecutive duplicates.
     */
    private navigatePrevious(): Promise<KeyPressResult> {
        let skippedDuplicates = 0;
        let skippedBlanks = 0;
        const maxDuplicateSkips = 5;
        const maxBlankSkips = 50;

        while (this.cursorIndex > 0) {
            this.cursorIndex--;
            const node = this.flatTree[this.cursorIndex];
            if (!node) continue;

            const phrase = this.generatePhrase(node);

            const isBlank = phrase === 'blank' || phrase === '' || phrase.trim() === '';

            if (isBlank) {
                skippedBlanks++;
                if (skippedBlanks >= maxBlankSkips) {
                    return this.currentState();
                }
                continue;
            }

            const isDuplicate = phrase === this.lastAnnouncedPhrase;

            if (isDuplicate) {
                skippedDuplicates++;
                if (skippedDuplicates >= maxDuplicateSkips) {
                    return this.currentState();
                }
                continue;
            }

            return this.currentState();
        }

        return this.currentState();
    }

    /**
     * Get the container ancestry for a node (list, table, grouping, etc.)
     * Used for "out of list", "out of table" announcements.
     */
    private getContainerAncestry(node: AXNode): string[] {
        const containers: string[] = [];
        let currentId = node.nodeId;

        // Walk up the tree collecting container roles
        while (currentId) {
            const parentId = this.nodeParentMap.get(currentId);
            if (!parentId) break;

            const parentNode = this.nodeById.get(parentId);
            if (!parentNode) break;

            const role = parentNode.role?.value as string | undefined;
            if (role) {
                // These are container roles that NVDA announces exits from
                const containerRoles: Record<string, string> = {
                    list: 'list',
                    table: 'table',
                    grid: 'grid',
                    tree: 'tree',
                    group: 'grouping',
                    grouping: 'grouping',
                    tablist: 'tab list',
                    menu: 'menu',
                    menubar: 'menu bar',
                    listbox: 'list box',
                    dialog: 'dialog',
                    alertdialog: 'alert dialog',
                };

                if (containerRoles[role]) {
                    containers.push(containerRoles[role]);
                }
            }

            currentId = parentId;
        }

        return containers;
    }

    /**
     * Generate a spoken phrase from an AX node, mimicking NVDA's output order:
     * "clickable" → name → role/state → ARIA properties.
     */
    private generatePhrase(node: AXNode): string {
        const parts: string[] = [];
        const role = node.role?.value as string | undefined;
        const name = node.name?.value as string | undefined;

        if (this.isClickable(node)) {
            parts.push('clickable');
        }

        if (name) {
            parts.push(name);
        }
        if (role) {
            switch (role) {
                case 'heading': {
                    const level = this.getHeadingLevel(node);
                    parts.push(`heading, level ${level}`);
                    break;
                }
                case 'link': {
                    // Check for same-page link (anchor links)
                    const url = this.getPropertyValue(node, 'url') as string | undefined;
                    if (url?.startsWith('#') || url?.includes('#')) {
                        parts.push('same page, link');
                    } else {
                        parts.push('link');
                    }
                    break;
                }
                case 'button': {
                    // Check for popup/menu button
                    const hasPopup = this.getPropertyValue(node, 'haspopup');
                    if (hasPopup && hasPopup !== 'false') {
                        const popupType = typeof hasPopup === 'string' ? hasPopup : 'menu';
                        parts.push(`button, has popup ${popupType}`);
                    } else {
                        parts.push('button');
                    }
                    break;
                }
                case 'checkbox': {
                    const checked = this.getPropertyValue(node, 'checked');
                    parts.push(`checkbox, ${checked ? 'checked' : 'not checked'}`);
                    break;
                }
                case 'radio': {
                    const selected = this.getPropertyValue(node, 'checked');
                    parts.push(`radio button, ${selected ? 'selected' : 'not selected'}`);
                    break;
                }
                case 'textbox': {
                    parts.push('edit');
                    break;
                }
                case 'combobox': {
                    const hasPopup = this.getPropertyValue(node, 'haspopup');
                    const expanded = this.getPropertyValue(node, 'expanded');
                    let comboPhrase = 'combo box';
                    if (hasPopup) comboPhrase += ', has popup';
                    if (expanded !== undefined) comboPhrase += expanded ? ', expanded' : ', collapsed';
                    parts.push(comboPhrase);
                    break;
                }
                case 'listbox':
                    parts.push('list box');
                    break;
                case 'switch': {
                    const pressed = this.getPropertyValue(node, 'pressed') || this.getPropertyValue(node, 'checked');
                    parts.push(`switch, ${pressed ? 'on' : 'off'}`);
                    break;
                }
                case 'tab': {
                    const selected = this.getPropertyValue(node, 'selected');
                    if (selected) {
                        parts.push('tab, selected');
                    } else {
                        parts.push('tab');
                    }
                    break;
                }
                case 'banner':
                    parts.push('banner landmark');
                    break;
                case 'navigation': {
                    parts.push('navigation landmark');
                    break;
                }
                case 'main':
                    parts.push('main landmark');
                    break;
                case 'complementary':
                    parts.push('complementary landmark');
                    break;
                case 'contentinfo':
                    parts.push('content info landmark');
                    break;
                case 'form':
                    parts.push('form landmark');
                    break;
                case 'region':
                    parts.push('region landmark');
                    break;
                case 'search':
                    parts.push('search landmark');
                    break;
                case 'list': {
                    // NVDA announces "list, with N items"
                    const childCount = this.getChildCount(node);
                    if (childCount > 0) {
                        parts.push(`list, with ${childCount} items`);
                    } else {
                        parts.push('list');
                    }
                    break;
                }
                case 'listitem': {
                    // NVDA announces list item position: "1 of 5"
                    const posInSet = this.getPropertyValue(node, 'posinset') as number | undefined;
                    const setSize = this.getPropertyValue(node, 'setsize') as number | undefined;
                    if (posInSet !== undefined && setSize !== undefined) {
                        parts.push(`${posInSet} of ${setSize}`);
                    }
                    // Also add "list item" or just rely on the position
                    break;
                }
                case 'table': {
                    // NVDA announces "table, with N rows and M columns"
                    const rowCount = this.getPropertyValue(node, 'rowcount') as number | undefined;
                    const colCount = this.getPropertyValue(node, 'colcount') as number | undefined;
                    if (rowCount && colCount) {
                        parts.push(`table, with ${rowCount} rows and ${colCount} columns`);
                    } else {
                        parts.push('table');
                    }
                    break;
                }
                case 'row': {
                    const rowIndex = this.getPropertyValue(node, 'rowindex') as number | undefined;
                    if (rowIndex !== undefined) {
                        parts.push(`row ${rowIndex}`);
                    } else {
                        parts.push('row');
                    }
                    break;
                }
                case 'cell':
                case 'gridcell': {
                    const colIndex = this.getPropertyValue(node, 'colindex') as number | undefined;
                    if (colIndex !== undefined) {
                        parts.push(`column ${colIndex}`);
                    } else {
                        parts.push('cell');
                    }
                    break;
                }
                case 'columnheader':
                    parts.push('column header');
                    break;
                case 'rowheader':
                    parts.push('row header');
                    break;
                case 'img':
                    parts.push('graphic');
                    break;
                case 'document':
                    parts.push('document');
                    break;
                case 'group':
                case 'grouping':
                    parts.push('grouping');
                    break;
                case 'separator':
                    parts.push('separator');
                    break;
                case 'progressbar': {
                    const value = this.getPropertyValue(node, 'valuetext') as string | undefined;
                    const valueNow = this.getPropertyValue(node, 'valuenow') as number | undefined;
                    if (value) {
                        parts.push(`progress bar, ${value}`);
                    } else if (valueNow !== undefined) {
                        parts.push(`progress bar, ${valueNow}%`);
                    } else {
                        parts.push('progress bar');
                    }
                    break;
                }
                case 'slider': {
                    const valueText = this.getPropertyValue(node, 'valuetext') as string | undefined;
                    const valueNow = this.getPropertyValue(node, 'valuenow') as number | undefined;
                    let sliderPhrase = 'slider';
                    if (valueText) {
                        sliderPhrase += `, ${valueText}`;
                    } else if (valueNow !== undefined) {
                        sliderPhrase += `, ${valueNow}`;
                    }
                    parts.push(sliderPhrase);
                    break;
                }
                case 'spinbutton': {
                    const valueNow = this.getPropertyValue(node, 'valuenow') as number | undefined;
                    if (valueNow !== undefined) {
                        parts.push(`spin button, ${valueNow}`);
                    } else {
                        parts.push('spin button');
                    }
                    break;
                }
                case 'menu':
                    parts.push('menu');
                    break;
                case 'menuitem':
                    parts.push('menu item');
                    break;
                case 'menuitemcheckbox': {
                    const checked = this.getPropertyValue(node, 'checked');
                    parts.push(`menu item, checkbox, ${checked ? 'checked' : 'not checked'}`);
                    break;
                }
                case 'menuitemradio': {
                    const checked = this.getPropertyValue(node, 'checked');
                    parts.push(`menu item, radio, ${checked ? 'selected' : 'not selected'}`);
                    break;
                }
                case 'treeitem': {
                    const expanded = this.getPropertyValue(node, 'expanded');
                    const level = this.getPropertyValue(node, 'level') as number | undefined;
                    let treePhrase = 'tree item';
                    if (level !== undefined) treePhrase += `, level ${level}`;
                    if (expanded !== undefined) treePhrase += expanded ? ', expanded' : ', collapsed';
                    parts.push(treePhrase);
                    break;
                }
                case 'option': {
                    const selected = this.getPropertyValue(node, 'selected');
                    const posInSet = this.getPropertyValue(node, 'posinset') as number | undefined;
                    const setSize = this.getPropertyValue(node, 'setsize') as number | undefined;
                    let optionPhrase = selected ? 'selected' : '';
                    if (posInSet !== undefined && setSize !== undefined) {
                        optionPhrase += optionPhrase ? `, ${posInSet} of ${setSize}` : `${posInSet} of ${setSize}`;
                    }
                    parts.push(optionPhrase || 'option');
                    break;
                }
                case 'alert':
                    parts.push('alert');
                    break;
                case 'alertdialog':
                    parts.push('alert dialog');
                    break;
                case 'dialog':
                    parts.push('dialog');
                    break;
                case 'tooltip':
                    parts.push('tooltip');
                    break;
                case 'status':
                    parts.push('status');
                    break;
                case 'timer':
                    parts.push('timer');
                    break;
                case 'log':
                    parts.push('log');
                    break;
                case 'marquee':
                    parts.push('marquee');
                    break;
                // Default: don't add role for generic elements
            }
        }

        // Add state information (not already handled in role-specific logic)
        const expanded = this.getPropertyValue(node, 'expanded');
        // Skip roles that already handle expanded/collapsed inline
        if (expanded !== undefined && role && !['combobox', 'treeitem'].includes(role)) {
            parts.push(expanded ? 'expanded' : 'collapsed');
        }

        const disabled = this.getPropertyValue(node, 'disabled');
        if (disabled) {
            parts.push('unavailable');
        }

        const required = this.getPropertyValue(node, 'required');
        if (required) {
            parts.push('required');
        }

        const invalid = this.getPropertyValue(node, 'invalid');
        if (invalid && invalid !== 'false') {
            // NVDA says "invalid entry" for invalid fields
            parts.push('invalid entry');
        }

        // aria-haspopup (if not already handled by role)
        const hasPopup = this.getPropertyValue(node, 'haspopup');
        if (hasPopup && hasPopup !== 'false' && role && !['button', 'combobox'].includes(role)) {
            const popupType = typeof hasPopup === 'string' && hasPopup !== 'true' ? hasPopup : 'menu';
            parts.push(`has popup ${popupType}`);
        }

        const busy = this.getPropertyValue(node, 'busy');
        if (busy) {
            parts.push('busy');
        }

        const live = this.getPropertyValue(node, 'live');
        if (live && live !== 'off') {
            parts.push(`live region, ${live}`);
        }

        // Insert "visited" before "link" to match NVDA announcement order
        const visited = this.getPropertyValue(node, 'visited');
        if (visited) {
            const linkIndex = parts.indexOf('link');
            if (linkIndex >= 0) {
                parts.splice(linkIndex, 0, 'visited');
            } else {
                parts.push('visited');
            }
        }

        return parts.join(', ') || 'blank';
    }

    /**
     * Check if a non-interactive node has a click handler.
     * NVDA announces "clickable" for elements with event listeners that aren't
     * already interactive by role.
     */
    private isClickable(node: AXNode): boolean {
        const role = node.role?.value as string | undefined;

        // Elements that are implicitly clickable by role - don't double-announce
        const implicitlyClickableRoles = new Set([
            'button',
            'link',
            'menuitem',
            'menuitemcheckbox',
            'menuitemradio',
            'tab',
            'checkbox',
            'radio',
            'switch',
            'option',
            'treeitem',
            'combobox',
            'listbox',
            'slider',
            'spinbutton',
        ]);

        if (role && implicitlyClickableRoles.has(role)) {
            return false;
        }

        const clickable = this.getPropertyValue(node, 'clickable');
        if (clickable === true) {
            return true;
        }

        // Focusable non-interactive element — likely a clickable div/span
        const focusable = this.getPropertyValue(node, 'focusable');
        const interactiveRoles = new Set(['textbox', 'searchbox', 'document', 'application']);

        if (focusable === true && role && !interactiveRoles.has(role) && !implicitlyClickableRoles.has(role)) {
            return true;
        }

        return false;
    }

    /**
     * Get the number of children for a container node.
     * Used for "list, with N items" announcements.
     */
    private getChildCount(node: AXNode): number {
        // Check for setsize property (used by ARIA)
        const setsize = this.getPropertyValue(node, 'setsize') as number | undefined;
        if (setsize !== undefined) return setsize;

        // Fall back to counting direct children with appropriate roles
        if (!node.childIds) return 0;

        // For lists, count listitem children
        const role = node.role?.value as string | undefined;
        if (role === 'list') {
            // Count actual list items, not all children
            return node.childIds.length; // Simplified - ideally filter by role
        }

        return node.childIds.length;
    }

    private getPropertyValue(node: AXNode, propertyName: string): unknown {
        const prop = node.properties?.find((p: AXProperty) => p.name === propertyName);
        return prop?.value?.value;
    }
}
