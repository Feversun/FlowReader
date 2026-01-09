// FlowReader Side Panel Script
// 处理收集面板的渲染、交互和导出

document.addEventListener('DOMContentLoaded', async () => {
    // ============================================
    // DOM 元素
    // ============================================

    const collectionList = document.getElementById('collectionList');
    const emptyState = document.getElementById('emptyState');
    const collectionCount = document.getElementById('collectionCount');
    const autoModeToggle = document.getElementById('autoModeToggle');
    const clearBtn = document.getElementById('clearBtn');
    const copyBtn = document.getElementById('copyBtn');
    const toast = document.getElementById('toast');

    // ============================================
    // 状态
    // ============================================

    let collections = [];

    // ============================================
    // 初始化
    // ============================================

    async function init() {
        try {
            const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
            collections = state.collections || [];
            autoModeToggle.checked = state.autoMode || false;
            renderCollections();
        } catch (e) {
            console.error('Failed to initialize:', e);
        }
    }

    init();

    // ============================================
    // 渲染收集内容
    // ============================================

    function renderCollections() {
        // 清除现有卡片（保留空状态元素）
        const existingCards = collectionList.querySelectorAll('.collection-card');
        existingCards.forEach(card => card.remove());

        // 更新计数
        collectionCount.textContent = `${collections.length} 条`;

        // 更新按钮状态
        clearBtn.disabled = collections.length === 0;
        copyBtn.disabled = collections.length === 0;

        // 显示/隐藏空状态
        if (collections.length === 0) {
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');

        // 渲染卡片
        collections.forEach(item => {
            const card = createCard(item);
            collectionList.appendChild(card);
        });

        // 滚动到底部
        collectionList.scrollTop = collectionList.scrollHeight;
    }

    function createCard(item) {
        const card = document.createElement('div');
        card.className = 'collection-card';
        card.dataset.id = item.id;

        // 内容类型样式
        let contentClass = 'card-content';
        if (item.type === 'heading') contentClass += ' heading';
        if (item.type === 'quote') contentClass += ' quote';
        if (item.type === 'code') contentClass += ' code';

        // 处理内容显示
        let displayContent = item.content;
        if (item.type === 'image') {
            // 尝试从 HTML 中提取图片
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = item.html;
            const img = tempDiv.querySelector('img');
            if (img) {
                displayContent = `<img src="${img.src}" alt="${img.alt || ''}" />`;
            }
        }

        // 处理来源域名显示
        let sourceDomain = '';
        try {
            sourceDomain = new URL(item.source.url).hostname;
        } catch (e) {
            sourceDomain = item.source.url;
        }

        card.innerHTML = `
      <div class="${contentClass}">${escapeHtml(displayContent)}</div>
      <div class="card-source">
        <img 
          class="source-favicon" 
          src="${item.source.favicon}" 
          onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22><rect fill=%22%23e5e7eb%22 width=%2216%22 height=%2216%22 rx=%222%22/><text x=%228%22 y=%2212%22 text-anchor=%22middle%22 fill=%22%2394a3b8%22 font-size=%2210%22>${sourceDomain.charAt(0).toUpperCase()}</text></svg>'"
          alt=""
        />
        <div class="source-info">
          <div class="source-title">${escapeHtml(item.source.title)}</div>
          <a class="source-url" href="${item.source.url}" target="_blank">${sourceDomain}</a>
        </div>
        <button class="card-delete" title="删除">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    `;

        // 删除按钮事件
        const deleteBtn = card.querySelector('.card-delete');
        deleteBtn.addEventListener('click', () => deleteItem(item.id));

        return card;
    }

    // ============================================
    // 操作函数
    // ============================================

    async function deleteItem(id) {
        try {
            await chrome.runtime.sendMessage({ type: 'REMOVE_COLLECTION', id });
            collections = collections.filter(c => c.id !== id);

            // 移除卡片动画
            const card = collectionList.querySelector(`[data-id="${id}"]`);
            if (card) {
                card.style.transition = 'all 0.3s ease';
                card.style.opacity = '0';
                card.style.transform = 'translateX(20px)';
                setTimeout(() => {
                    card.remove();
                    renderCollections();
                }, 300);
            } else {
                renderCollections();
            }
        } catch (e) {
            console.error('Failed to delete item:', e);
        }
    }

    async function clearAll() {
        if (!confirm('确定要清空所有收集的内容吗？')) return;

        try {
            await chrome.runtime.sendMessage({ type: 'CLEAR_COLLECTIONS' });
            collections = [];
            renderCollections();
        } catch (e) {
            console.error('Failed to clear collections:', e);
        }
    }

    async function copyAsMarkdown() {
        const markdown = generateMarkdown();

        try {
            await navigator.clipboard.writeText(markdown);
            showToast();
        } catch (e) {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = markdown;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showToast();
        }
    }

    // ============================================
    // Markdown 生成
    // ============================================

    function generateMarkdown() {
        if (collections.length === 0) return '';

        // 按来源分组
        const bySource = {};
        collections.forEach(item => {
            const key = item.source.url;
            if (!bySource[key]) {
                bySource[key] = {
                    title: item.source.title,
                    url: item.source.url,
                    items: []
                };
            }
            bySource[key].items.push(item);
        });

        // 生成 Markdown
        let markdown = `# FlowReader 研究笔记\n\n`;
        markdown += `> 导出时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
        markdown += `---\n\n`;

        Object.values(bySource).forEach(source => {
            markdown += `## [${source.title}](${source.url})\n\n`;

            source.items.forEach(item => {
                const content = item.content.trim();

                switch (item.type) {
                    case 'heading':
                        markdown += `### ${content}\n\n`;
                        break;
                    case 'quote':
                        markdown += `> ${content}\n\n`;
                        break;
                    case 'code':
                        markdown += `\`\`\`\n${content}\n\`\`\`\n\n`;
                        break;
                    case 'list':
                        // 尝试保持列表格式
                        content.split('\n').forEach(line => {
                            if (line.trim()) {
                                markdown += `- ${line.trim()}\n`;
                            }
                        });
                        markdown += '\n';
                        break;
                    case 'image':
                        // 尝试提取图片 URL
                        const imgMatch = item.html.match(/src="([^"]+)"/);
                        if (imgMatch) {
                            markdown += `![image](${imgMatch[1]})\n\n`;
                        }
                        break;
                    default:
                        markdown += `${content}\n\n`;
                }
            });

            markdown += `---\n\n`;
        });

        return markdown.trim();
    }

    // ============================================
    // UI 辅助函数
    // ============================================

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showToast() {
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2000);
    }

    // ============================================
    // 事件监听
    // ============================================

    // 自动模式切换
    autoModeToggle.addEventListener('change', async () => {
        try {
            await chrome.runtime.sendMessage({
                type: 'SET_AUTO_MODE',
                autoMode: autoModeToggle.checked
            });
        } catch (e) {
            console.error('Failed to toggle auto mode:', e);
        }
    });

    // 清空按钮
    clearBtn.addEventListener('click', clearAll);

    // 复制按钮
    copyBtn.addEventListener('click', copyAsMarkdown);

    // 监听来自 background 的消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        switch (message.type) {
            case 'COLLECTION_ADDED':
                collections.push(message.item);
                renderCollections();
                break;

            case 'COLLECTION_REMOVED':
                collections = collections.filter(c => c.id !== message.id);
                renderCollections();
                break;

            case 'COLLECTIONS_CLEARED':
                collections = [];
                renderCollections();
                break;

            case 'AUTO_MODE_CHANGED':
                autoModeToggle.checked = message.autoMode;
                break;
        }

        sendResponse({ success: true });
        return true;
    });
});
