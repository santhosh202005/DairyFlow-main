import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import net from 'net';
import {defineConfig, loadEnv} from 'vite';

const checkPortAvailable = (port: number) => new Promise<boolean>((resolve) => {
  const server = net.createServer();
  server.unref();
  server.on('error', () => resolve(false));
  server.once('listening', () => {
    server.close(() => resolve(true));
  });
  server.listen(port, '127.0.0.1');
});

const findAvailablePort = async (startingPort: number, maxChecks = 10) => {
  for (let port = startingPort; port < startingPort + maxChecks; port += 1) {
    if (await checkPortAvailable(port)) {
      return port;
    }
  }
  return startingPort;
};

export default defineConfig(async ({mode}) => {
  const env = loadEnv(mode, '.', '');
  const disableHmr = process.env.DISABLE_HMR === 'true' || env.DISABLE_HMR === 'true';
  const requestedHmrPort = parseInt(process.env.VITE_HMR_PORT || env.VITE_HMR_PORT || '24678', 10);
  const hmrPort = disableHmr ? undefined : await findAvailablePort(requestedHmrPort);

  if (!disableHmr && hmrPort !== requestedHmrPort) {
    console.log(`⚠️ HMR port ${requestedHmrPort} was busy; using ${hmrPort} instead.`);
  }

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: disableHmr ? false : { port: hmrPort },
      ws: disableHmr ? undefined : ({ port: hmrPort } as any),
    },
  };
});
