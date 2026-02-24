"use client";

import { type ChangeEvent, useState } from "react";

type Props = {
  programSlug: string;
  showId?: string;
  assetType: "poster" | "actf" | "photo" | "custom";
  targetInputId?: string;
  label: string;
};

export function ProgramImageUpload({ programSlug, showId, assetType, targetInputId, label }: Props) {
  const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
  const MAX_DIMENSION = 2500;
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const optimizeImageFile = async (file: File) => {
    const sourceUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Could not read image."));
        img.src = sourceUrl;
      });

      const largestSide = Math.max(image.width, image.height);
      const scale = largestSide > MAX_DIMENSION ? MAX_DIMENSION / largestSide : 1;
      const targetWidth = Math.max(1, Math.round(image.width * scale));
      const targetHeight = Math.max(1, Math.round(image.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return file;
      }

      // Preserve readable output when source has transparency.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

      const qualitySteps = [0.9, 0.82, 0.74, 0.66, 0.58];
      for (const quality of qualitySteps) {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
        if (!blob) {
          continue;
        }
        if (blob.size <= MAX_UPLOAD_BYTES) {
          const nextName = `${file.name.replace(/\.[^.]+$/, "")}.jpg`;
          return new File([blob], nextName, { type: "image/jpeg" });
        }
      }

      const fallback = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.5));
      if (!fallback) {
        return file;
      }
      const fallbackName = `${file.name.replace(/\.[^.]+$/, "")}.jpg`;
      return new File([fallback], fallbackName, { type: "image/jpeg" });
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  };

  const onChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      return;
    }
    setError("");
    setStatus("Optimizing image...");
    setIsUploading(true);
    try {
      const file = await optimizeImageFile(selectedFile);
      if (file.size > MAX_UPLOAD_BYTES) {
        setError("Image is still too large after optimization. Try a smaller source file.");
        return;
      }

      setStatus("Uploading...");
      const formData = new FormData();
      formData.set("file", file);
      formData.set("programSlug", programSlug);
      if (showId) {
        formData.set("showId", showId);
      }
      formData.set("assetType", assetType);
      const response = await fetch("/api/assets/upload-program", {
        method: "POST",
        body: formData
      });
      const raw = await response.text();
      let payload: { ok?: boolean; url?: string; error?: string } = {};
      try {
        payload = JSON.parse(raw) as { ok?: boolean; url?: string; error?: string };
      } catch {
        payload = { ok: false, error: raw.slice(0, 200) || `Upload failed (${response.status}).` };
      }

      if (!response.ok || !payload.ok || !payload.url) {
        setError(payload.error || `Upload failed (${response.status}).`);
        return;
      }
      setUploadedUrl(payload.url);
      setStatus("");

      if (targetInputId) {
        const input = document.getElementById(targetInputId) as HTMLInputElement | null;
        if (input) {
          input.value = payload.url;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    } catch {
      setError("Upload failed.");
    } finally {
      setIsUploading(false);
      setStatus("");
      event.target.value = "";
    }
  };

  return (
    <div className="stack-sm">
      <label style={{ fontWeight: 600 }}>
        {label}
        <input type="file" accept="image/*" onChange={onChange} disabled={isUploading} />
      </label>
      {isUploading ? <div className="meta-text">{status || "Uploading..."}</div> : null}
      {uploadedUrl ? (
        <div className="meta-text">
          Uploaded URL: <a href={uploadedUrl} target="_blank" rel="noreferrer">{uploadedUrl}</a>
        </div>
      ) : null}
      {error ? <div className="meta-text" style={{ color: "#8f1f1f" }}>{error}</div> : null}
    </div>
  );
}
