// FlowReader Background Service Worker
// 管理全局状态、消息通信和跨标签页同步

import type { CollectionItem } from '../shared/types';

// ============================================
// 状态管理
// ============================================

interface State {
    autoMode: boolean;
    collections: CollectionItem[];
    activeTabs: Set<number>;
}

const DEFAULT_STATE: State = {
    autoMode: false,
    collections: [],
    activeTabs: new Set()
};

let state: State = { ...DEFAULT_STATE, activeTabs: new Set() };

// 从存储加载状态
async function loadState(): Promise<void> {
    const stored = await chrome.storage.local.get(['autoMode', 'collections']);
    state.autoMode = stored.autoMode ?? false;
    state.collections = stored.collections ?? [];
    console.log('[FlowReader] State loaded:', { autoMode: state.autoMode, collectionsCount: state.collections.length });
}

// 保存状态到存储
async function saveState(): Promise<void> {
    await chrome.storage.local.set({
        autoMode: state.autoMode,
        collections: state.collections
    });
}

// 初始化
loadState();

// ============================================
// Side Panel 管理
// ============================================

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => { });

// ============================================
// 点击扩展图标 - 直接激活阅读模式 + 打开侧边栏
// ============================================

chrome.action.onClicked.addListener(async (tab) => {
    console.log('[FlowReader] Action clicked on tab:', tab.id);

    if (!tab.id || tab.url?.startsWith('chrome://')) {
        console.log('[FlowReader] Cannot activate on this page');
        return;
    }

    // 先同步打开侧边栏（必须在用户手势上下文中）
    chrome.sidePanel.open({ tabId: tab.id });

    // 然后发送消息激活阅读模式
    try {
        await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_READER' });
    } catch (e: any) {
        console.log('[FlowReader] Could not activate reader:', e.message);
    }
});

// ============================================
// 消息处理
// ============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[FlowReader] Message received:', message.type);

    switch (message.type) {
        case 'GET_STATE':
            sendResponse({
                autoMode: state.autoMode,
                collections: state.collections,
                isActive: sender.tab?.id ? state.activeTabs.has(sender.tab.id) : false
            });
            break;

        case 'TOGGLE_AUTO_MODE':
            state.autoMode = !state.autoMode;
            saveState();
            broadcastToAllTabs({ type: 'AUTO_MODE_CHANGED', autoMode: state.autoMode });
            sendResponse({ autoMode: state.autoMode });
            break;

        case 'SET_AUTO_MODE':
            state.autoMode = message.autoMode;
            saveState();
            broadcastToAllTabs({ type: 'AUTO_MODE_CHANGED', autoMode: state.autoMode });
            sendResponse({ autoMode: state.autoMode });
            break;

        case 'ADD_COLLECTION': {
            const item: CollectionItem = {
                id: generateId(),
                content: message.content,
                html: message.html,
                type: message.contentType || 'text',
                source: {
                    url: message.source.url,
                    title: message.source.title,
                    favicon: message.source.favicon
                },
                timestamp: Date.now()
            };
            state.collections.push(item);
            saveState();
            broadcastToSidePanel({ type: 'COLLECTION_ADDED', item });
            sendResponse({ success: true, item });
            break;
        }

        case 'REMOVE_COLLECTION':
            state.collections = state.collections.filter(c => c.id !== message.id);
            saveState();
            broadcastToSidePanel({ type: 'COLLECTION_REMOVED', id: message.id });
            sendResponse({ success: true });
            break;

        case 'CLEAR_COLLECTIONS':
            state.collections = [];
            saveState();
            broadcastToSidePanel({ type: 'COLLECTIONS_CLEARED' });
            broadcastToAllTabs({ type: 'CLEAR_HIGHLIGHTS' });
            sendResponse({ success: true });
            break;

        case 'ACTIVATE_READER':
            if (sender.tab?.id) {
                state.activeTabs.add(sender.tab.id);
            }
            sendResponse({ success: true });
            break;

        case 'DEACTIVATE_READER':
            if (sender.tab?.id) {
                state.activeTabs.delete(sender.tab.id);
            }
            sendResponse({ success: true });
            break;

        case 'OPEN_SIDE_PANEL':
            if (sender.tab?.id) {
                chrome.sidePanel.open({ tabId: sender.tab.id });
            }
            sendResponse({ success: true });
            break;

        default:
            sendResponse({ error: 'Unknown message type' });
    }

    return true;
});

// ============================================
// 标签页事件监听
// ============================================

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    if (state.autoMode) {
        try {
            await chrome.tabs.sendMessage(activeInfo.tabId, { type: 'AUTO_ACTIVATE' });
        } catch (e: any) {
            console.log('[FlowReader] Could not send auto-activate message:', e.message);
        }
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    state.activeTabs.delete(tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
    if (changeInfo.status === 'complete' && state.autoMode && state.activeTabs.has(tabId)) {
        try {
            await chrome.tabs.sendMessage(tabId, { type: 'AUTO_ACTIVATE' });
        } catch (e: any) {
            console.log('[FlowReader] Could not send auto-activate on update:', e.message);
        }
    }
});

chrome.commands.onCommand.addListener(async (command) => {
    console.log('[FlowReader] Command received:', command);

    if (command === 'toggle_reader') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
            try {
                await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_READER' });
                chrome.sidePanel.open({ tabId: tab.id });
            } catch (e: any) {
                console.log('[FlowReader] Could not toggle reader:', e.message);
            }
        }
    }
});

// ============================================
// 工具函数
// ============================================

function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

async function broadcastToAllTabs(message: Record<string, any>): Promise<void> {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
        if (tab.id) {
            try {
                await chrome.tabs.sendMessage(tab.id, message);
            } catch {
                // 忽略
            }
        }
    }
}

async function broadcastToSidePanel(message: Record<string, any>): Promise<void> {
    try {
        await chrome.runtime.sendMessage(message);
    } catch {
        // Side panel 可能没有打开
    }
}
