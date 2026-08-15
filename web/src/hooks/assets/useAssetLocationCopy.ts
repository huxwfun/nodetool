import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "../../trpc/client";
import type { Asset } from "../../stores/ApiTypes";

const COPIED_FEEDBACK_MS = 2000;

export type AssetLocationKind = "path" | "url";

/**
 * Copy a reference to the asset that something *else* can open — a coding
 * agent, a terminal, a chat message — rather than the bytes themselves.
 *
 * The server's own file path is the useful answer when it exists, because a
 * local tool can read it directly. It does not always exist: a remote storage
 * backend keeps the bytes off this disk, and a folder has none. The absolute
 * URL is the fallback, and the caller is told which of the two it will get so
 * the button can say so before it is pressed.
 */
export function useAssetLocationCopy(params: {
  asset?: Asset;
  url?: string;
  enabled?: boolean;
}) {
  const { asset, url, enabled = true } = params;
  const assetId = asset?.id;
  const isFolder = asset?.content_type === "folder";

  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolved up front so the button can name what it copies. It is one
  // existence check on the server, and it keeps the click itself instant.
  const { data } = trpc.assets.localPath.useQuery(
    { id: assetId ?? "" },
    { enabled: enabled && !!assetId && !isFolder, staleTime: 60_000 }
  );

  // Prefer the asset's own URL over the `url` prop, which in a gallery stays
  // pinned to whatever the viewer opened with while the asset changes.
  const rawUrl = asset?.get_url || url;
  let absoluteUrl: string | null = null;
  if (rawUrl) {
    try {
      absoluteUrl = new URL(rawUrl, window.location.origin).href;
    } catch {
      // A malformed or data: URL is still worth copying verbatim.
      absoluteUrl = rawUrl;
    }
  }

  const location = data?.path ?? absoluteUrl;
  const kind: AssetLocationKind | null = location
    ? data?.path
      ? "path"
      : "url"
    : null;

  useEffect(
    () => () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    },
    []
  );

  const copyLocation = useCallback(async () => {
    if (!location) {
      return;
    }
    try {
      await navigator.clipboard.writeText(location);
      setCopied(true);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch (error) {
      console.error("Failed to copy asset location:", error);
    }
  }, [location]);

  return { location, kind, copied, copyLocation };
}

export default useAssetLocationCopy;
