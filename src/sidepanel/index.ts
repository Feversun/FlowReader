import '../shared/types'; // Import for side effects if needed
import type { CollectionItem } from '../shared/types';
import { storage } from '../shared/storage';

// Elements
const collectionList = document.getElementById('collectionList') as HTMLElement;
const autoModeToggle = document.getElementById('autoModeToggle') as HTMLInputElement;
const clearBtn = document.getElementById('clearBtn') as HTMLButtonElement;
const copyBtn = document.getElementById('copyBtn') as HTMLButtonElement;
const canvasBtn = document.getElementById('canvasBtn') as HTMLButtonElement;
const toast = document.getElementById('toast') as HTMLElement;

// State
let collections: CollectionItem[] = [];

// Initialize
async function init() {
    // Load config
    const { autoMode } = await chrome.storage.local.get(['autoMode']);
    autoModeToggle.checked = !!autoMode;

    // Load collections
    await loadCollections();

    // Bind events
    bindEvents();
}

async function loadCollections() {
    collections = await storage.getCollections();
    renderList();
}

function renderList() {
    collectionList.innerHTML = '';

    if (collections.length === 0) {
        collectionList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📝</div>
                <h3>暂无收集内容</h3>
                <p>在阅读模式下点击段落即可收集</p>
            </div>
        `;
        return;
    }

    // Sort by timestamp desc (newest first)
    // Actually storage pushes new items to end, so we should reverse for display
    const reversed = [...collections].reverse();

    reversed.forEach(item => {
        const el = document.createElement('div');
        el.className = 'collection-item';
        el.innerHTML = `
            <div class="item-content ${item.type}">${escapeHtml(item.content)}</div>
            <div class="item-meta">
                <div class="item-source" title="${escapeHtml(item.source.title)}">
                    ${item.source.favicon ? `<img src="${item.source.favicon}" class="favicon" onerror="this.style.display='none'">` : ''}
                    <span class="source-title">${escapeHtml(item.source.title)}</span>
                </div>
                <button class="icon-btn delete-btn" data-id="${item.id}" title="删除">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>
        `;
        collectionList.appendChild(el);
    });

    // Bind delete buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = (e.currentTarget as HTMLElement).dataset.id;
            if (id) {
                await storage.removeCollection(id);
                // Also notify background to broadcast update (handled by storage listener in background usually, but here we can just reload)
                chrome.runtime.sendMessage({ type: 'REMOVE_COLLECTION', id });
                // We will receive COLLECTION_REMOVED message
            }
        });
    });

    // Scroll to top
    collectionList.scrollTop = 0;
}

function bindEvents() {
    // Auto Mode Toggle
    autoModeToggle.addEventListener('change', async () => {
        const autoMode = autoModeToggle.checked;
        chrome.runtime.sendMessage({ type: 'SET_AUTO_MODE', autoMode });
    });

    // Clear All
    clearBtn.addEventListener('click', async () => {
        if (confirm('确定要清空所有收集内容吗？')) {
            chrome.runtime.sendMessage({ type: 'CLEAR_COLLECTIONS' });
        }
    });

    // Copy All
    copyBtn.addEventListener('click', () => {
        const text = collections.map(c => {
            return `> ${c.content}\n\nVia: [${c.source.title}](${c.source.url})`;
        }).join('\n\n---\n\n');

        navigator.clipboard.writeText(text).then(() => {
            showToast('已复制全部内容');
        });
    });

    // Open Canvas
    canvasBtn.addEventListener('click', async () => {
        const url = chrome.runtime.getURL('src/canvas/index.html');
        await chrome.tabs.create({ url });
    });

    // Message Listener
    chrome.runtime.onMessage.addListener((message) => {
        switch (message.type) {
            case 'COLLECTION_ADDED':
                collections.push(message.item);
                renderList();
                break;
            case 'COLLECTION_REMOVED':
                collections = collections.filter(c => c.id !== message.id);
                renderList();
                break;
            case 'COLLECTIONS_CLEARED':
                collections = [];
                renderList();
                break;
            case 'AUTO_MODE_CHANGED':
                autoModeToggle.checked = message.autoMode;
                break;
        }
    });
}

function showToast(msg: string) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
}

function escapeHtml(text: string) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

init();
