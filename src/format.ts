const ALLOWED_TAGS = new Set([
  "B",
  "STRONG",
  "I",
  "EM",
  "U",
  "S",
  "STRIKE",
  "DEL",
  "SPAN",
  "FONT",
  "DIV",
  "P",
  "BR",
]);

const ALLOWED_STYLES = new Set([
  "font-size",
  "color",
  "font-weight",
  "font-style",
  "text-decoration",
  "text-decoration-line",
]);

export const FONT_SIZES = ["12", "14", "16", "18", "20", "24", "28", "32"];

export function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

export function plainTextFromHtml(html: string) {
  const host = document.createElement("div");
  host.innerHTML = html;
  return (host.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function sanitizeHtml(html: string) {
  const template = document.createElement("template");
  template.innerHTML = html;
  const walk = (node: Node) => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        if (!ALLOWED_TAGS.has(el.tagName)) {
          el.replaceWith(...Array.from(el.childNodes));
          continue;
        }
        for (const attr of Array.from(el.attributes)) {
          const name = attr.name.toLowerCase();
          if (name === "style") {
            const kept: string[] = [];
            for (let i = 0; i < el.style.length; i += 1) {
              const decl = el.style.item(i);
              if (decl && ALLOWED_STYLES.has(decl)) {
                kept.push(`${decl}: ${el.style.getPropertyValue(decl)}`);
              }
            }
            if (kept.length) el.setAttribute("style", kept.join("; "));
            else el.removeAttribute("style");
          } else if (
            !(el.tagName === "FONT" && (name === "color" || name === "size"))
          ) {
            el.removeAttribute(attr.name);
          }
        }
        walk(el);
      } else if (child.nodeType === Node.COMMENT_NODE) {
        child.parentNode?.removeChild(child);
      }
    }
  };
  walk(template.content);
  return template.innerHTML;
}

export function contentToHtml(content: string) {
  if (!content) return "";
  if (looksLikeHtml(content)) return sanitizeHtml(content);
  return content
    .split("\n")
    .map((line) => {
      const escaped = line
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<div>${escaped || "<br>"}</div>`;
    })
    .join("");
}

export function isEditorEmpty(editor: HTMLElement) {
  const text = (editor.textContent ?? "").replace(/\u200B/g, "").trim();
  return text.length === 0;
}

function selectionInEditor(editor: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const container =
    range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? (range.commonAncestorContainer as Node)
      : range.commonAncestorContainer.parentNode;
  if (!container || !editor.contains(container)) return null;
  return { selection, range };
}

function ensureStyleWithCss() {
  try {
    document.execCommand("styleWithCSS", false, "true");
  } catch {
    // ignore
  }
}

export function focusEditor(editor: HTMLElement) {
  editor.focus();
}

export function toggleFormat(
  editor: HTMLElement,
  command: "bold" | "italic" | "underline" | "strikeThrough",
) {
  focusEditor(editor);
  ensureStyleWithCss();
  document.execCommand(command, false);
}

export function applyForeColor(editor: HTMLElement, color: string) {
  focusEditor(editor);
  ensureStyleWithCss();
  document.execCommand("foreColor", false, color);
}

function restoreRange(editor: HTMLElement, range: Range) {
  focusEditor(editor);
  const selection = window.getSelection();
  if (!selection) return null;
  selection.removeAllRanges();
  selection.addRange(range);
  return selection;
}

export function applyFontSize(
  editor: HTMLElement,
  sizePx: string,
  savedRange?: Range | null,
) {
  if (savedRange) {
    restoreRange(editor, savedRange);
  } else {
    focusEditor(editor);
  }

  const marker = selectionInEditor(editor);
  if (!marker) return;

  const { selection, range } = marker;
  const sized = `${sizePx}px`;

  if (range.collapsed) {
    const span = document.createElement("span");
    span.style.fontSize = sized;
    span.append(document.createTextNode("\u200B"));
    range.insertNode(span);
    const next = document.createRange();
    next.setStart(span.firstChild as Text, 1);
    next.collapse(true);
    selection.removeAllRanges();
    selection.addRange(next);
    return;
  }

  // Prefer wrapping the live selection; fall back to the legacy fontSize command.
  try {
    const span = document.createElement("span");
    span.style.fontSize = sized;
    span.append(range.extractContents());
    range.insertNode(span);
    const next = document.createRange();
    next.selectNodeContents(span);
    selection.removeAllRanges();
    selection.addRange(next);
    return;
  } catch {
    // Selection crossed element boundaries — use execCommand fallback.
  }

  try {
    document.execCommand("styleWithCSS", false, "false");
  } catch {
    // ignore
  }
  document.execCommand("fontSize", false, "7");

  const fonts = Array.from(editor.querySelectorAll("font[size='7']"));
  for (const font of fonts) {
    const span = document.createElement("span");
    span.style.fontSize = sized;
    while (font.firstChild) span.append(font.firstChild);
    font.replaceWith(span);
  }

  const spans = Array.from(editor.querySelectorAll("span")).filter((el) => {
    const value = el.style.fontSize;
    return value === "xxx-large" || value === "-webkit-xxx-large";
  });
  for (const span of spans) {
    span.style.fontSize = sized;
  }
}

export function saveEditorRange(editor: HTMLElement): Range | null {
  const marker = selectionInEditor(editor);
  return marker ? marker.range.cloneRange() : null;
}

function nearestStyle(
  node: Node | null,
  editor: HTMLElement,
): CSSStyleDeclaration | null {
  let current =
    node?.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node?.parentElement ?? null;
  while (current && current !== editor) {
    if (current instanceof HTMLElement) {
      return window.getComputedStyle(current);
    }
    current = current.parentElement;
  }
  return window.getComputedStyle(editor);
}

function rgbToHex(color: string) {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) {
    if (color.startsWith("#") && (color.length === 7 || color.length === 4)) {
      return color.length === 4
        ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
        : color;
    }
    return "#2a2418";
  }
  const toHex = (n: string) => Number(n).toString(16).padStart(2, "0");
  return `#${toHex(match[1])}${toHex(match[2])}${toHex(match[3])}`;
}

function closestFontSize(px: number) {
  let best = FONT_SIZES[2];
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const size of FONT_SIZES) {
    const diff = Math.abs(Number(size) - px);
    if (diff < bestDiff) {
      best = size;
      bestDiff = diff;
    }
  }
  return best;
}

export type FormatState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  color: string;
  fontSize: string;
};

export function readFormatState(editor: HTMLElement): FormatState {
  const marker = selectionInEditor(editor);
  const style = nearestStyle(
    marker?.range.startContainer ?? editor,
    editor,
  );
  const deco = `${style?.textDecorationLine ?? ""} ${style?.textDecoration ?? ""}`;
  return {
    bold: document.queryCommandState("bold"),
    italic: document.queryCommandState("italic"),
    underline:
      document.queryCommandState("underline") || /\bunderline\b/.test(deco),
    strike:
      document.queryCommandState("strikeThrough") ||
      /\bline-through\b/.test(deco),
    color: rgbToHex(style?.color ?? "#2a2418"),
    fontSize: closestFontSize(Number.parseFloat(style?.fontSize ?? "16") || 16),
  };
}
