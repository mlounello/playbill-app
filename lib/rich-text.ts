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
  "span"
]);

function sanitizeAttributes(tagName: string, attrs: string) {
  if (tagName !== "a") {
    return "";
  }

  const hrefMatch = attrs.match(/href\s*=\s*(["'])(.*?)\1/i);
  if (!hrefMatch) {
    return "";
  }

  const href = hrefMatch[2].trim();
  if (!/^https?:\/\//i.test(href) && !/^mailto:/i.test(href)) {
    return "";
  }

  return ` href="${href}" target="_blank" rel="noopener noreferrer"`;
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
