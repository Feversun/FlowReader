// FlowReader Popup Script

document.addEventListener('DOMContentLoaded', async () => {
    const activateBtn = document.getElementById('activateBtn');
    const openPanelBtn = document.getElementById('openPanelBtn');
    const autoModeSwitch = document.getElementById('autoModeSwitch');

    // 获取当前状态
    try {
        const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
        autoModeSwitch.checked = state.autoMode;
    } catch (e) {
        console.error('Failed to get state:', e);
    }

    // 激活阅读模式
    activateBtn.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            try {
                // 发送激活消息到内容脚本
                await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_READER' });
                // 打开侧边栏
                await chrome.sidePanel.open({ tabId: tab.id });
                // 关闭popup
                window.close();
            } catch (e) {
                console.error('Failed to activate reader:', e);
                // 可能是特殊页面，无法注入内容脚本
                alert('无法在此页面激活阅读模式');
            }
        }
    });

    // 打开收集面板
    openPanelBtn.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            await chrome.sidePanel.open({ tabId: tab.id });
            window.close();
        }
    });

    // 自动模式切换
    autoModeSwitch.addEventListener('change', async () => {
        await chrome.runtime.sendMessage({
            type: 'SET_AUTO_MODE',
            autoMode: autoModeSwitch.checked
        });
    });
});
