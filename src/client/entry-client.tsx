import { createBrowserApp } from './browser-express/index.ts';
import { createClientExecutor } from './graphql/index.ts';
import { registerRoutes } from '../shared/universal-app.tsx';

const executor = createClientExecutor();
const app = createBrowserApp(executor);

registerRoutes(app);
app.start();

const hot = (import.meta as ImportMeta & {
  hot?: {
    accept: () => void;
    dispose: (cb: () => void) => void;
  };
}).hot;

if (hot) {
  hot.accept();
  hot.dispose(() => {
    app.destroy();
  });
}
