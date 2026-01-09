interface ToolbarProps {
    sessionName: string;
    onNameChange: (name: string) => void;
    onExport: () => void;
    nodeCount: number;
}

export default function Toolbar({ sessionName, onNameChange, onExport, nodeCount }: ToolbarProps) {
    return (
        <div className="canvas-toolbar">
            <div className="toolbar-left">
                <div className="logo">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>FlowReader</span>
                </div>

                <input
                    type="text"
                    className="session-name"
                    value={sessionName}
                    onChange={(e) => onNameChange(e.target.value)}
                    placeholder="Session Name"
                />

                <div className="node-count">
                    {nodeCount} items
                </div>
            </div>

            <div className="toolbar-right">
                <button className="toolbar-btn ai-btn" disabled title="Coming soon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" stroke="currentColor" strokeWidth="2" />
                        <circle cx="12" cy="12" r="3" fill="currentColor" />
                    </svg>
                    AI Organize
                </button>

                <button className="toolbar-btn export-btn" onClick={onExport}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    导出 Obsidian
                </button>
            </div>
        </div>
    );
}
