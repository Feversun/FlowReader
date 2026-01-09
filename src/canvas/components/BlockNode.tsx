import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';

const BlockNode = ({ data, isConnectable }: NodeProps<any>) => {
    // Determine class based on type
    const classes = ['block-node', data.type].filter(Boolean).join(' ');

    const handleSourceClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (data.source?.url) {
            window.open(data.source.url, '_blank');
        }
    };

    return (
        <div className={classes}>
            <Handle
                type="target"
                position={Position.Left}
                isConnectable={isConnectable}
            />

            <div className="block-content">
                {data.content}
            </div>

            <div className="block-source" onClick={handleSourceClick}>
                {data.source?.favicon && (
                    <img
                        src={data.source.favicon}
                        className="source-favicon"
                        alt=""
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                )}
                <span className="source-domain">
                    {data.source?.title || new URL(data.source?.url || '').hostname}
                </span>
            </div>

            <Handle
                type="source"
                position={Position.Right}
                isConnectable={isConnectable}
            />
        </div>
    );
};

export default memo(BlockNode);
