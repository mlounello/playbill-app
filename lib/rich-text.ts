const allowedTags = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "ul",
  "ol",
  "li",
  "a",
  "blockquote",
  "h3",
  "h4",
  "span",
  "div",
  "section"
]);

const allowedClassNames = new Set([
  "playbill-title",
  "section-title",
  "billing-sheet",
  "billing-section",
  "billing-section-title",
  "billing-list",
  "billing-item",
  "billing-left",
  "billing-leader",
  "billing-right",
  "bio-body",
  "bio-name",
  "bio-role-inline",
  "stacked-sections",
  "stacked-section",
  "stacked-section-title",
  "season-calendar",
  "season-calendar-title",
  "season-calendar-list",
  "season-calendar-item",
  "season-date",
  "season-date-month",
  "season-date-day",
  "season-body",
  "season-event-title",
  "season-event-meta",
  "season-bg-accent",
  "season-bg-highlight"
]);

function sanitizeAttributes(tagName: string, attrs: string) {
  const classMatch = attrs.match(/class\s*=\s*(["'])(.*?)\1/i);
  const rawClasses = classMatch?.[2] ?? "";
  const classTokens = rawClasses
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => allowedClassNames.has(token));
  const classAttr = classTokens.length > 0 ? ` class="${classTokens.join(" ")}"` : "";

  if (tagName !== "a") {
    return classAttr;
  }

  const hrefMatch = attrs.match(/href\s*=\s*(["'])(.*?)\1/i);
  if (!hrefMatch) {
    return classAttr;
  }

  const href = hrefMatch[2].trim();
  if (!/^https?:\/\//i.test(href) && !/^mailto:/i.test(href)) {
    return classAttr;
  }

  return `${classAttr} href="${href}" target="_blank" rel="noopener noreferrer"`;
}

function escapeText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function plainTextLineBreaksToHtml(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph.split(/\n/).map((line) => escapeText(line.trim())).join("<br>")}</p>`)
    .join("");
}

function shouldPreserveStructuredHtml(value: string) {
  return /class\s*=\s*(["'])[^"']*(billing-|stacked-|season-|bio-|photo-|actf-)[^"']*\1/i.test(value);
}

function stripInlineEditorSpans(value: string) {
  return value.replace(/<span\b[^>]*>/gi, "").replace(/<\/span>/gi, "");
}

function fragmentHasContent(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim().length > 0;
}

function editorHtmlToParagraphs(value: string) {
  if (shouldPreserveStructuredHtml(value) || !/(<div\b|<p\b|<br\s*\/?>)/i.test(value)) {
    return value;
  }

  const normalized = stripInlineEditorSpans(value)
    .replace(/\r\n?/g, "\n")
    .replace(/<div\b[^>]*>\s*(?:<br\s*\/?>|&nbsp;|\s)*<\/div>/gi, "\n\n")
    .replace(/<p\b[^>]*>/gi, "\n\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<div\b[^>]*>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n\n")
    .replace(/(?:<br\s*\/?>\s*){2,}/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n");

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(fragmentHasContent)
    .map((paragraph) => `<p>${paragraph.replace(/\n+/g, "<br>")}</p>`);

  return paragraphs.length > 1 ? paragraphs.join("") : value;
}

export function sanitizeRichText(input: string | undefined) {
  if (!input) {
    return "";
  }

  const restoredEditorTags = input.replace(
    /&lt;(\/?(?:p|br|strong|b|em|i|u|ul|ol|li|a|blockquote|h3|h4|span|div|section)(?:\s+[^&]*?)?)&gt;/gi,
    "<$1>"
  );

  const withoutDangerousBlocks = restoredEditorTags
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/on\w+\s*=\s*(["'])[\s\S]*?\1/gi, "")
    .replace(/javascript:/gi, "");
  const normalizedInput =
    !/<\/?[a-z][\s\S]*>/i.test(withoutDangerousBlocks) && /[\r\n]/.test(withoutDangerousBlocks)
      ? plainTextLineBreaksToHtml(withoutDangerousBlocks)
      : editorHtmlToParagraphs(withoutDangerousBlocks);

  const sanitized = normalizedInput.replace(/<\/?([a-z0-9-]+)([^>]*)>/gi, (full, tag, attrs) => {
    const tagName = String(tag).toLowerCase();
    const isClosing = full.startsWith("</");

    if (!allowedTags.has(tagName)) {
      return "";
    }

    if (isClosing) {
      return `</${tagName}>`;
    }

    const cleanAttrs = sanitizeAttributes(tagName, String(attrs));
    return `<${tagName}${cleanAttrs}>`;
  });

  return sanitized.trim();
}

export function richTextHasContent(input: string | undefined) {
  if (!input) {
    return false;
  }

  const textOnly = input
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return textOnly.length > 0;
}
