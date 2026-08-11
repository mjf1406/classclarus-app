import http from "node:http";
import fs from "node:fs";
import path from "node:path";

export type StaticEnv = {
  VITE_CONVEX_URL: string;
  VITE_CONVEX_SITE_URL: string;
  VITE_AUTH_PASSWORD_ENABLED: string;
  VITE_CLASS_PRESENCE_ENABLED: string;
  VITE_SELF_HOSTED: string;
};

export type StaticServer = {
  server: http.Server;
  port: number;
  close: () => Promise<void>;
};

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".map": "application/json",
};

function selfHostEnvScript(env: StaticEnv): string {
  return `window.__SELF_HOST_ENV__ = ${JSON.stringify(env)};\n`;
}

/**
 * Serve the Vite build on 0.0.0.0 so LAN students can connect.
 * `/self-host-env.js` is generated live (LAN IP / ports may change).
 */
export async function listenStaticServer(options: {
  rootDir: string;
  port: number;
  getEnv: () => StaticEnv;
}): Promise<StaticServer> {
  const { rootDir, port, getEnv } = options;
  const root = path.normalize(rootDir);

  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (url.pathname === "/self-host-env.js") {
        const body = selfHostEnvScript(getEnv());
        res.writeHead(200, {
          "Content-Type": "text/javascript; charset=utf-8",
          "Cache-Control": "no-store",
        });
        res.end(body);
        return;
      }

      let rel = decodeURIComponent(url.pathname);
      if (rel === "/") rel = "/index.html";
      const filePath = path.normalize(path.join(root, rel));
      if (!filePath.startsWith(root)) {
        res.writeHead(403).end("Forbidden");
        return;
      }

      const tryPath =
        fs.existsSync(filePath) && fs.statSync(filePath).isFile()
          ? filePath
          : path.join(root, "index.html");

      if (!fs.existsSync(tryPath)) {
        res.writeHead(404).end("Not found");
        return;
      }

      const ext = path.extname(tryPath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=86400",
      });
      fs.createReadStream(tryPath).pipe(res);
    } catch {
      res.writeHead(500).end("Server error");
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "0.0.0.0", () => resolve());
  });

  return {
    server,
    port,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
