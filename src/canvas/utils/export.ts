import type { Node, Edge } from '@xyflow/react';
import TurndownService from 'turndown';

const turndown = new TurndownService();

interface CanvasNode {
    id: string;
    type: 'text' | 'file' | 'link' | 'group';
    text?: string;
    file?: string;
    url?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color?: string;
}

interface CanvasEdge {
    id: string;
    fromNode: string;
    fromSide: 'top' | 'right' | 'bottom' | 'left';
    toNode: string;
    toSide: 'top' | 'right' | 'bottom' | 'left';
}

interface CanvasData {
    nodes: CanvasNode[];
    edges: CanvasEdge[];
}

export function exportToObsidianCanvas(nodes: Node[], edges: Edge[]): CanvasData {
    const canvasNodes: CanvasNode[] = nodes.map(node => {
        // Convert HTML content to Markdown
        const content = node.data.content as string;
        const sourceUrl = (node.data.source as any)?.url;

        let markdown = turndown.turndown(content);

        // Add source link footer
        if (sourceUrl) {
            markdown += `\n\n[Source](${sourceUrl})`;
        }

        return {
            id: node.id,
            type: 'text',
            text: markdown,
            x: node.position.x,
            y: node.position.y,
            width: 300, // Fixed width for now
            height: node.measured?.height || 200, // Use actual height if available
        };
    });

    const canvasEdges: CanvasEdge[] = edges.map(edge => ({
        id: edge.id,
        fromNode: edge.source,
        fromSide: 'right', // Default
        toNode: edge.target,
        toSide: 'left', // Default
    }));

    return {
        nodes: canvasNodes,
        edges: canvasEdges
    };
}
