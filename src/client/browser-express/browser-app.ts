import { hydrateRoot, createRoot as createReactRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import type { UniversalApp, UniversalResponse, GraphQLExecutor, RouteHandler } from '../../shared/types/index.ts';
import { Router } from './router.ts';
import { createBrowserRequest } from './browser-request.ts';
import { createBrowserResponse } from './browser-response.ts';
import { setupInterceptor } from './interceptor.ts';

export interface BrowserApp extends UniversalApp {
  start(): void;
  destroy(): void;
}

type ScrollMode = 'preserve' | 'top' | 'restore';

interface NavigationOptions {
  scrollMode?: ScrollMode;
  scrollPosition?: {
    x: number;
    y: number;
  };
}

export function createBrowserApp(graphql: GraphQLExecutor): BrowserApp {
  const router = new Router();
  let root: Root | null = null;
  let cleanupInterceptor: (() => void) | null = null;

  function applyScroll(options?: NavigationOptions) {
    const mode = options?.scrollMode ?? 'preserve';
    if (mode === 'preserve') return;

    const target = mode === 'restore'
      ? (options?.scrollPosition ?? { x: 0, y: 0 })
      : { x: 0, y: 0 };

    // Wait for React to commit and layout to settle before restoring.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo(target.x, target.y);
      });
    });
  }

  async function handleNavigation(path: string, method: string, body?: any, options?: NavigationOptions) {
    if (!root) {
      console.warn('Navigation attempted before hydration completed');
      return;
    }

    const [pathname] = path.split('?');
    const matched = router.match(method.toLowerCase(), pathname ?? path);
    if (!matched) {
      console.warn(`No route matched: ${method} ${path}`);
      return;
    }

    const req = createBrowserRequest(path, method, matched.params, graphql, body);
    const res = createBrowserResponse(root);

    try {
      await matched.handler(req, res);
      applyScroll(options);
    } catch (err) {
      console.error('Route error:', err);
    }
  }

  return {
    get(path: string, handler: RouteHandler) {
      router.add('get', path, handler);
    },
    post(path: string, handler: RouteHandler) {
      router.add('post', path, handler);
    },
    start() {
      const container = document.getElementById('root');
      if (!container) {
        console.error('Could not find hydration root element');
        return;
      }

      const path = window.location.pathname + window.location.search;
      const [pathname] = path.split('?');
      const matched = router.match('get', pathname ?? path);

      if (!matched) {
        console.warn('No route matched for initial hydration');
        return;
      }

      const req = createBrowserRequest(path, 'GET', matched.params, graphql);

      // For hydration, we render into the existing server HTML
      const res: UniversalResponse = {
        renderApp(element: any) {
          if (container.innerHTML) {
            root = hydrateRoot(container, element);
          } else {
            root = createReactRoot(container);
            root.render(element);
          }
        },
        setStatus(_code: number) {
          // Client cannot change the status code of the initial HTTP response.
        },
        redirect(url: string) {
          window.location.href = url;
        },
      };

      void (async () => {
        try {
          await matched.handler(req, res);
        } catch (err) {
          console.error('Initial route error:', err);
          return;
        }

        if (!root) {
          console.error('Initial route did not render the app');
          return;
        }

        // After hydration, intercept future navigations.
        cleanupInterceptor = setupInterceptor(handleNavigation);
      })();
    },
    destroy() {
      cleanupInterceptor?.();
      cleanupInterceptor = null;
      root?.unmount();
      root = null;
    },
  };
}
