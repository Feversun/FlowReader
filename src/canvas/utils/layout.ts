import type { CollectionItem } from '../../shared/types';
import type { Node } from '@xyflow/react';

const COLUMN_WIDTH = 320;
const GAP_X = 50;
const GAP_Y = 30;

/**
 * Creates a masonry-like grid layout (Explosion Layout)
 * Items flow from top-left, filling columns
 */
export function explosionLayout(items: CollectionItem[]): Node[] {
    const columns = 4; // Start with 4 columns
    const columnHeights = new Array(columns).fill(0);
    const nodes: Node[] = [];

    items.forEach((item) => {
        // Find shortest column
        const minHeight = Math.min(...columnHeights);
        const colIndex = columnHeights.indexOf(minHeight);

        const x = colIndex * (COLUMN_WIDTH + GAP_X);
        const y = minHeight + GAP_Y;

        // Estimate height based on content length (rough approximation for layout)
        // 100px base + ~0.5px per character
        const estimatedHeight = 100 + (item.content.length * 0.4);

        nodes.push({
            id: item.id,
            type: 'block',
            position: { x, y },
            data: { ...item }
        });

        columnHeights[colIndex] += estimatedHeight + GAP_Y;
    });

    return nodes;
}
