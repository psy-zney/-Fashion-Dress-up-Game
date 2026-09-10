const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const DEPLOY_VERSION = process.env.NEXT_PUBLIC_DEPLOY_VERSION || "development";

export function publicAsset(path: string, version = DEPLOY_VERSION) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const separator = normalizedPath.includes("?") ? "&" : "?";
  return `${basePath}${normalizedPath}${separator}v=${encodeURIComponent(version)}`;
}
