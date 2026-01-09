import { useCallback, useEffect, useState } from 'react';
import {
    ReactFlow,
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    Panel,
    type Node,
    type Edge,
    type Connection,
    BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import BlockNode from './BlockNode';
import Toolbar from './Toolbar';
import { explosionLayout } from '../utils/layout';
import { exportToObsidianCanvas } from '../utils/export';
import type { CollectionItem } from '../../shared/types';

// @ts-ignore
const nodeTypes = { block: BlockNode };

export default function Canvas() {
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [sessionName, setSessionName] = useState('FlowReader Session');
    const [isLoading, setIsLoading] = useState(true);

    // Load collections from storage
    useEffect(() => {
        async function loadCollections() {
            try {
                const result = await chrome.storage.local.get(['collections']);
                const collections: CollectionItem[] = result.collections || [];

                if (collections.length > 0) {
                    const layoutedNodes = explosionLayout(collections);
                    setNodes(layoutedNodes);
                }
            } catch (e) {
                console.error('Failed to load collections:', e);
            } finally {
                setIsLoading(false);
            }
        }

        loadCollections();
    }, [setNodes]);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    const handleExport = useCallback(() => {
        const canvasData = exportToObsidianCanvas(nodes, edges);
        const blob = new Blob([JSON.stringify(canvasData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${sessionName.replace(/\s+/g, '_')}.canvas`;
        a.click();

        URL.revokeObjectURL(url);
    }, [nodes, edges, sessionName]);

    if (isLoading) {
        return (
            <div className="loading-screen">
                <div className="loading-spinner" />
                <p>加载中...</p>
            </div>
        );
    }

    return (
        <div className="canvas-container">
            <Toolbar
                sessionName={sessionName}
                onNameChange={setSessionName}
                onExport={handleExport}
                nodeCount={nodes.length}
            />

            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                // @ts-ignore
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.1}
                maxZoom={2}
                proOptions={{ hideAttribution: true }}
            >
                <Panel position="bottom-left" className="canvas-controls-panel">
                    <div className="controls-wrapper">
                        {/* TypeScript complains about 'relative' position, so passing undefined/any or handling via CSS class */}
                        <MiniMap
                            className="canvas-minimap"
                            nodeColor="#6366f1"
                            // @ts-ignore
                            position={undefined}
                        />
                        <Controls
                            orientation="horizontal"
                            showInteractive={false}
                            className="canvas-controls"
                            // @ts-ignore
                            position={undefined}
                        />
                    </div>
                </Panel>

                <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e5e7eb" />
            </ReactFlow>

            {nodes.length === 0 && (
                <div className="empty-canvas">
                    <h2>画布是空的</h2>
                    <p>请先在阅读模式下收集一些内容</p>
                </div>
            )}
        </div>
    );
}
