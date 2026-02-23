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

  const fileToImage = (file: File) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Could not read image."));
        image.src = String(reader.result ?? "");
      };
      reader.onerror = () => reject(new Error("Could not read file."));
      reader.readAsDataURL(file);
    });

  const optimizeHeadshot = async (file: File) => {
    const image = await fileToImage(file);
    const size = Math.min(image.naturalWidth, image.naturalHeight);
    const offsetX = Math.floor((image.naturalWidth - size) / 2);
    const offsetY = Math.floor((image.naturalHeight - size) / 2);

    const targetSize = 1200;
    const canvas = document.createElement("canvas");
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas is unavailable in this browser.");
    }

    ctx.drawImage(image, offsetX, offsetY, size, size, 0, 0, targetSize, targetSize);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((value) => resolve(value), "image/jpeg", 0.88);
    });
    if (!blob) {
      throw new Error("Could not optimize image.");
    }

    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  };

  const onFileChange = async (file: File | null) => {
    if (!file) return;
    setError("");
    setPending(true);
    try {
      const optimizedFile = await optimizeHeadshot(file);
      const formData = new FormData();
      formData.set("file", optimizedFile);
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
      <div style={{ fontSize: "0.82rem", opacity: 0.82 }}>
        Images are auto-cropped to square and optimized before upload.
      </div>

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
