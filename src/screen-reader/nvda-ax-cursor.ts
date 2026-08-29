/**
 * Utilities for tracking NVDA's virtual cursor position against a flattened AX tree.
 */

// @ts-ignore - Protocol is a global namespace from playwright-core/types/protocol.d.ts
type AXNode = Protocol.Accessibility.AXNode;

export interface MatchResult {
    node: AXNode;
    index: number;
}

/**
 * Flattens the AX tree into document (reading) order starting from the root node.
 * Skips ignored nodes in output since NVDA's virtual cursor won't stop on them,
 * but still traverses their children to capture the full accessible content.
 */
export function flattenAxTree(nodes: AXNode[]): AXNode[] {
    const byId = new Map<string, AXNode>(nodes.map((node) => [node.nodeId, node]));
    const order: AXNode[] = [];

    // Find the root node (the one without a parentId)
    const root = nodes.find((node) => !node.parentId);
    if (!root) return order;

    function visit(id: string): void {
        const node = byId.get(id);
        if (!node) return;
        // Only add non-ignored nodes to the output
        if (!node.ignored) {
            order.push(node);
        }
        // Always traverse children, even for ignored nodes
        (node.childIds ?? []).forEach(visit);
    }

    visit(root.nodeId);
    return order;
}

/**
 * Tracks NVDA's virtual cursor position against a flattened AX tree,
 * disambiguating repeated names/roles by always searching forward
 * from the last matched index.
 */
export class NvdaAxCursor {
    private flat: AXNode[] = [];
    private cursorIndex = -1;

    constructor(nodes?: AXNode[]) {
        if (nodes) {
            this.flat = flattenAxTree(nodes);
        }
    }

    /** Reset the cursor (e.g. after a page navigation or when tree is refreshed). */
    reset(nodes: AXNode[]): void {
        this.flat = flattenAxTree(nodes);
        this.cursorIndex = -1;
    }

    /** Get the flattened tree for inspection/debugging. */
    get flattenedTree(): AXNode[] {
        return this.flat;
    }

    /** Get current cursor position index. */
    get currentIndex(): number {
        return this.cursorIndex;
    }

    /** Get the node at the current cursor position. */
    get current(): AXNode | null {
        return this.cursorIndex >= 0 ? this.flat[this.cursorIndex] : null;
    }

    /**
     * Given the phrase NVDA just spoke, find the next matching node after
     * the current cursor position and advance the cursor to it.
     *
     * @param spokenPhrase - The phrase NVDA spoke (from lastSpokenPhrase or itemText)
     * @param role - Optional role to filter by (e.g. 'heading', 'link', 'button')
     * @returns The matched node and its index, or null if no match found
     */
    matchNext(spokenPhrase: string, role?: string): MatchResult | null {
        const normalizedPhrase = spokenPhrase.toLowerCase();

        const index = this.flat.findIndex((n, i) => {
            // Only search forward from current position
            if (i <= this.cursorIndex) return false;
            // Filter by role if specified
            // @ts-ignore
            if (role && n.role?.value !== role) return false;
            // Match by name
            // @ts-ignore
            const name = n.name?.value as string | undefined;
            if (!name) return false;
            return normalizedPhrase.includes(name.toLowerCase());
        });

        if (index === -1) return null;

        this.cursorIndex = index;
        return { node: this.flat[index]!, index };
    }

    /**
     * Find the next node matching the spoken phrase, without filtering by role.
     * Used for arrow key navigation which can land on any element type.
     *
     * @param spokenPhrase - The phrase NVDA spoke
     * @returns The matched node and its index, or null if no match found
     */
    matchNextAny(spokenPhrase: string): MatchResult | null {
        const normalizedPhrase = spokenPhrase.toLowerCase();

        const index = this.flat.findIndex((n, i) => {
            // Only search forward from current position
            if (i <= this.cursorIndex) return false;
            // Match by name (any role)
            // @ts-ignore
            const name = n.name?.value as string | undefined;
            if (!name) return false;
            return normalizedPhrase.includes(name.toLowerCase());
        });

        if (index === -1) return null;

        this.cursorIndex = index;
        return { node: this.flat[index]!, index };
    }

    /**
     * Find the next node with a specific role after the current cursor position.
     * Useful for heading/landmark navigation where NVDA announces the role.
     *
     * @param spokenPhrase - The phrase NVDA spoke
     * @param roles - Array of roles to match (e.g. ['heading'] for H key navigation)
     * @returns The matched node and its index, or null if no match found
     */
    matchNextByRoles(spokenPhrase: string, roles: string[]): MatchResult | null {
        const normalizedPhrase = spokenPhrase.toLowerCase();

        const index = this.flat.findIndex((n, i) => {
            if (i <= this.cursorIndex) return false;
            // @ts-ignore
            const nodeRole = n.role?.value as string | undefined;
            if (!nodeRole || !roles.includes(nodeRole)) return false;
            // @ts-ignore
            const name = n.name?.value as string | undefined;
            if (!name) return false;
            return normalizedPhrase.includes(name.toLowerCase());
        });

        if (index === -1) return null;

        this.cursorIndex = index;
        return { node: this.flat[index]!, index };
    }

    /**
     * Find the next node with an exact role after the current cursor position.
     * Does NOT require a name match — useful for landmarks which often have no accessible name.
     *
     * @param role - The exact role to match (e.g. 'banner', 'navigation', 'main')
     * @returns The matched node and its index, or null if no match found
     */
    matchNextByRole(role: string): MatchResult | null {
        const index = this.flat.findIndex((n, i) => {
            if (i <= this.cursorIndex) return false;
            // @ts-ignore
            const nodeRole = n.role?.value as string | undefined;
            return nodeRole === role;
        });

        if (index === -1) return null;

        this.cursorIndex = index;
        return { node: this.flat[index]!, index };
    }

    /**
     * Manually set the cursor position (useful for testing or recovery).
     */
    setCursorIndex(index: number): void {
        if (index >= -1 && index < this.flat.length) {
            this.cursorIndex = index;
        }
    }

    /**
     * Find an AX node by its backendDOMNodeId.
     * Useful for focus mode navigation where we know the focused DOM element
     * but need to find its corresponding AX node.
     *
     * NOTE: This does NOT advance the cursor since focus mode navigation
     * doesn't follow document order like browse mode.
     *
     * @param backendDOMNodeId - The backend DOM node ID from CDP
     * @returns The matched AX node or null if not found
     */
    findByBackendDOMNodeId(backendDOMNodeId: number): AXNode | null {
        return this.flat.find((n) => n.backendDOMNodeId === backendDOMNodeId) ?? null;
    }
}

/**
 * Extracts the landmark role from NVDA's spoken phrase.
 * NVDA announces landmarks as "X landmark" (e.g., "navigation landmark", "banner landmark").
 */
export function extractLandmarkRole(spokenPhrase: string): string | null {
    const phrase = spokenPhrase.toLowerCase();
    if (phrase.includes('banner landmark')) return 'banner';
    if (phrase.includes('navigation landmark')) return 'navigation';
    if (phrase.includes('main landmark')) return 'main';
    if (phrase.includes('complementary landmark')) return 'complementary';
    if (phrase.includes('content info landmark')) return 'contentinfo';
    if (phrase.includes('form landmark')) return 'form';
    if (phrase.includes('region landmark')) return 'region';
    if (phrase.includes('search landmark')) return 'search';
    return null;
}
