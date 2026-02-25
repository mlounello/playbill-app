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

export function sanitizeRichText(input: string | undefined) {
  if (!input) {
    return "";
  }

  const withoutDangerousBlocks = input
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/on\w+\s*=\s*(["'])[\s\S]*?\1/gi, "")
    .replace(/javascript:/gi, "");

  const sanitized = withoutDangerousBlocks.replace(/<\/?([a-z0-9-]+)([^>]*)>/gi, (full, tag, attrs) => {
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
