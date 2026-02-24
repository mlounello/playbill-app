"use client";

import { type ChangeEvent, useState } from "react";

type Props = {
  programSlug: string;
  assetType: "poster" | "actf" | "photo" | "custom";
  targetInputId?: string;
  label: string;
};

export function ProgramImageUpload({ programSlug, assetType, targetInputId, label }: Props) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [error, setError] = useState("");

  const onChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setError("");
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("programSlug", programSlug);
      formData.set("assetType", assetType);
      const response = await fetch("/api/assets/upload-program", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json()) as { ok?: boolean; url?: string; error?: string };
      if (!response.ok || !payload.ok || !payload.url) {
        setError(payload.error || "Upload failed.");
        return;
      }
      setUploadedUrl(payload.url);

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
      event.target.value = "";
    }
  };

  return (
    <div className="stack-sm">
      <label style={{ fontWeight: 600 }}>
        {label}
        <input type="file" accept="image/*" onChange={onChange} disabled={isUploading} />
      </label>
      {isUploading ? <div className="meta-text">Uploading...</div> : null}
      {uploadedUrl ? (
        <div className="meta-text">
          Uploaded URL: <a href={uploadedUrl} target="_blank" rel="noreferrer">{uploadedUrl}</a>
        </div>
      ) : null}
      {error ? <div className="meta-text" style={{ color: "#8f1f1f" }}>{error}</div> : null}
    </div>
  );
}
