import React, { useEffect, useState } from "react";
// Global client-side cache
const emojiUrlCache = new Map<string, string>();
const pendingRequests = new Map<string, Promise<string | null>>();
async function fetchEmojiUrl(id: string): Promise<string | null> {
  // Check cache
  if (emojiUrlCache.has(id)) {
    return emojiUrlCache.get(id)!;
  }
  // Deduplicate in-flight requests
  if (pendingRequests.has(id)) {
    return pendingRequests.get(id)!;
  }
  const promise = (async () => {
    try {
      // Custom emoji fetching is not supported in this version
      return null;
    } catch (err) {
      console.warn("Emoji fetch error:", err);
      return null;
    } finally {
      pendingRequests.delete(id);
    }
  })();
  pendingRequests.set(id, promise);
  return promise;
}
interface TgEmojiProps {
  id: string;
  size?: number;
  fallback?: string;
}
export default function TgEmoji({ id, size = 20, fallback = "⭐" }: TgEmojiProps) {
  const [url, setUrl] = useState<string | null>(emojiUrlCache.get(id) || null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (url) return;
    fetchEmojiUrl(id).then((result) => {
      if (result) {
        setUrl(result);
      } else {
        setFailed(true);
      }
    });
  }, [id, url]);
  if (failed || !url) {
    return <span style={{ fontSize: size * 0.8, lineHeight: 1 }}>{fallback}</span>;
  }
  // Telegram sticker thumbnails are usually WebP images
  return (
    <img
      src={url}
      alt="emoji"
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        display: "inline-block",
        verticalAlign: "middle",
      }}
      onError={() => setFailed(true)}
    />
  );
}