// Public URL prefix. Under Next.js it is `basePath` (NEXT_PUBLIC_BASE_PATH, inlined at build time); the Vite test harness has its own BASE_URL.
// Always starts and ends with a slash. Imports nothing from the app.
declare const process: { env: Record<string, string | undefined> };

const viteBase = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL;
const configured = viteBase ?? process.env.NEXT_PUBLIC_BASE_PATH ?? '/';
export const APP_BASE_PATH = `/${configured.replace(/^\/+|\/+$/g, '')}${configured.replace(/^\/+|\/+$/g, '') ? '/' : ''}`;

/** Prefix an application route or public asset with the configured mount point. */
export function appPath(path = '/'): string {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(path)) return path;
  return `${APP_BASE_PATH}${path.replace(/^\/+/, '')}`;
}
