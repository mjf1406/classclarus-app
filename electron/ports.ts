import net from "node:net";

/** Return true if `port` is free on `host`. */
export function isPortFree(port: number, host = "0.0.0.0"): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => resolve(false));
    server.listen({ port, host }, () => {
      server.close(() => resolve(true));
    });
  });
}

/** Find the first free port in [start, start+span). */
export async function findFreePort(start: number, span = 20, host = "0.0.0.0"): Promise<number> {
  for (let port = start; port < start + span; port++) {
    if (await isPortFree(port, host)) {
      return port;
    }
  }
  throw new Error(`No free port in range ${start}-${start + span - 1}`);
}
