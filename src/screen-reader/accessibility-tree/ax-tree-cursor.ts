/**
 * Utilities for tracking screen reader virtual cursor position against a flattened AX tree.
 */
import type { AXNode } from '../../types/cdp';

export interface MatchResult {
    node: AXNode;
    index: number;
}

/**
 * Flattens the AX tree into document (reading) order starting from the root node.
 * Skips ignored nodes in output since screen reader virtual cursor won't stop on them,
 * but still traverses their children to capture the full accessible content.
 */
function flattenAxTree(nodes: AXNode[]): AXNode[] {
    const byId = new Map<string, AXNode>(nodes.map((node) => [node.nodeId, node]));
    const order: AXNode[] = [];

    const root = nodes.find((node) => !node.parentId);
    if (!root) return order;

    function visit(id: string): void {
        const node = byId.get(id);
        if (!node) return;
        if (!node.ignored) {
            order.push(node);
        }
        node.childIds?.forEach(visit);
    }

    visit(root.nodeId);
    return order;
}

/**
 * Tracks screen reader virtual cursor position against a flattened AX tree,
 * disambiguating repeated names/roles by always searching forward
 * from the last matched index.
 */
export class AxTreeCursor {
    private flat: AXNode[] = [];
    private cursorIndex = -1;

    constructor(nodes?: AXNode[]) {
        if (nodes) {
            this.flat = flattenAxTree(nodes);
        }
    }

    reset(nodes: AXNode[]): void {
        this.flat = flattenAxTree(nodes);
        this.cursorIndex = -1;
    }

    get flattenedTree(): AXNode[] {
        return this.flat;
    }

    get currentIndex(): number {
        return this.cursorIndex;
    }

    get current(): AXNode | null {
        return this.cursorIndex >= 0 ? (this.flat[this.cursorIndex] ?? null) : null;
    }

    /**
     * Given the phrase the screen reader just spoke, find the next matching node after
     * the current cursor position and advance the cursor to it.
     *
     * @param spokenPhrase - The phrase spoken (from lastSpokenPhrase or focusedElementText)
     * @param role - Optional role to filter by (e.g. 'heading', 'link', 'button')
     * @returns The matched node and its index, or null if no match found
     */
    matchNext(spokenPhrase: string, role?: string): MatchResult | null {
        const normalizedPhrase = spokenPhrase.toLowerCase();

        const index = this.flat.findIndex((n, i) => {
            if (i <= this.cursorIndex) return false;
            if (role && n.role?.value !== role) return false;
            const name = n.name?.value as string | undefined;
            if (!name) return false;
            return normalizedPhrase.includes(name.toLowerCase());
        });

        if (index === -1) return null;

        this.cursorIndex = index;
        const node = this.flat[index];
        if (!node) return null;
        return { node, index };
    }

    /**
     * Find the next node matching the spoken phrase without role filtering.
     * Used for arrow key navigation which can land on any element type.
     */
    matchNextAny(spokenPhrase: string): MatchResult | null {
        const normalizedPhrase = spokenPhrase.toLowerCase();

        const index = this.flat.findIndex((n, i) => {
            if (i <= this.cursorIndex) return false;
            const name = n.name?.value as string | undefined;
            if (!name) return false;
            return normalizedPhrase.includes(name.toLowerCase());
        });

        if (index === -1) return null;

        this.cursorIndex = index;
        const node = this.flat[index];
        if (!node) return null;
        return { node, index };
    }

    /**
     * Find the next node matching the spoken phrase and one of the given roles.
     * Used for heading/landmark navigation where NVDA announces the role.
     */
    matchNextByRoles(spokenPhrase: string, roles: string[]): MatchResult | null {
        const normalizedPhrase = spokenPhrase.toLowerCase();

        const index = this.flat.findIndex((n, i) => {
            if (i <= this.cursorIndex) return false;
            const nodeRole = n.role?.value as string | undefined;
            if (!nodeRole || !roles.includes(nodeRole)) return false;
            const name = n.name?.value as string | undefined;
            if (!name) return false;
            return normalizedPhrase.includes(name.toLowerCase());
        });

        if (index === -1) return null;

        this.cursorIndex = index;
        const node = this.flat[index];
        if (!node) return null;
        return { node, index };
    }

    /**
     * Find the next node with an exact role, without requiring a name match.
     * Useful for landmarks which often have no accessible name.
     */
    matchNextByRole(role: string): MatchResult | null {
        const index = this.flat.findIndex((n, i) => {
            if (i <= this.cursorIndex) return false;
            const nodeRole = n.role?.value as string | undefined;
            return nodeRole === role;
        });

        if (index === -1) return null;

        this.cursorIndex = index;
        const node = this.flat[index];
        if (!node) return null;
        return { node, index };
    }

    setCursorIndex(index: number): void {
        if (index >= -1 && index < this.flat.length) {
            this.cursorIndex = index;
        }
    }

    /**
     * Find an AX node by its backendDOMNodeId.
     * Does NOT advance the cursor — focus mode navigation doesn't follow document order.
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
