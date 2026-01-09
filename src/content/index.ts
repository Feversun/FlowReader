import './readability.min.js';
import './content.css';

// FlowReader Content Script
// 负责阅读视图渲染、块状化交互和内容收集

// Readability 通过 manifest.json 作为单独的 content_script 注入
declare const Readability: any;
declare global {
  interface Window {
    __flowReaderInjected?: boolean;
    Readability: any;
  }
}

(function () {
  'use strict';

  // 防止重复注入
  if (window.__flowReaderInjected) return;
  window.__flowReaderInjected = true;

  // ============================================
  // 状态变量
  // ============================================

  let isReaderActive = false;
  let readerOverlay: HTMLElement | null = null;
  let collectedBlocks = new Set(); // 已收集的块 ID

  // ============================================
  // 阅读视图激活/关闭
  // ============================================

  function activateReader() {
    if (isReaderActive) return;

    // 检测页面是否适合提取文章
    const documentClone = document.cloneNode(true) as Document;
    const article = new Readability(documentClone).parse();

    if (!article || !article.content) {
      console.log('[FlowReader] Could not extract article content');
      // 即使无法提取文章，也尝试创建简单的阅读视图
      createSimpleReader();
      return;
    }

    createReaderView(article);
    isReaderActive = true;
    chrome.runtime.sendMessage({ type: 'ACTIVATE_READER' });
  }

  function deactivateReader() {
    if (!isReaderActive) return;

    if (readerOverlay) {
      readerOverlay.remove();
      readerOverlay = null;
    }

    document.body.style.overflow = '';
    isReaderActive = false;
    chrome.runtime.sendMessage({ type: 'DEACTIVATE_READER' });
  }

  function toggleReader() {
    if (isReaderActive) {
      deactivateReader();
    } else {
      activateReader();
    }
  }

  // ============================================
  // 阅读视图渲染
  // ============================================

  function createReaderView(article: any) {
    // 创建覆盖层
    readerOverlay = document.createElement('div');
    readerOverlay.id = 'flowreader-overlay';
    readerOverlay.innerHTML = `
      <div class="flowreader-container">
        <header class="flowreader-header">
          <button class="flowreader-close" title="关闭阅读模式">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
          <div class="flowreader-meta">
            <h1 class="flowreader-title">${escapeHtml(article.title)}</h1>
            ${article.byline ? `<p class="flowreader-byline">${escapeHtml(article.byline)}</p>` : ''}
            ${article.siteName ? `<p class="flowreader-site">${escapeHtml(article.siteName)}</p>` : ''}
          </div>
        </header>
        <article class="flowreader-content">
          ${processContent(article.content)}
        </article>
        
        <!-- Floating Toolbar -->
        <div class="flowreader-toolbar">
          <!-- Theme Switcher -->
          <div class="toolbar-group theme-switcher">
            <button class="toolbar-btn theme-btn active" data-theme="minimal" title="极简黑白">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                <path d="M12 2a10 10 0 0 1 0 20" fill="currentColor"/>
              </svg>
            </button>
            <button class="toolbar-btn theme-btn" data-theme="sepia" title="浅棕复古">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="3" fill="#d4a574" opacity="0.3" stroke="#d4a574" stroke-width="2"/>
              </svg>
            </button>
            <button class="toolbar-btn theme-btn" data-theme="forest" title="森林绿意">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="3" fill="#86efac" opacity="0.3" stroke="#22c55e" stroke-width="2"/>
              </svg>
            </button>
          </div>
          
          <div class="toolbar-divider"></div>
          
          <!-- Dark Mode Toggle -->
          <button class="toolbar-btn dark-mode-btn" id="darkModeToggle" title="切换深色模式">
            <svg class="icon-sun" width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <svg class="icon-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" style="display:none">
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          
          <div class="toolbar-divider"></div>
          
          <!-- Help Icon -->
          <div class="toolbar-help-wrapper">
            <button class="toolbar-btn help-btn" title="使用帮助">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <circle cx="12" cy="17" r="1" fill="currentColor"/>
              </svg>
            </button>
            <div class="toolbar-popover">
              <div class="popover-content">
                <p><strong>💡 使用提示</strong></p>
                <p>点击任意段落即可收集到右侧面板</p>
                <p>再次点击可取消收集</p>
                <p>按 <kbd>Esc</kbd> 关闭阅读模式</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // 禁用原页面滚动
    document.body.style.overflow = 'hidden';
    document.body.appendChild(readerOverlay);

    // 绑定事件
    bindReaderEvents();
  }

  function createSimpleReader() {
    // 对于无法用 Readability 提取的页面，创建简单的遮罩视图
    const mainContent = document.body.cloneNode(true) as HTMLElement;

    // 移除脚本和样式
    mainContent.querySelectorAll('script, style, noscript, iframe').forEach(el => el.remove());

    readerOverlay = document.createElement('div');
    readerOverlay.id = 'flowreader-overlay';
    readerOverlay.innerHTML = `
      <div class="flowreader-container flowreader-simple">
        <header class="flowreader-header">
          <button class="flowreader-close" title="关闭阅读模式">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
          <div class="flowreader-meta">
            <h1 class="flowreader-title">${escapeHtml(document.title)}</h1>
          </div>
        </header>
        <article class="flowreader-content">
          ${processSimpleContent(mainContent)}
        </article>
        
        <!-- Floating Toolbar -->
        <div class="flowreader-toolbar">
          <div class="toolbar-group theme-switcher">
            <button class="toolbar-btn theme-btn active" data-theme="minimal" title="极简黑白">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                <path d="M12 2a10 10 0 0 1 0 20" fill="currentColor"/>
              </svg>
            </button>
            <button class="toolbar-btn theme-btn" data-theme="sepia" title="浅棕复古">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="3" fill="#d4a574" opacity="0.3" stroke="#d4a574" stroke-width="2"/>
              </svg>
            </button>
            <button class="toolbar-btn theme-btn" data-theme="forest" title="森林绿意">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="3" fill="#86efac" opacity="0.3" stroke="#22c55e" stroke-width="2"/>
              </svg>
            </button>
          </div>
          <div class="toolbar-divider"></div>
          <button class="toolbar-btn dark-mode-btn" id="darkModeToggle" title="切换深色模式">
            <svg class="icon-sun" width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <svg class="icon-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" style="display:none">
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div class="toolbar-divider"></div>
          <div class="toolbar-help-wrapper">
            <button class="toolbar-btn help-btn" title="使用帮助">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <circle cx="12" cy="17" r="1" fill="currentColor"/>
              </svg>
            </button>
            <div class="toolbar-popover">
              <div class="popover-content">
                <p><strong>💡 使用提示</strong></p>
                <p>点击任意段落即可收集到右侧面板</p>
                <p>再次点击可取消收集</p>
                <p>按 <kbd>Esc</kbd> 关闭阅读模式</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.style.overflow = 'hidden';
    document.body.appendChild(readerOverlay);

    bindReaderEvents();
    isReaderActive = true;
    chrome.runtime.sendMessage({ type: 'ACTIVATE_READER' });
  }

  // ============================================
  // 内容处理 - 块状化
  // ============================================

  function processContent(html: string) {
    const container = document.createElement('div');
    container.innerHTML = html;

    let blockId = 0;

    // 处理所有块级元素
    const blockElements = container.querySelectorAll('p, h1, h2, h3, h4, h5, h6, blockquote, pre, ul, ol, figure, img, table');

    blockElements.forEach(el => {
      // 跳过嵌套在其他块内的元素
      if (el.closest('li') && el.tagName !== 'UL' && el.tagName !== 'OL') return;
      if (el.closest('blockquote') && el.tagName !== 'BLOCKQUOTE') return;

      const id = `flowreader-block-${blockId++}`;
      el.setAttribute('data-flowreader-block', id);
      el.classList.add('flowreader-block');
    });

    return container.innerHTML;
  }

  function processSimpleContent(container: HTMLElement) {
    let blockId = 0;

    // 提取文本节点和块级元素
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
          }
          const tag = (node as Element).tagName.toLowerCase();
          if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'article', 'section'].includes(tag)) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        }
      }
    );

    const blocks: { id: string, tag: string, content: string }[] = [];
    let node: Node | null;
    while (node = walker.nextNode()) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const text = el.innerText?.trim();
        if (text && text.length > 20) {
          blocks.push({
            id: `flowreader-block-${blockId++}`,
            tag: el.tagName.toLowerCase(),
            content: text.substring(0, 500)
          });
        }
      }
    }

    // 去重
    const seen = new Set();
    const uniqueBlocks = blocks.filter(block => {
      const key = block.content.substring(0, 100);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return uniqueBlocks.map(block => {
      const tag = block.tag.startsWith('h') ? block.tag : 'p';
      return `<${tag} class="flowreader-block" data-flowreader-block="${block.id}">${escapeHtml(block.content)}</${tag}>`;
    }).join('');
  }

  // ============================================
  // 事件绑定
  // ============================================

  let isDarkMode = false;
  // let currentTheme = 'minimal';

  function bindReaderEvents() {
    if (!readerOverlay) return;

    // 关闭按钮
    const closeBtn = readerOverlay.querySelector('.flowreader-close');
    closeBtn?.addEventListener('click', deactivateReader);

    // ESC 键关闭
    document.addEventListener('keydown', handleKeydown);

    // 块点击收集
    readerOverlay.addEventListener('click', handleBlockClick);

    // 工具栏事件
    bindToolbarEvents();
  }

  function bindToolbarEvents() {
    if (!readerOverlay) return;

    // 主题切换
    const themeBtns = readerOverlay.querySelectorAll('.theme-btn') as NodeListOf<HTMLElement>;
    themeBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const theme = btn.dataset.theme;
        if (theme) setTheme(theme);

        // 更新按钮状态
        themeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // 深色模式切换
    const darkModeBtn = readerOverlay.querySelector('.dark-mode-btn');
    darkModeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDarkMode();
    });

    // 帮助按钮悬浮显示 popover（由 CSS 处理 hover）
  }

  function setTheme(theme: string) {
    // currentTheme = theme;
    const overlay = document.getElementById('flowreader-overlay');
    if (!overlay) return;

    // 移除所有主题类
    overlay.classList.remove('theme-minimal', 'theme-sepia', 'theme-forest');
    overlay.classList.add(`theme-${theme}`);
  }

  function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    const overlay = document.getElementById('flowreader-overlay');
    if (!overlay) return;

    overlay.classList.toggle('dark-mode', isDarkMode);

    // 更新图标显示
    const sunIcon = overlay.querySelector('.icon-sun') as HTMLElement;
    const moonIcon = overlay.querySelector('.icon-moon') as HTMLElement;
    if (sunIcon && moonIcon) {
      sunIcon.style.display = isDarkMode ? 'none' : 'block';
      moonIcon.style.display = isDarkMode ? 'block' : 'none';
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isReaderActive) {
      deactivateReader();
    }
  }

  function handleBlockClick(e: Event) {
    const target = e.target as HTMLElement;
    const block = target.closest('.flowreader-block');
    if (!block) return;

    e.preventDefault();
    e.stopPropagation();

    const blockId = block.getAttribute('data-flowreader-block');
    if (!blockId) return;

    if (collectedBlocks.has(blockId)) {
      // 取消收集
      uncollectBlock(block as HTMLElement, blockId);
    } else {
      // 收集
      collectBlock(block as HTMLElement, blockId);
    }
  }

  // ============================================
  // 收集功能
  // ============================================

  function collectBlock(block: HTMLElement, blockId: string) {
    // 添加高亮样式
    block.classList.add('flowreader-collected');
    collectedBlocks.add(blockId);

    // 添加飞入动画
    addFlyAnimation(block);

    // 获取内容
    const content = block.innerText || block.textContent || '';
    const html = block.innerHTML;
    const contentType = getContentType(block);

    // 发送到 background
    chrome.runtime.sendMessage({
      type: 'ADD_COLLECTION',
      content: content,
      html: html,
      contentType: contentType,
      blockId: blockId,
      source: {
        url: window.location.href,
        title: document.title,
        favicon: getFavicon()
      }
    });
  }

  function uncollectBlock(block: HTMLElement, blockId: string) {
    block.classList.remove('flowreader-collected');
    collectedBlocks.delete(blockId);
  }

  function getContentType(block: HTMLElement) {
    const tag = block.tagName.toLowerCase();
    if (tag === 'img' || block.querySelector('img')) return 'image';
    if (tag.startsWith('h')) return 'heading';
    if (tag === 'blockquote') return 'quote';
    if (tag === 'pre' || tag === 'code') return 'code';
    if (tag === 'ul' || tag === 'ol') return 'list';
    return 'text';
  }

  function addFlyAnimation(block: HTMLElement) {
    // 创建飞行的克隆元素
    const rect = block.getBoundingClientRect();
    const flyElement = document.createElement('div');
    flyElement.className = 'flowreader-fly-element';
    flyElement.textContent = (block.innerText || '').substring(0, 50) + '...';
    flyElement.style.cssText = `
      position: fixed;
      top: ${rect.top}px;
      left: ${rect.left}px;
      width: ${Math.min(rect.width, 300)}px;
      pointer-events: none;
      z-index: 2147483647;
    `;

    document.body.appendChild(flyElement);

    // 触发动画
    requestAnimationFrame(() => {
      flyElement.classList.add('flowreader-fly-animate');
      flyElement.style.top = `${window.innerHeight / 2}px`;
      flyElement.style.left = `${window.innerWidth - 50}px`;
      flyElement.style.opacity = '0';
      flyElement.style.transform = 'scale(0.5)';
    });

    // 移除元素
    setTimeout(() => flyElement.remove(), 500);
  }

  // ============================================
  // 工具函数
  // ============================================

  function escapeHtml(text: string) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function getFavicon() {
    const link = document.querySelector('link[rel~="icon"]') as HTMLLinkElement;
    if (link) return link.href;
    return `${window.location.origin}/favicon.ico`;
  }

  // ============================================
  // 消息监听
  // ============================================

  chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
    switch (message.type) {
      case 'TOGGLE_READER':
        toggleReader();
        sendResponse({ success: true, isActive: isReaderActive });
        break;

      case 'AUTO_ACTIVATE':
        if (!isReaderActive) {
          activateReader();
        }
        sendResponse({ success: true });
        break;

      case 'AUTO_MODE_CHANGED':
        // 自动模式状态变化，可以在这里更新 UI
        sendResponse({ success: true });
        break;

      case 'CLEAR_HIGHLIGHTS':
        // 清除所有高亮
        collectedBlocks.clear();
        document.querySelectorAll('.flowreader-collected').forEach(el => {
          el.classList.remove('flowreader-collected');
        });
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ error: 'Unknown message type' });
    }
    return true;
  });

  console.log('[FlowReader] Content script loaded');
})();

export { };
