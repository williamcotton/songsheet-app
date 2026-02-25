type NavigateHandler = (path: string, method: string, body?: any) => void;

export function setupInterceptor(onNavigate: NavigateHandler): () => void {
  const controller = new AbortController();
  const { signal } = controller;

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
    window.history.pushState(null, '', historyPath);
    onNavigate(routePath, 'GET');
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
      window.history.pushState(null, '', historyPath);
      onNavigate(routePath, 'GET');
    } else {
      onNavigate(`${actionUrl.pathname}${actionUrl.search}`, method, body);
    }
  }, { signal });

  // Handle back/forward navigation
  window.addEventListener('popstate', () => {
    onNavigate(window.location.pathname + window.location.search, 'GET');
  }, { signal });

  return () => controller.abort();
}
