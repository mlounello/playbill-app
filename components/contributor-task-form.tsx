"use client";

import { FormEvent, useMemo, useState } from "react";
import { HeadshotUploadField } from "@/components/headshot-upload-field";
import { RichTextField } from "@/components/rich-text-field";

function stripRichTextToPlain(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|ul|ol|h1|h2|h3|h4|h5|h6)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  showId: string;
  personId: string;
  submissionLabel: string;
  bioCharLimit: number;
  isBioTask: boolean;
  hasNoBio: boolean;
  initialBio: string;
  placeholder: string;
  headshotUrl: string;
  isReadOnly: boolean;
};

export function ContributorTaskForm({
  action,
  showId,
  personId,
  submissionLabel,
  bioCharLimit,
  isBioTask,
  hasNoBio,
  initialBio,
  placeholder,
  headshotUrl,
  isReadOnly
}: Props) {
  const [skipBio, setSkipBio] = useState(hasNoBio);
  const initialCharCount = stripRichTextToPlain(initialBio).length;
  const [bioCharCount, setBioCharCount] = useState(initialCharCount);
  const [bioOverLimit, setBioOverLimit] = useState(initialCharCount > bioCharLimit);
  const [clientError, setClientError] = useState("");

  const submissionBlocked = isBioTask && !skipBio && bioOverLimit;
  const counterToneClass = useMemo(() => {
    if (!isBioTask) return "";
    if (skipBio) return "rich-counter-muted";
    if (bioOverLimit) return "rich-counter-danger";
    if (bioCharCount > bioCharLimit * 0.9) return "rich-counter-warning";
    return "";
  }, [bioCharCount, bioCharLimit, bioOverLimit, isBioTask, skipBio]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (submissionBlocked) {
      event.preventDefault();
      setClientError(`Bio exceeds the ${bioCharLimit} character limit. Please shorten it before submitting.`);
      return;
    }
    setClientError("");
  };

  return (
    <form action={action} className="card stack-md" onSubmit={handleSubmit}>
      <div className="stack-sm">
        <strong>Edit Your {submissionLabel}</strong>
        <p className="section-note">
          Use the editor below, then save a draft or submit when you are ready.
        </p>
      </div>
      <RichTextField
        name="bio"
        label={submissionLabel}
        required={false}
        initialValue={initialBio}
        placeholder={placeholder}
        counter={
          isBioTask
            ? {
                mode: "characters",
                limit: bioCharLimit,
                disabled: skipBio,
                toneClassName: counterToneClass,
                helperText: skipBio ? "No bio selected, so the character limit does not apply." : undefined
              }
            : undefined
        }
        onStatsChange={({ charCount }) => {
          setBioCharCount(charCount);
          setBioOverLimit(charCount > bioCharLimit);
          if (charCount <= bioCharLimit) {
            setClientError("");
          }
        }}
      />
      {isBioTask ? (
        <label className="checkbox-inline">
          <input
            type="checkbox"
            name="skipBio"
            defaultChecked={hasNoBio}
            disabled={isReadOnly}
            onChange={(event) => {
              setSkipBio(event.target.checked);
              if (event.target.checked) {
                setClientError("");
              }
            }}
          />
          <span>I prefer not to include a bio.</span>
        </label>
      ) : null}

      {isBioTask ? (
        <HeadshotUploadField
          showId={showId}
          personId={personId}
          initialUrl={headshotUrl}
          disabled={isReadOnly}
        />
      ) : null}

      {clientError ? <div className="meta-text danger-title">{clientError}</div> : null}

      {isReadOnly ? (
        <p className="section-note">This task is read-only because it has already been approved or locked.</p>
      ) : (
        <div className="top-actions">
          <button type="submit" name="intent" value="save" disabled={submissionBlocked}>
            Save Draft
          </button>
          <button type="submit" name="intent" value="submit" disabled={submissionBlocked}>
            Submit for Review
          </button>
        </div>
      )}
    </form>
  );
}
