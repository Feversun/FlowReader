// FlowReader Background Service Worker
// 管理全局状态、消息通信和跨标签页同步

// ============================================
// 状态管理
// ============================================

const DEFAULT_STATE = {
  autoMode: false,        // 自动模式开关
  collections: [],        // 收集的内容数组
  activeTabs: new Set()   // 已激活阅读模式的标签页
};

let state = { ...DEFAULT_STATE, activeTabs: new Set() };

// 从存储加载状态
async function loadState() {
  const stored = await chrome.storage.local.get(['autoMode', 'collections']);
  state.autoMode = stored.autoMode ?? false;
  state.collections = stored.collections ?? [];
  console.log('[FlowReader] State loaded:', { autoMode: state.autoMode, collectionsCount: state.collections.length });
}

// 保存状态到存储
async function saveState() {
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

// 允许用户通过点击 action 图标打开 side panel
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => { });

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
        isActive: sender.tab ? state.activeTabs.has(sender.tab.id) : false
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

    case 'ADD_COLLECTION':
      const item = {
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
      if (sender.tab) {
        state.activeTabs.add(sender.tab.id);
      }
      sendResponse({ success: true });
      break;

    case 'DEACTIVATE_READER':
      if (sender.tab) {
        state.activeTabs.delete(sender.tab.id);
      }
      sendResponse({ success: true });
      break;

    case 'OPEN_SIDE_PANEL':
      if (sender.tab) {
        chrome.sidePanel.open({ tabId: sender.tab.id });
      }
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ error: 'Unknown message type' });
  }

  return true; // 保持消息通道开放
});

// ============================================
// 标签页事件监听
// ============================================

// 标签页切换时，如果开启了自动模式，通知内容脚本激活
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (state.autoMode) {
    try {
      await chrome.tabs.sendMessage(activeInfo.tabId, { type: 'AUTO_ACTIVATE' });
    } catch (e) {
      // 标签页可能还没加载完成或者是特殊页面
      console.log('[FlowReader] Could not send auto-activate message:', e.message);
    }
  }
});

// 标签页关闭时清理状态
chrome.tabs.onRemoved.addListener((tabId) => {
  state.activeTabs.delete(tabId);
});

// 标签页更新时（导航到新页面），如果开启了自动模式，重新激活
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && state.autoMode && state.activeTabs.has(tabId)) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'AUTO_ACTIVATE' });
    } catch (e) {
      console.log('[FlowReader] Could not send auto-activate on update:', e.message);
    }
  }
});

// 监听快捷键命令
chrome.commands.onCommand.addListener(async (command) => {
  console.log('[FlowReader] Command received:', command);

  if (command === 'toggle_reader') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_READER' });
        // 同时打开侧边栏
        chrome.sidePanel.open({ tabId: tab.id });
      } catch (e) {
        console.log('[FlowReader] Could not toggle reader:', e.message);
      }
    }
  }
});

// ============================================
// 工具函数
// ============================================

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

async function broadcastToAllTabs(message) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    try {
      await chrome.tabs.sendMessage(tab.id, message);
    } catch (e) {
      // 忽略无法发送消息的标签页
    }
  }
}

async function broadcastToSidePanel(message) {
  try {
    await chrome.runtime.sendMessage(message);
  } catch (e) {
    // Side panel 可能没有打开
  }
}
