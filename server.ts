import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import compression from 'compression';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

async function createServer() {
  const app = express();
  app.use(compression());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // --- GraphQL setup (imported directly, not via ssrLoadModule) ---
  const songsDir = path.resolve(__dirname, 'public/songs');
  const { createDataStore } = await import('./src/server/graphql/data-store.ts');
  const { createSchema } = await import('./src/shared/graphql/schema.ts');
  const { createServerExecutor } = await import('./src/server/graphql/executor.ts');
  const { createGraphQLEndpoint } = await import('./src/server/graphql/endpoint.ts');

  const dataStore = createDataStore(songsDir);
  const schema = createSchema(dataStore);
  const executor = createServerExecutor(schema);
  app.post('/graphql', createGraphQLEndpoint(schema));

  // --- Vite / static setup ---
  let vite: any;

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
  } else {
    app.use(
      '/assets',
      express.static(path.resolve(__dirname, 'dist/client/assets'), {
        immutable: true,
        maxAge: '1y',
      })
    );
    app.use(express.static(path.resolve(__dirname, 'dist/client'), { index: false }));
  }

  // --- HTML template ---
  const { serializeForInlineScript } = await import('./src/server/html-shell.ts');

  let prodTemplate: string | undefined;
  let prodRender: any;
  if (isProd) {
    prodTemplate = fs.readFileSync(path.resolve(__dirname, 'dist/client/index.html'), 'utf-8');
    // @ts-ignore — dist/ only exists after build
    prodRender = (await import('./dist/server/entry-server.js')).render;
  }

  // --- SSR catch-all ---
  app.use('*all', async (req, res, next) => {
    const url = req.originalUrl;

    try {
      let template: string;
      let render: any;

      if (!isProd) {
        template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        render = (await vite.ssrLoadModule('/src/entry-server.tsx')).render;
      } else {
        template = prodTemplate!;
        render = prodRender;
      }

      const result = await render(url, req.method, req.body, executor);

      if (result.redirect) {
        res.redirect(result.statusCode === 302 ? 302 : result.statusCode, result.redirect);
        return;
      }

      const initialDataScript = `<script>window.__INITIAL_DATA__=${serializeForInlineScript({ graphql: result.graphqlCache })};</script>`;

      const html = template
        .replace('<!--ssr-outlet-->', result.appHtml)
        .replace('<!--initial-data-->', initialDataScript);

      res.status(result.statusCode).set({ 'Content-Type': 'text/html' }).send(html);
    } catch (e: any) {
      if (!isProd) vite.ssrFixStacktrace(e);
      console.error(e);
      next(e);
    }
  });

  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

createServer();
