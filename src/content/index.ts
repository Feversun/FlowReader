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
  let isMinimized = false;
  let readerOverlay: HTMLElement | null = null;
  let minimizedBtn: HTMLElement | null = null;
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
    if (minimizedBtn) {
      minimizedBtn.remove();
      minimizedBtn = null;
    }

    document.body.style.overflow = '';
    isReaderActive = false;
    isMinimized = false;
    chrome.runtime.sendMessage({ type: 'DEACTIVATE_READER' });
  }

  function minimizeReader() {
    if (!isReaderActive || isMinimized) return;

    isMinimized = true;

    // 隐藏阅读视图
    if (readerOverlay) {
      readerOverlay.style.display = 'none';
    }
    document.body.style.overflow = '';

    // 创建最小化悬浮按钮
    if (!minimizedBtn) {
      minimizedBtn = document.createElement('div');
      minimizedBtn.id = 'flowreader-minimized-btn';
      minimizedBtn.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="2"/>
          <path d="M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path d="M12 8v8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <span class="minimized-label">FlowReader</span>
      `;
      minimizedBtn.title = '展开阅读模式';
      minimizedBtn.addEventListener('click', maximizeReader);
      document.body.appendChild(minimizedBtn);
    }
    minimizedBtn.style.display = 'flex';
  }

  function maximizeReader() {
    if (!isReaderActive || !isMinimized) return;

    isMinimized = false;

    // 显示阅读视图
    if (readerOverlay) {
      readerOverlay.style.display = '';
    }
    document.body.style.overflow = 'hidden';

    // 隐藏最小化按钮
    if (minimizedBtn) {
      minimizedBtn.style.display = 'none';
    }
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
          <button class="flowreader-close" title="最小化">
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
                <p>按 <kbd>Esc</kbd> 彻底关闭阅读模式</p>
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
          <button class="flowreader-close" title="最小化">
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
                <p>按 <kbd>Esc</kbd> 彻底关闭阅读模式</p>
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

      // 跳过空内容元素
      const textContent = el.textContent?.trim() || '';
      const isImage = el.tagName === 'IMG' || el.querySelector('img');

      // 如果既没有文本内容，也不是图片，则跳过
      if (!textContent && !isImage) return;

      // 如果是段落但只有空白或非常短的内容（可能是装饰性元素），跳过
      if (el.tagName === 'P' && textContent.length < 3 && !isImage) return;

      // 如果父元素是 figure 且当前是 img，跳过（让 figure 作为块）
      if (el.tagName === 'IMG' && el.closest('figure')) return;

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

  // 智能交互状态变量
  let isMousePressed = false;
  let isSelecting = false;
  let startX = 0;
  let startY = 0;
  let currentBlock: HTMLElement | null = null;
  const DRAG_THRESHOLD = 4; // 4像素阈值，防止手抖误判

  function bindReaderEvents() {
    if (!readerOverlay) return;

    // 最小化按钮（原关闭按钮）
    const closeBtn = readerOverlay.querySelector('.flowreader-close');
    closeBtn?.addEventListener('click', minimizeReader);

    // ESC 键关闭
    document.addEventListener('keydown', handleKeydown);

    // 智能块交互（替代简单的 click 事件）
    readerOverlay.addEventListener('mousedown', handleBlockMouseDown);
    readerOverlay.addEventListener('mousemove', handleBlockMouseMove);
    readerOverlay.addEventListener('mouseup', handleBlockMouseUp);
    readerOverlay.addEventListener('mouseleave', handleBlockMouseLeave);

    // 链接 hover 时取消 block 高亮
    readerOverlay.addEventListener('mouseover', handleLinkHover);
    readerOverlay.addEventListener('mouseout', handleLinkHoverOut);

    // 图片放大按钮事件
    bindImageZoomEvents();

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

  // ============================================
  // 智能块交互 - 3像素阈值法
  // ============================================

  // 检测链接是否主要是图片（而不是文字链接）
  function isImageLink(link: HTMLElement): boolean {
    // 检查链接内是否有图片
    const img = link.querySelector('img');
    if (!img) return false;

    // 检查文本内容是否很少（主要是图片）
    const textContent = link.textContent?.trim() || '';
    // 如果没有文本，或者文本只是图片的 alt 属性，认为是图片链接
    const imgAlt = img.alt || '';
    return textContent.length === 0 || textContent === imgAlt || textContent.length < 5;
  }

  function handleBlockMouseDown(e: MouseEvent) {
    const target = e.target as HTMLElement;

    // 如果点击的是工具栏、关闭按钮或放大按钮，不处理
    if (target.closest('.flowreader-toolbar') || target.closest('.flowreader-close') || target.closest('.flowreader-zoom-btn')) {
      return;
    }

    // 检查是否点击了链接
    const link = target.closest('a');
    if (link) {
      // 如果是图片链接，阻止默认行为，作为 block 处理
      if (isImageLink(link)) {
        e.preventDefault();
        e.stopPropagation();
        // 继续处理为 block
      } else {
        // 普通文字链接，交给浏览器处理
        return;
      }
    }

    const block = target.closest('.flowreader-block') as HTMLElement;
    if (!block) return;

    // 记录起始位置
    isMousePressed = true;
    isSelecting = false;
    startX = e.clientX;
    startY = e.clientY;
    currentBlock = block;
  }

  function handleBlockMouseMove(e: MouseEvent) {
    if (!isMousePressed || !currentBlock) return;

    // 已经是选择模式，不重复计算
    if (isSelecting) return;

    // 计算移动距离（勾股定理）
    const moveX = Math.abs(e.clientX - startX);
    const moveY = Math.abs(e.clientY - startY);
    const distance = Math.sqrt(moveX * moveX + moveY * moveY);

    // 超过阈值，判定为拖拽选词
    if (distance > DRAG_THRESHOLD) {
      isSelecting = true;
      // 移除 block 高亮，进入选词模式
      currentBlock.classList.add('flowreader-selecting');
    }
  }

  function handleBlockMouseUp(e: MouseEvent) {
    if (!isMousePressed) return;

    const target = e.target as HTMLElement;
    const block = currentBlock;

    // 重置状态
    isMousePressed = false;

    if (isSelecting) {
      // Case A: 刚才在选词，不触发收集
      // 延迟移除选择模式类，防止视觉跳变
      setTimeout(() => {
        if (currentBlock) {
          currentBlock.classList.remove('flowreader-selecting');
        }
        isSelecting = false;
        currentBlock = null;
      }, 100);
    } else {
      // Case B: 点击操作（且不是链接）
      if (block && !target.closest('a')) {
        const blockId = block.getAttribute('data-flowreader-block');
        if (blockId) {
          if (collectedBlocks.has(blockId)) {
            uncollectBlock(block, blockId);
          } else {
            collectBlock(block, blockId);
          }
        }
      }
      currentBlock = null;
    }
  }

  function handleBlockMouseLeave(_e: MouseEvent) {
    // 鼠标离开时重置状态，防止状态残留
    if (isMousePressed) {
      isMousePressed = false;
      if (currentBlock) {
        currentBlock.classList.remove('flowreader-selecting');
      }
      isSelecting = false;
      currentBlock = null;
    }
  }

  function handleLinkHover(e: MouseEvent) {
    const target = e.target as HTMLElement;
    const link = target.closest('a');
    if (!link) return;

    // 当 hover 到链接时，给父级 block 添加类名以取消高亮
    const block = link.closest('.flowreader-block');
    if (block) {
      block.classList.add('flowreader-link-hover');
    }
  }

  function handleLinkHoverOut(e: MouseEvent) {
    const target = e.target as HTMLElement;
    const link = target.closest('a');
    if (!link) return;

    const block = link.closest('.flowreader-block');
    if (block) {
      block.classList.remove('flowreader-link-hover');
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
    const contentType = getContentType(block);
    let content = block.innerText || block.textContent || '';
    let html = block.innerHTML;

    // 图片特殊处理
    if (contentType === 'image') {
      const img = block.tagName === 'IMG' ? block as HTMLImageElement : block.querySelector('img');
      if (img) {
        content = img.alt || img.title || '图片';
        // 确保 html 包含完整的 img 标签
        if (block.tagName === 'IMG') {
          html = block.outerHTML;
        }
      }
    }

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

    // 检测是否是图片
    const isImage = block.tagName === 'IMG' || block.querySelector('img');
    if (isImage) {
      const img = block.tagName === 'IMG' ? block as HTMLImageElement : block.querySelector('img')!;
      flyElement.innerHTML = `<img src="${img.src}" style="max-width: 100%; max-height: 60px; border-radius: 4px;" />`;
    } else {
      flyElement.textContent = (block.innerText || '').substring(0, 50) + '...';
    }

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

  // ============================================
  // 图片放大功能 - Lightbox
  // ============================================

  let currentZoomBtn: HTMLElement | null = null;
  let currentZoomBlock: HTMLElement | null = null;
  let lightboxOverlay: HTMLElement | null = null;

  function createZoomButton(): HTMLElement {
    const btn = document.createElement('button');
    btn.className = 'flowreader-zoom-btn';
    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/>
        <path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M11 8v6M8 11h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;
    btn.title = '放大查看';
    return btn;
  }

  function showZoomButton(block: HTMLElement, img: HTMLImageElement) {
    hideZoomButton(); // 先隐藏之前的

    const btn = createZoomButton();
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openLightbox(img.src, img.alt);
    });

    // 将按钮添加到 block 内
    block.style.position = 'relative';
    block.appendChild(btn);
    currentZoomBtn = btn;
    currentZoomBlock = block;
  }

  function hideZoomButton() {
    if (currentZoomBtn) {
      currentZoomBtn.remove();
      currentZoomBtn = null;
      currentZoomBlock = null;
    }
  }

  function openLightbox(src: string, alt: string = '') {
    // 创建 lightbox overlay
    lightboxOverlay = document.createElement('div');
    lightboxOverlay.className = 'flowreader-lightbox';
    lightboxOverlay.innerHTML = `
      <div class="lightbox-backdrop"></div>
      <div class="lightbox-content">
        <img src="${src}" alt="${alt}" />
        <div class="lightbox-caption">${alt || ''}</div>
      </div>
      <button class="lightbox-close" title="关闭">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    `;

    // 关闭事件
    const closeBtn = lightboxOverlay.querySelector('.lightbox-close');
    const backdrop = lightboxOverlay.querySelector('.lightbox-backdrop');

    closeBtn?.addEventListener('click', closeLightbox);
    backdrop?.addEventListener('click', closeLightbox);

    // ESC 关闭
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeLightbox();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);

    document.body.appendChild(lightboxOverlay);

    // 动画效果
    requestAnimationFrame(() => {
      lightboxOverlay?.classList.add('lightbox-visible');
    });
  }

  function closeLightbox() {
    if (lightboxOverlay) {
      lightboxOverlay.classList.remove('lightbox-visible');
      setTimeout(() => {
        lightboxOverlay?.remove();
        lightboxOverlay = null;
      }, 200);
    }
  }

  // 监听图片 block 的 hover - 不再使用动态添加按钮，改为使用事件委托
  function handleImageBlockHover(e: MouseEvent) {
    const target = e.target as HTMLElement;

    // 如果是放大按钮本身，不处理
    if (target.closest('.flowreader-zoom-btn')) return;

    // 检查是否是图片或包含图片的元素
    const block = target.closest('.flowreader-block') as HTMLElement;
    if (!block) {
      hideZoomButton();
      return;
    }

    // 检查是否是图片类型的 block
    const img = block.tagName === 'IMG'
      ? block as HTMLImageElement
      : block.querySelector('img') as HTMLImageElement;

    if (img && currentZoomBlock !== block) {
      showZoomButton(block, img);
    }
  }

  // 使用 mouseover 代替 mouseenter，更可靠
  function bindImageZoomEvents() {
    if (!readerOverlay) return;

    readerOverlay.addEventListener('mouseover', handleImageBlockHover);

    // 当鼠标离开整个 overlay 时隐藏按钮
    readerOverlay.addEventListener('mouseleave', () => {
      hideZoomButton();
    });
  }

  console.log('[FlowReader] Content script loaded');
})();

export { };
