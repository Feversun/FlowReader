import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';

// 简单的 HTML 净化函数
function sanitizeHtml(html: string): string {
    const template = document.createElement('template');
    template.innerHTML = html;

    const content = template.content;

    // 移除危险元素
    const dangerousTags = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'];
    dangerousTags.forEach(tag => {
        content.querySelectorAll(tag).forEach(el => el.remove());
    });

    // 移除事件处理器属性
    content.querySelectorAll('*').forEach(el => {
        Array.from(el.attributes).forEach(attr => {
            if (attr.name.startsWith('on') ||
                (attr.name === 'href' && attr.value.toLowerCase().startsWith('javascript:'))) {
                el.removeAttribute(attr.name);
            }
        });
    });

    return template.innerHTML;
}

const BlockNode = ({ data, isConnectable }: NodeProps<any>) => {
    // Determine class based on type
    const classes = ['block-node', data.type].filter(Boolean).join(' ');

    const handleSourceClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (data.source?.url) {
            window.open(data.source.url, '_blank');
        }
    };

    // 使用 HTML 内容（如果有）否则使用纯文本
    const renderContent = () => {
        if (data.html) {
            return (
                <div
                    className="block-content"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(data.html) }}
                />
            );
        }
        return <div className="block-content">{data.content}</div>;
    };

    return (
        <div className={classes}>
            <Handle
                type="target"
                position={Position.Left}
                isConnectable={isConnectable}
            />

            {renderContent()}

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

