import { defineConfig } from 'vite'

export default defineConfig({
  base: '/',
  server: {
    historyApiFallback: {
      rewrites: [
        { from: /^\/$/, to: '/src/landing/index.html' },
        { from: /^\/auth/, to: '/src/auth/index.html' },
        { from: /^\/app/, to: '/src/app/index.html' }
      ]
    }
  },
  plugins: [
    {
      name: 'dev-server-rewrites',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/') {
            req.url = '/src/landing/index.html';
          } else if (req.url === '/auth' || req.url === '/auth/') {
            req.url = '/src/auth/index.html';
          } else if (req.url === '/app' || req.url === '/app/') {
            req.url = '/src/app/index.html';
          }
          next();
        });
      }
    }
  ],
  build: {
    rollupOptions: {
      input: {
        landing: 'src/landing/index.html',
        auth:    'src/auth/index.html',
        app:     'src/app/index.html',
      }
    }
  }
})
