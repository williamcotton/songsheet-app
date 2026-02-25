import type { ReactElement } from 'react';
import type { Root } from 'react-dom/client';
import type { UniversalResponse } from '../../shared/types/index.ts';

export function createBrowserResponse(root: Root): UniversalResponse {
  return {
    renderApp(element: ReactElement) {
      root.render(element);
    },
    setStatus(_code: number) {
      // Browser navigation cannot set an HTTP status code.
    },
    redirect(url: string) {
      window.history.pushState(null, '', url);
      window.dispatchEvent(new PopStateEvent('popstate'));
    },
  };
}
