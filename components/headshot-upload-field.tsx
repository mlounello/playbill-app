"use client";

import { useState } from "react";

type Props = {
  showId: string;
  personId: string;
  initialUrl?: string;
  disabled?: boolean;
};

export function HeadshotUploadField({ showId, personId, initialUrl = "", disabled = false }: Props) {
  const [url, setUrl] = useState(initialUrl);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const onFileChange = async (file: File | null) => {
    if (!file) return;
    setError("");
    setPending(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("showId", showId);
      formData.set("personId", personId);
      formData.set("assetType", "headshot");

      const response = await fetch("/api/assets/upload", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json()) as { ok: boolean; url?: string; error?: string };
      if (!response.ok || !payload.ok || !payload.url) {
        throw new Error(payload.error || "Upload failed.");
      }
      setUrl(payload.url);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid" style={{ gap: "0.45rem" }}>
      <input type="hidden" name="headshotUrl" value={url} readOnly />
      <label>
        Upload headshot
        <input
          type="file"
          accept="image/*"
          disabled={disabled || pending}
          onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
        />
      </label>

      <label>
        Or paste image URL
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://..."
          disabled={disabled || pending}
        />
      </label>

      {pending ? <div style={{ fontSize: "0.88rem" }}>Uploading...</div> : null}
      {error ? <div style={{ color: "#8f1f1f", fontSize: "0.88rem" }}>{error}</div> : null}
      {url ? (
        <div className="grid" style={{ gap: "0.35rem" }}>
          <img
            src={url}
            alt="Headshot preview"
            style={{ width: "160px", height: "160px", objectFit: "cover", border: "1px solid #d8d2c2", borderRadius: 8 }}
          />
          <button type="button" onClick={() => setUrl("")} disabled={disabled || pending}>
            Clear image
          </button>
        </div>
      ) : null}
    </div>
  );
}
