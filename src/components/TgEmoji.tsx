import React, { useState } from "react";

type Props = {
  id: string;
  size?: number;
  fallback?: string;
};

export default function TgEmoji({ id, size = 20, fallback = "🙂" }: Props) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <span
        style={{
          fontSize: size,
          lineHeight: 1,
        }}
      >
        {fallback}
      </span>
    );
  }

  return (
    <video
      src={`https://telegram.org/emoji/${id}`}
      autoPlay
      loop
      muted
      playsInline
      onError={() => setError(true)}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        background: "transparent",
        display: "inline-block",
      }}
    />
  );
}