type ScrollMode = 'preserve' | 'top' | 'restore';

interface ScrollPosition {
  x: number;
  y: number;
}

interface NavigateOptions {
  scrollMode?: ScrollMode;
  scrollPosition?: ScrollPosition;
}

type NavigateHandler = (path: string, method: string, body?: any, options?: NavigateOptions) => void;

const SCROLL_STATE_KEY = '__browserExpressScroll';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readScrollFromState(state: unknown): ScrollPosition | null {
  if (!isRecord(state)) return null;
  const raw = state[SCROLL_STATE_KEY];
  if (!isRecord(raw)) return null;

  const x = typeof raw.x === 'number' ? raw.x : Number(raw.x);
  const y = typeof raw.y === 'number' ? raw.y : Number(raw.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  return { x, y };
}

function currentState(): Record<string, unknown> {
  return isRecord(window.history.state) ? window.history.state : {};
}

function stateWithScroll(scroll: ScrollPosition): Record<string, unknown> {
  return {
    ...currentState(),
    [SCROLL_STATE_KEY]: scroll,
  };
}

export function setupInterceptor(onNavigate: NavigateHandler): () => void {
  const controller = new AbortController();
  const { signal } = controller;
  const previousScrollRestoration = window.history.scrollRestoration;

  let scrollFrame: number | null = null;
  let lastSavedX = Number.NaN;
  let lastSavedY = Number.NaN;

  function persistCurrentScroll() {
    const x = window.scrollX;
    const y = window.scrollY;
    if (x === lastSavedX && y === lastSavedY) return;

    lastSavedX = x;
    lastSavedY = y;
    window.history.replaceState(stateWithScroll({ x, y }), '', window.location.href);
  }

  function scheduleScrollPersist() {
    if (scrollFrame !== null) return;
    scrollFrame = window.requestAnimationFrame(() => {
      scrollFrame = null;
      persistCurrentScroll();
    });
  }

  window.history.scrollRestoration = 'manual';
  if (!readScrollFromState(window.history.state)) {
    persistCurrentScroll();
  }

  window.addEventListener('scroll', scheduleScrollPersist, { signal, passive: true });

  // Intercept link clicks
  document.addEventListener('click', (e) => {
    const event = e as MouseEvent;
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const target = event.target;
    if (!(target instanceof Element)) return;

    const anchor = target.closest('a');
    if (!anchor) return;
    if (anchor.target && anchor.target !== '_self') return;
    if (anchor.hasAttribute('download')) return;
    if (anchor.getAttribute('rel')?.includes('external')) return;

    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('#')) return;

    let url: URL;
    try {
      url = new URL(anchor.href, window.location.href);
    } catch {
      return;
    }

    if (!['http:', 'https:'].includes(url.protocol)) return;
    if (url.origin !== window.location.origin) return;

    // Keep native behavior for same-page hash navigation.
    if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) {
      return;
    }

    const routePath = `${url.pathname}${url.search}`;
    const historyPath = `${routePath}${url.hash}`;
    event.preventDefault();
    persistCurrentScroll();
    const nextState = { [SCROLL_STATE_KEY]: { x: 0, y: 0 } };
    window.history.pushState(nextState, '', historyPath);
    onNavigate(routePath, 'GET', undefined, { scrollMode: 'top' });
  }, { signal });

  // Intercept form submissions
  document.addEventListener('submit', (e) => {
    const event = e as SubmitEvent;
    if (event.defaultPrevented) return;

    const target = event.target;
    if (!(target instanceof HTMLFormElement)) return;
    if (target.target && target.target !== '_self') return;

    const method = (target.getAttribute('method') ?? 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'POST') return;

    let actionUrl: URL;
    try {
      actionUrl = new URL(target.getAttribute('action') ?? window.location.href, window.location.href);
    } catch {
      return;
    }

    if (!['http:', 'https:'].includes(actionUrl.protocol)) return;
    if (actionUrl.origin !== window.location.origin) return;

    event.preventDefault();
    const formData = new FormData(target);
    const body: Record<string, string> = {};
    formData.forEach((value, key) => {
      body[key] = value.toString();
    });

    if (method === 'GET') {
      const params = new URLSearchParams(actionUrl.search);
      for (const [key, value] of Object.entries(body)) {
        params.set(key, value);
      }
      const search = params.toString();
      const routePath = `${actionUrl.pathname}${search ? `?${search}` : ''}`;
      const historyPath = `${routePath}${actionUrl.hash}`;
      persistCurrentScroll();
      const nextState = { [SCROLL_STATE_KEY]: { x: 0, y: 0 } };
      window.history.pushState(nextState, '', historyPath);
      onNavigate(routePath, 'GET', undefined, { scrollMode: 'top' });
    } else {
      onNavigate(`${actionUrl.pathname}${actionUrl.search}`, method, body);
    }
  }, { signal });

  // Handle back/forward navigation
  window.addEventListener('popstate', (event) => {
    const scrollPosition = readScrollFromState(event.state) ?? readScrollFromState(window.history.state) ?? { x: 0, y: 0 };
    onNavigate(window.location.pathname + window.location.search, 'GET', undefined, {
      scrollMode: 'restore',
      scrollPosition,
    });
  }, { signal });

  return () => {
    if (scrollFrame !== null) {
      window.cancelAnimationFrame(scrollFrame);
      scrollFrame = null;
    }
    controller.abort();
    window.history.scrollRestoration = previousScrollRestoration;
  };
}
