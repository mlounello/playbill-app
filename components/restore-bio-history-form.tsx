"use client";

import { useFormStatus } from "react-dom";

function RestoreButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending}>{pending ? "Restoring..." : "Restore this bio"}</button>;
}

export function RestoreBioHistoryForm({ action, auditId, version, expectedBio, expectedStatus, expectedNoBio }: {
  action: (formData: FormData) => void;
  auditId: string;
  version: "before" | "after";
  expectedBio: string;
  expectedStatus: string;
  expectedNoBio: boolean;
}) {
  return (
    <form action={action} onSubmit={(event) => {
      if (!window.confirm("Replace the current bio with this version and clear 'no bio requested'? This will be recorded in history. Unsaved edits on this page will be discarded.")) {
        event.preventDefault();
      }
    }}>
      <input type="hidden" name="auditId" value={auditId} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="expectedBio" value={expectedBio} />
      <input type="hidden" name="expectedStatus" value={expectedStatus} />
      <input type="hidden" name="expectedNoBio" value={String(expectedNoBio)} />
      <RestoreButton />
    </form>
  );
}
