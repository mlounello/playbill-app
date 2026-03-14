const DEFAULT_PROGRAM_ASSET_BUCKET = "program-assets";

export function getProgramAssetBucketName() {
  return process.env.SUPABASE_PROGRAM_ASSET_BUCKET?.trim() || DEFAULT_PROGRAM_ASSET_BUCKET;
}

function normalizePath(value: string) {
  return value.replace(/^\/+/, "").trim();
}

export function buildAssetProxyUrl(bucket: string, path: string) {
  const safeBucket = bucket.trim();
  const safePath = normalizePath(path);
  if (!safeBucket || !safePath) {
    return "";
  }
  return `/api/assets/object?bucket=${encodeURIComponent(safeBucket)}&path=${encodeURIComponent(safePath)}`;
}

export function isSupportedAssetUrl(value: string | null | undefined) {
  const input = String(value ?? "").trim();
  if (!input) {
    return false;
  }
  return input.startsWith("/api/assets/object?") || (input.startsWith("/") && !input.startsWith("//"));
}

export function normalizeAssetUrl(rawUrl: string | null | undefined) {
  const input = String(rawUrl ?? "").trim();
  if (!input) {
    return "";
  }
  if (input.startsWith("/api/assets/object?")) {
    return input;
  }
  if (input.startsWith("/") && !input.startsWith("//")) {
    return input;
  }

  try {
    const url = new URL(input);
    const path = url.pathname;
    const publicPrefix = "/storage/v1/object/public/";
    const signPrefix = "/storage/v1/object/sign/";
    const renderPrefix = "/storage/v1/render/image/public/";

    let storagePath = "";
    if (path.startsWith(publicPrefix)) {
      storagePath = path.slice(publicPrefix.length);
    } else if (path.startsWith(signPrefix)) {
      storagePath = path.slice(signPrefix.length);
    } else if (path.startsWith(renderPrefix)) {
      storagePath = path.slice(renderPrefix.length);
    } else {
      return input;
    }

    const parts = storagePath.split("/").filter(Boolean);
    const bucket = parts.shift() ?? "";
    const objectPath = parts.join("/");
    const proxyUrl = buildAssetProxyUrl(bucket, objectPath);
    return proxyUrl || input;
  } catch {
    return input;
  }
}
