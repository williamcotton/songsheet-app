import { createBrowserApp } from './browser-express/index.ts';
import { createClientExecutor } from './graphql/index.ts';
import { registerRoutes } from '../shared/universal-app.tsx';

const executor = createClientExecutor();
const app = createBrowserApp(executor);

registerRoutes(app);
app.start();
