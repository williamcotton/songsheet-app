import type { ReactNode } from 'react';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <nav id="nav-bar">
        <a href="/songs">Songs</a>
      </nav>
      {children}
    </>
  );
}
