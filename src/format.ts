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

function isZwspOnly(node: Node) {
  return (node.textContent ?? "").replace(/\u200B/g, "").trim() === "";
}

function hasExplicitFontSize(el: HTMLElement) {
  if (el.style.fontSize) return true;
  if (el.tagName === "FONT" && el.hasAttribute("size")) return true;
  return Array.from(el.classList).some((name) => name.startsWith("fs-"));
}

function removeExplicitFontSize(el: HTMLElement) {
  if (el.style.fontSize) el.style.removeProperty("font-size");
  if (el.tagName === "FONT") el.removeAttribute("size");
  for (const name of Array.from(el.classList)) {
    if (name.startsWith("fs-")) el.classList.remove(name);
  }
  if (el.getAttribute("style") === "") el.removeAttribute("style");
  if (el.classList.length === 0) el.removeAttribute("class");
}

function clearInlineFontSize(root: Node) {
  const elements: HTMLElement[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      elements.push(node as HTMLElement);
      for (const child of Array.from(node.childNodes)) walk(child);
    }
  };
  walk(root);

  for (const el of elements) removeExplicitFontSize(el);

  // Unwrap spans/fonts that only existed to carry font-size.
  for (const el of elements.slice().reverse()) {
    if (!el.isConnected) continue;
    const styleEmpty = !el.getAttribute("style");
    const classEmpty = !el.getAttribute("class");
    const isFont = el.tagName === "FONT" && !el.hasAttribute("color");
    const isBareSpan =
      el.tagName === "SPAN" &&
      styleEmpty &&
      classEmpty &&
      el.attributes.length === 0;
    if (isFont || isBareSpan) {
      el.replaceWith(...Array.from(el.childNodes));
    }
  }
}

function rangeCoversNodeContents(range: Range, el: HTMLElement) {
  const full = document.createRange();
  full.selectNodeContents(el);
  return (
    range.compareBoundaryPoints(Range.START_TO_START, full) <= 0 &&
    range.compareBoundaryPoints(Range.END_TO_END, full) >= 0
  );
}

/** If the selection fully covers a sized wrapper, take the whole wrapper so no empty large shell remains. */
function liftRangeToSizedWrappers(range: Range, editor: HTMLElement) {
  let best: HTMLElement | null = null;
  let node: Node | null =
    range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;

  while (node && node !== editor) {
    if (node instanceof HTMLElement && hasExplicitFontSize(node)) {
      if (rangeCoversNodeContents(range, node)) best = node;
    }
    node = node.parentElement;
  }

  if (best) range.selectNode(best);
}

/** Outer sized wrappers leave a tall strut even when inner text is smaller — strip them. */
export function normalizeFontSizeTree(editor: HTMLElement, keep?: HTMLElement | null) {
  let dirty = true;
  while (dirty) {
    dirty = false;
    const sized = Array.from(
      editor.querySelectorAll<HTMLElement>("span, font, div, p, b, strong, i, em, u, s, strike, del"),
    ).filter(hasExplicitFontSize);

    for (const el of sized) {
      // Never strip the active caret/size span itself.
      if (keep && el === keep) continue;
      const nested = sized.find((other) => other !== el && el.contains(other));
      if (nested) {
        removeExplicitFontSize(el);
        dirty = true;
      }
    }
  }

  for (const span of Array.from(editor.querySelectorAll("span[data-caret-size]"))) {
    if (keep && span === keep) continue;
    if (isZwspOnly(span)) span.remove();
    else span.removeAttribute("data-caret-size");
  }

  for (const el of Array.from(editor.querySelectorAll("span, font"))) {
    if (keep && (el === keep || keep.contains(el))) continue;
    if (!isZwspOnly(el)) continue;
    if (el.querySelector("br") && el.childNodes.length === 1) continue;
    el.remove();
  }

  for (const el of Array.from(editor.querySelectorAll("span, font")).reverse()) {
    if (!el.isConnected) continue;
    if (keep && el === keep) continue;
    const styleEmpty = !el.getAttribute("style");
    const classEmpty = !el.getAttribute("class");
    const isFont = el.tagName === "FONT" && !el.hasAttribute("color");
    const isBareSpan =
      el.tagName === "SPAN" &&
      styleEmpty &&
      classEmpty &&
      !el.hasAttribute("data-caret-size") &&
      el.attributes.length === 0;
    if (isFont || isBareSpan) {
      el.replaceWith(...Array.from(el.childNodes));
    }
  }
}

function placeCaretIn(span: HTMLElement, selection: Selection) {
  const next = document.createRange();
  if (span.firstChild?.nodeType === Node.TEXT_NODE) {
    const text = span.firstChild as Text;
    next.setStart(text, Math.min(1, text.data.length));
  } else {
    next.selectNodeContents(span);
  }
  next.collapse(true);
  selection.removeAllRanges();
  selection.addRange(next);
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
    normalizeFontSizeTree(editor);
    // If caret is already inside a sized span that only holds the caret marker / this run,
    // reuse it instead of nesting.
    const parent = range.startContainer.parentElement;
    if (
      parent &&
      editor.contains(parent) &&
      parent.tagName === "SPAN" &&
      hasExplicitFontSize(parent) &&
      isZwspOnly(parent)
    ) {
      parent.style.fontSize = sized;
      parent.dataset.caretSize = "1";
      placeCaretIn(parent, selection);
      normalizeFontSizeTree(editor, parent);
      return;
    }

    const span = document.createElement("span");
    span.style.fontSize = sized;
    span.dataset.caretSize = "1";
    span.append(document.createTextNode("\u200B"));
    range.insertNode(span);
    // Move out of any leftover empty sized ancestors and strip them.
    let ancestor = span.parentElement;
    while (ancestor && ancestor !== editor) {
      const nextAncestor = ancestor.parentElement;
      if (
        (ancestor.tagName === "SPAN" || ancestor.tagName === "FONT") &&
        hasExplicitFontSize(ancestor)
      ) {
        removeExplicitFontSize(ancestor);
      }
      ancestor = nextAncestor;
    }
    placeCaretIn(span, selection);
    normalizeFontSizeTree(editor, span);
    return;
  }

  liftRangeToSizedWrappers(range, editor);

  try {
    const content = range.extractContents();
    clearInlineFontSize(content);

    // extractContents often leaves an empty large-size shell behind — remove it.
    const shell =
      range.startContainer.nodeType === Node.ELEMENT_NODE
        ? (range.startContainer as HTMLElement)
        : range.startContainer.parentElement;
    if (
      shell &&
      editor.contains(shell) &&
      (shell.tagName === "SPAN" || shell.tagName === "FONT") &&
      isZwspOnly(shell)
    ) {
      const parent = shell.parentElement;
      if (parent) {
        range.setStartBefore(shell);
        range.collapse(true);
      }
      shell.remove();
    }

    const span = document.createElement("span");
    span.style.fontSize = sized;
    span.append(content);
    range.insertNode(span);

    let ancestor = span.parentElement;
    while (ancestor && ancestor !== editor) {
      const nextAncestor = ancestor.parentElement;
      if (hasExplicitFontSize(ancestor)) removeExplicitFontSize(ancestor);
      ancestor = nextAncestor;
    }

    normalizeFontSizeTree(editor);
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
    clearInlineFontSize(font);
    const span = document.createElement("span");
    span.style.fontSize = sized;
    while (font.firstChild) span.append(font.firstChild);
    font.replaceWith(span);
  }
  normalizeFontSizeTree(editor);
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
