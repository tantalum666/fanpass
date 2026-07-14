import { existsSync } from "node:fs";
import path from "node:path";

export interface StaticFileResult {
  filePath: string;
  cacheControl: string;
}

export function resolveStaticFile(
  publicDirectory: string,
  pathname: string,
): StaticFileResult | null {
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  if (decodedPath.includes("\0")) return null;

  const relativePath =
    decodedPath === "/" ? "index.html" : decodedPath.slice(1);
  const filePath = safeResolve(publicDirectory, relativePath);
  if (filePath && existsSync(filePath)) {
    return {
      filePath,
      cacheControl: isHashedAsset(filePath)
        ? "public, max-age=31536000, immutable"
        : "no-store",
    };
  }

  if (path.extname(relativePath)) return null;

  const indexPath = safeResolve(publicDirectory, "index.html");
  return indexPath && existsSync(indexPath)
    ? { filePath: indexPath, cacheControl: "no-store" }
    : null;
}

export function contentType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  return (
    {
      ".css": "text/css; charset=utf-8",
      ".html": "text/html; charset=utf-8",
      ".ico": "image/x-icon",
      ".jpeg": "image/jpeg",
      ".jpg": "image/jpeg",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".svg": "image/svg+xml",
      ".webp": "image/webp",
      ".woff": "font/woff",
      ".woff2": "font/woff2",
    }[extension] ?? "application/octet-stream"
  );
}

function safeResolve(publicDirectory: string, relativePath: string) {
  const publicRoot = path.resolve(publicDirectory);
  const resolved = path.resolve(publicRoot, relativePath);
  return resolved === publicRoot ||
    resolved.startsWith(`${publicRoot}${path.sep}`)
    ? resolved
    : null;
}

function isHashedAsset(filePath: string) {
  return (
    filePath.includes(`${path.sep}assets${path.sep}`) &&
    /-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/.test(filePath)
  );
}
