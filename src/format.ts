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
  "UL",
  "OL",
  "LI",
  "INPUT",
  "H1",
  "H2",
  "H3",
  "H4",
]);

const ALLOWED_STYLES = new Set([
  "font-size",
  "color",
  "font-weight",
  "font-style",
  "text-decoration",
  "text-decoration-line",
]);

const ALLOWED_CLASSES = new Set([
  "todo-list",
  "todo-item",
  "todo-text",
  "todo-check",
  "is-checked",
]);

export const TEXT_STYLES = [
  { id: "body", label: "正文", tag: "div" },
  { id: "h1", label: "标题 1", tag: "h1" },
  { id: "h2", label: "标题 2", tag: "h2" },
  { id: "h3", label: "标题 3", tag: "h3" },
  { id: "h4", label: "标题 4", tag: "h4" },
] as const;

export type TextStyleId = (typeof TEXT_STYLES)[number]["id"];

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
        // Legacy real checkboxes are migrated to decorative markers later.
        if (el.tagName === "INPUT") {
          const type = (el.getAttribute("type") || "").toLowerCase();
          if (type !== "checkbox") {
            el.remove();
            continue;
          }
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
          } else if (name === "class") {
            const kept = attr.value
              .split(/\s+/)
              .filter(
                (item) =>
                  ALLOWED_CLASSES.has(item) || item.startsWith("fs-"),
              );
            if (kept.length) el.setAttribute("class", kept.join(" "));
            else el.removeAttribute("class");
          } else if (
            (el.tagName === "FONT" && (name === "color" || name === "size")) ||
            (el.tagName === "INPUT" &&
              (name === "type" || name === "checked")) ||
            (name === "contenteditable" &&
              (el.tagName === "INPUT" ||
                el.classList.contains("todo-check"))) ||
            (name === "role" && el.classList.contains("todo-check")) ||
            (name === "aria-checked" && el.classList.contains("todo-check"))
          ) {
            // keep
          } else {
            el.removeAttribute(attr.name);
          }
        }

        if (el.classList.contains("todo-check")) {
          el.setAttribute("contenteditable", "false");
          el.setAttribute("role", "checkbox");
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

function isBlankBlock(node: Node) {
  if (!(node instanceof HTMLElement)) {
    return (node.textContent ?? "").replace(/\u200B/g, "").trim() === "";
  }
  if (node.matches("ul, ol")) return false;
  const text = (node.textContent ?? "").replace(/\u200B/g, "").trim();
  if (text.length > 0) return false;
  if (node.querySelector("img, ul, ol, input, .todo-check")) return false;
  return true;
}

export function isEditorEmpty(editor: HTMLElement) {
  const text = (editor.textContent ?? "").replace(/\u200B/g, "").trim();
  if (text.length > 0) return false;
  // Structural content should hide the placeholder even before typing.
  if (editor.querySelector("ul, ol, h1, h2, h3, h4, .todo-check")) return false;
  return true;
}

/** Make sure the caret sits in a real block after select-all delete / odd WebKit leftovers. */
export function ensureEditableBlock(editor: HTMLElement): HTMLElement | null {
  const marker = selectionInEditor(editor);
  const current = closestBlock(marker?.range.startContainer ?? null, editor);
  if (current && current !== editor) return current;

  const hasBlock = Boolean(
    editor.querySelector("div, p, h1, h2, h3, h4, ul, ol"),
  );
  if (!hasBlock) {
    // Loose text/br or fully empty — wrap into a single div.
    const div = document.createElement("div");
    while (editor.firstChild) div.append(editor.firstChild);
    if (!div.childNodes.length) div.append(document.createElement("br"));
    editor.append(div);
    placeCaretInBlock(div);
    return div;
  }

  // Caret orphaned (e.g. directly on editor); move into the nearest block.
  const fallback =
    (editor.firstElementChild as HTMLElement | null) ??
    (editor.querySelector("div, p, h1, h2, h3, h4") as HTMLElement | null);
  if (fallback) {
    if (fallback.tagName === "UL" || fallback.tagName === "OL") {
      const li = fallback.querySelector("li");
      if (li instanceof HTMLLIElement) {
        focusListItemContent(li);
        return li;
      }
    }
    placeCaretInBlock(fallback);
    return fallback;
  }
  resetEmptyEditor(editor);
  return editor.firstElementChild as HTMLElement | null;
}

function placeCaretInBlock(block: HTMLElement, atEnd = false) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(block);
  range.collapse(!atEnd);
  selection.removeAllRanges();
  selection.addRange(range);
}

/** Collapse leftover empty divs after list/todo changes. */
export function cleanupEditorStructure(editor: HTMLElement) {
  // Remove blank blocks adjacent to lists first.
  for (const list of Array.from(editor.querySelectorAll("ul, ol"))) {
    const prev = list.previousSibling;
    const next = list.nextSibling;
    if (prev && isBlankBlock(prev)) prev.parentNode?.removeChild(prev);
    if (next && isBlankBlock(next)) next.parentNode?.removeChild(next);
  }

  // Drop empty siblings left behind by list insert/unwrap.
  for (const child of Array.from(editor.childNodes)) {
    if (!isBlankBlock(child)) continue;
    if (editor.childNodes.length <= 1) continue;
    child.parentNode?.removeChild(child);
  }

  if (isEditorEmpty(editor)) {
    resetEmptyEditor(editor);
  }
}

/** Force a single empty block and put the caret inside it. */
export function resetEmptyEditor(editor: HTMLElement) {
  editor.innerHTML = "<div><br></div>";
  const block = editor.firstElementChild;
  if (block instanceof HTMLElement) {
    focusEditor(editor);
    placeCaretInBlock(block);
  }
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

export function applyTextStyle(
  editor: HTMLElement,
  styleId: string,
  savedRange?: Range | null,
) {
  if (savedRange) {
    restoreRange(editor, savedRange);
  } else {
    focusEditor(editor);
  }

  if (!selectionInEditor(editor)) return;

  const style =
    TEXT_STYLES.find((item) => item.id === styleId) ?? TEXT_STYLES[0];
  const tag = style.tag;

  // WebKit prefers the bracketed form for formatBlock.
  const applied =
    document.execCommand("formatBlock", false, `<${tag}>`) ||
    document.execCommand("formatBlock", false, tag);

  if (!applied) {
    // Fallback: wrap the current block manually.
    const marker = selectionInEditor(editor);
    const block = closestBlock(marker?.range.startContainer ?? null, editor);
    if (!block || block === editor) return;
    if (block.tagName.toLowerCase() === tag) return;
    const next = document.createElement(tag);
    while (block.firstChild) next.append(block.firstChild);
    if (!next.childNodes.length) next.append(document.createElement("br"));
    block.replaceWith(next);
    placeCaretInBlock(next);
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

function readTextStyleId(node: Node | null, editor: HTMLElement): TextStyleId {
  let current =
    node?.nodeType === Node.ELEMENT_NODE
      ? (node as HTMLElement)
      : node?.parentElement ?? null;
  while (current && current !== editor) {
    const tag = current.tagName;
    if (tag === "H1") return "h1";
    if (tag === "H2") return "h2";
    if (tag === "H3") return "h3";
    if (tag === "H4") return "h4";
    current = current.parentElement;
  }
  return "body";
}

export type FormatState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  color: string;
  textStyle: TextStyleId;
  bullet: boolean;
  ordered: boolean;
  todo: boolean;
};

function closestList(
  node: Node | null,
  editor: HTMLElement,
): HTMLUListElement | HTMLOListElement | null {
  let current =
    node?.nodeType === Node.ELEMENT_NODE
      ? (node as HTMLElement)
      : node?.parentElement ?? null;
  while (current && current !== editor) {
    if (current.tagName === "UL" || current.tagName === "OL") {
      return current as HTMLUListElement | HTMLOListElement;
    }
    current = current.parentElement;
  }
  return null;
}

function closestListItem(node: Node | null, editor: HTMLElement) {
  let current =
    node?.nodeType === Node.ELEMENT_NODE
      ? (node as HTMLElement)
      : node?.parentElement ?? null;
  while (current && current !== editor) {
    if (current.tagName === "LI") return current as HTMLLIElement;
    current = current.parentElement;
  }
  return null;
}

function closestBlock(node: Node | null, editor: HTMLElement) {
  let current =
    node?.nodeType === Node.ELEMENT_NODE
      ? (node as HTMLElement)
      : node?.parentElement ?? null;
  while (current && current !== editor) {
    if (["DIV", "P", "LI", "H1", "H2", "H3", "H4", "H5", "H6"].includes(current.tagName)) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function prefixBeforeCaret(block: HTMLElement, range: Range) {
  const prefix = document.createRange();
  prefix.selectNodeContents(block);
  prefix.setEnd(range.startContainer, range.startOffset);
  return prefix.toString().replace(/\u200B/g, "");
}

/**
 * Markdown-like shortcuts at the start of a line:
 * `# `…`#### ` → headings, `- ` → bullet, `1. ` → ordered, `[ ] ` → todo.
 */
export function handleMarkdownListShortcut(
  editor: HTMLElement,
  event: KeyboardEvent,
): boolean {
  if (event.key !== " " || event.isComposing) return false;
  if (event.metaKey || event.ctrlKey || event.altKey) return false;

  const marker = selectionInEditor(editor);
  if (!marker || !marker.range.collapsed) return false;

  // Only trigger outside existing lists (keep typing normal inside items).
  if (closestList(marker.range.startContainer, editor)) return false;

  const block = ensureEditableBlock(editor);
  if (!block || block === editor) return false;
  // Re-read selection after possible structure repair.
  const live = selectionInEditor(editor);
  if (!live || !live.range.collapsed) return false;
  if (!block.contains(live.range.startContainer) && block !== live.range.startContainer) {
    // Caret was moved into the repaired block.
  }

  const prefix = prefixBeforeCaret(
    block,
    block.contains(live.range.startContainer) || block === live.range.startContainer
      ? live.range
      : (() => {
          const r = document.createRange();
          r.selectNodeContents(block);
          r.collapse(false);
          return r;
        })(),
  ).trimEnd();

  const headingMatch = prefix.match(/^(#{1,4})$/);
  if (headingMatch) {
    event.preventDefault();

    const wipe = document.createRange();
    wipe.selectNodeContents(block);
    if (block.contains(live.range.startContainer) || block === live.range.startContainer) {
      wipe.setEnd(live.range.startContainer, live.range.startOffset);
    }
    wipe.deleteContents();

    const rest = (block.textContent ?? "").replace(/\u200B/g, "");
    const heading = document.createElement(`h${headingMatch[1].length}`);
    if (rest) heading.append(document.createTextNode(rest));
    else heading.append(document.createElement("br"));
    block.replaceWith(heading);
    placeCaretInBlock(heading);
    return true;
  }

  let kind: "bullet" | "ordered" | "todo" | null = null;
  let checked = false;

  if (prefix === "-" || prefix === "*") {
    kind = "bullet";
  } else if (/^\d+\.$/.test(prefix)) {
    kind = "ordered";
  } else if (prefix === "[]" || prefix === "[ ]") {
    kind = "todo";
  } else if (prefix === "[x]" || prefix === "[X]" || prefix === "[x ]" || prefix === "[X ]") {
    kind = "todo";
    checked = true;
  }

  if (!kind) return false;

  event.preventDefault();

  const wipe = document.createRange();
  wipe.selectNodeContents(block);
  if (block.contains(live.range.startContainer) || block === live.range.startContainer) {
    wipe.setEnd(live.range.startContainer, live.range.startOffset);
  }
  wipe.deleteContents();

  // Keep any text that was typed after the markdown marker.
  const rest = (block.textContent ?? "").replace(/\u200B/g, "");

  // Build a brand-new list for THIS line only.
  // Avoid execCommand(insert*List): browsers merge into the adjacent list above,
  // so converting to todo would turn the whole previous list into checkboxes.
  const list = document.createElement(kind === "ordered" ? "ol" : "ul");
  const li = document.createElement("li");
  if (rest) li.append(document.createTextNode(rest));
  else li.append(document.createElement("br"));
  list.append(li);
  block.replaceWith(list);

  if (kind === "todo") {
    list.classList.add("todo-list");
    ensureTodoItem(li);
    if (checked) {
      const check = li.querySelector(".todo-check");
      check?.setAttribute("aria-checked", "true");
      li.classList.add("is-checked");
    }
  }

  focusListItemContent(li);
  return true;
}

function focusListItemContent(li: HTMLLIElement) {
  if (li.classList.contains("todo-item") || li.querySelector(":scope > .todo-text")) {
    ensureTodoItem(li);
    focusTodoText(li);
    return;
  }

  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();

  // Prefer the first text node so typing continues in the item body.
  const walker = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
  const textNode = walker.nextNode();
  if (textNode) {
    range.setStart(textNode, 0);
    range.collapse(true);
  } else if (li.querySelector("br")) {
    range.setStart(li, 0);
    range.collapse(true);
  } else {
    range.selectNodeContents(li);
    range.collapse(true);
  }
  selection.removeAllRanges();
  selection.addRange(range);
}

function isTodoTextEmpty(text: HTMLElement | null) {
  return !(text?.textContent ?? "").replace(/\u200B/g, "").trim();
}

function createTodoCheck(checked = false) {
  const check = document.createElement("span");
  check.className = "todo-check";
  check.contentEditable = "false";
  check.setAttribute("contenteditable", "false");
  check.setAttribute("role", "checkbox");
  check.setAttribute("aria-checked", String(checked));
  return check;
}

function stripTodoChrome(li: HTMLLIElement) {
  const text = li.querySelector(":scope > .todo-text");
  const check = li.querySelector(":scope > .todo-check");
  const legacy = li.querySelector(":scope > input[type='checkbox']");
  if (text) {
    li.replaceChildren(...Array.from(text.childNodes));
  } else {
    check?.remove();
    legacy?.remove();
  }
  li.classList.remove("todo-item", "is-checked");
}

function ensureTodoItem(li: HTMLLIElement) {
  li.classList.add("todo-item");
  let check = li.querySelector(":scope > .todo-check") as HTMLElement | null;
  let text = li.querySelector(":scope > .todo-text") as HTMLElement | null;
  const legacy = li.querySelector(
    ":scope > input[type='checkbox']",
  ) as HTMLInputElement | null;
  const checked =
    li.classList.contains("is-checked") ||
    check?.getAttribute("aria-checked") === "true" ||
    Boolean(legacy?.checked);

  if (!check) check = createTodoCheck(checked);
  check.contentEditable = "false";
  check.setAttribute("contenteditable", "false");
  check.setAttribute("role", "checkbox");
  check.setAttribute("aria-checked", String(checked));

  if (!text) {
    text = document.createElement("span");
    text.className = "todo-text";
    for (const child of Array.from(li.childNodes)) {
      if (child === check || child === legacy) continue;
      if (child instanceof HTMLElement && child.classList.contains("todo-check")) {
        continue;
      }
      if (child instanceof HTMLInputElement && child.type === "checkbox") {
        continue;
      }
      text.append(child);
    }
  }

  if (isTodoTextEmpty(text) && !text.querySelector("br")) {
    text.append(document.createElement("br"));
  }

  legacy?.remove();

  const alreadyOk =
    li.firstChild === check &&
    check.nextSibling === text &&
    li.childNodes.length === 2;
  if (!alreadyOk) {
    li.replaceChildren(check, text);
  }
  li.classList.toggle("is-checked", checked);
}

function focusTodoText(li: HTMLLIElement, atEnd = false) {
  const text = li.querySelector(":scope > .todo-text") as HTMLElement | null;
  if (!text) return;
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  if (atEnd) {
    range.selectNodeContents(text);
    range.collapse(false);
  } else {
    range.setStart(text, 0);
    range.collapse(true);
  }
  selection.removeAllRanges();
  selection.addRange(range);
}

function convertListToTodo(list: HTMLUListElement | HTMLOListElement) {
  let ul: HTMLUListElement;
  if (list.tagName === "OL") {
    ul = document.createElement("ul");
    while (list.firstChild) ul.append(list.firstChild);
    list.replaceWith(ul);
  } else {
    ul = list as HTMLUListElement;
  }
  ul.classList.add("todo-list");
  const items = Array.from(ul.children).filter(
    (child): child is HTMLLIElement => child instanceof HTMLLIElement,
  );
  for (const li of items) ensureTodoItem(li);
  const target =
    closestListItem(window.getSelection()?.anchorNode ?? null, ul) ??
    items[0] ??
    null;
  if (target) focusTodoText(target);
  return ul;
}

function convertTodoToList(
  list: HTMLUListElement,
  kind: "ul" | "ol",
) {
  for (const li of Array.from(list.children)) {
    if (li instanceof HTMLLIElement) stripTodoChrome(li);
  }
  list.classList.remove("todo-list");
  if (kind === "ol") {
    const ol = document.createElement("ol");
    while (list.firstChild) ol.append(list.firstChild);
    list.replaceWith(ol);
    return ol;
  }
  return list;
}

export function normalizeTodoLists(editor: HTMLElement) {
  for (const ul of Array.from(editor.querySelectorAll("ul.todo-list"))) {
    for (const li of Array.from(ul.children)) {
      if (li instanceof HTMLLIElement) ensureTodoItem(li);
    }
  }
  // Migrate any leftover native checkboxes outside ensureTodoItem path.
  for (const input of Array.from(
    editor.querySelectorAll("ul.todo-list input[type='checkbox']"),
  )) {
    const li = input.closest("li");
    if (li instanceof HTMLLIElement) ensureTodoItem(li);
    else input.remove();
  }
}

export function toggleTodoChecked(target: HTMLElement) {
  const check = target.closest(".todo-check") as HTMLElement | null;
  const li = check?.closest("li.todo-item") as HTMLLIElement | null;
  if (!check || !li) return false;
  const next = check.getAttribute("aria-checked") !== "true";
  check.setAttribute("aria-checked", String(next));
  li.classList.toggle("is-checked", next);
  return true;
}

/** Keep the caret inside editable todo text, never before the check marker. */
export function repairTodoCaret(editor: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  if (document.activeElement !== editor) return;
  const node = selection.anchorNode;
  if (!node || !editor.contains(node)) return;

  if (node instanceof HTMLElement && node.classList.contains("todo-check")) {
    const li = node.closest("li.todo-item");
    if (li instanceof HTMLLIElement) focusTodoText(li);
    return;
  }

  const li = closestListItem(node, editor);
  const list = li ? closestList(li, editor) : null;
  if (!li || !list?.classList.contains("todo-list")) return;

  const check = li.querySelector(":scope > .todo-check");
  const text = li.querySelector(":scope > .todo-text");
  if (!check || !text) return;

  // Caret sitting as a child of <li> before/around the check marker.
  if (
    selection.anchorNode === li &&
    selection.anchorOffset <= 1 &&
    !text.contains(selection.focusNode)
  ) {
    focusTodoText(li);
  }
}

export function toggleBulletList(editor: HTMLElement) {
  focusEditor(editor);
  const marker = selectionInEditor(editor);
  const list = closestList(marker?.range.startContainer ?? null, editor);

  if (list?.classList.contains("todo-list")) {
    convertTodoToList(list as HTMLUListElement, "ul");
    cleanupEditorStructure(editor);
    return;
  }

  document.execCommand("insertUnorderedList", false);
  const next = closestList(
    window.getSelection()?.anchorNode ?? null,
    editor,
  );
  next?.classList.remove("todo-list");
  if (next) {
    for (const li of Array.from(next.querySelectorAll("li.todo-item"))) {
      stripTodoChrome(li as HTMLLIElement);
    }
  }
  cleanupEditorStructure(editor);
}

export function toggleOrderedList(editor: HTMLElement) {
  focusEditor(editor);
  const marker = selectionInEditor(editor);
  const list = closestList(marker?.range.startContainer ?? null, editor);

  if (list?.classList.contains("todo-list")) {
    convertTodoToList(list as HTMLUListElement, "ol");
    cleanupEditorStructure(editor);
    return;
  }

  document.execCommand("insertOrderedList", false);
  const next = closestList(
    window.getSelection()?.anchorNode ?? null,
    editor,
  );
  if (next?.classList.contains("todo-list")) {
    convertTodoToList(next as HTMLUListElement, "ol");
  }
  cleanupEditorStructure(editor);
}

function unwrapTodoListToBlocks(list: HTMLUListElement) {
  const blocks: HTMLDivElement[] = [];
  for (const child of Array.from(list.children)) {
    if (!(child instanceof HTMLLIElement)) continue;
    stripTodoChrome(child);
    const block = document.createElement("div");
    while (child.firstChild) block.append(child.firstChild);
    if (isBlankBlock(block)) {
      block.replaceChildren(document.createElement("br"));
    }
    blocks.push(block);
  }

  if (blocks.length === 0 || blocks.every(isBlankBlock)) {
    const empty = document.createElement("div");
    empty.append(document.createElement("br"));
    list.replaceWith(empty);
    placeCaretInBlock(empty);
    return empty;
  }

  const frag = document.createDocumentFragment();
  for (const block of blocks) frag.append(block);
  const first = blocks[0];
  list.replaceWith(frag);
  placeCaretInBlock(first);
  return first;
}

export function toggleTodoList(editor: HTMLElement) {
  focusEditor(editor);
  const marker = selectionInEditor(editor);
  const list = closestList(marker?.range.startContainer ?? null, editor);

  if (list?.classList.contains("todo-list")) {
    unwrapTodoListToBlocks(list as HTMLUListElement);
    cleanupEditorStructure(editor);
    return;
  }

  if (list) {
    convertListToTodo(list);
    cleanupEditorStructure(editor);
    return;
  }

  // Starting a todo in an empty note: clear blank placeholder blocks first
  // so insertUnorderedList doesn't leave an empty first line behind.
  if (isEditorEmpty(editor)) {
    editor.innerHTML = "";
  }

  document.execCommand("insertUnorderedList", false);
  const created = closestList(
    window.getSelection()?.anchorNode ?? null,
    editor,
  );
  if (created) convertListToTodo(created);
  cleanupEditorStructure(editor);
}

function isCaretAtListItemStart(
  li: HTMLLIElement,
  range: Range,
  isTodo: boolean,
) {
  if (!range.collapsed) return false;

  if (isTodo) {
    const text = li.querySelector(".todo-text");
    if (!text) return false;
    if (
      range.startContainer !== text &&
      !text.contains(range.startContainer)
    ) {
      return false;
    }
    const probe = document.createRange();
    probe.selectNodeContents(text);
    probe.collapse(true);
    return range.compareBoundaryPoints(Range.START_TO_START, probe) === 0;
  }

  const probe = document.createRange();
  probe.selectNodeContents(li);
  probe.collapse(true);
  try {
    return range.compareBoundaryPoints(Range.START_TO_START, probe) === 0;
  } catch {
    return false;
  }
}

/**
 * Turn the current list item into a normal paragraph in-place.
 * Keeps the caret at the start of that line (does NOT jump to previous item).
 */
function liftListItemToParagraph(li: HTMLLIElement, list: HTMLElement) {
  if (list.classList.contains("todo-list")) {
    stripTodoChrome(li);
  }

  const block = document.createElement("div");
  while (li.firstChild) block.append(li.firstChild);
  if (!block.childNodes.length || isBlankBlock(block)) {
    block.replaceChildren(document.createElement("br"));
  }

  const prev = li.previousElementSibling;
  const next = li.nextElementSibling;

  if (!prev && !next) {
    list.replaceWith(block);
  } else if (!prev) {
    list.before(block);
    li.remove();
  } else if (!next) {
    list.after(block);
    li.remove();
  } else {
    const afterList = document.createElement(list.tagName.toLowerCase());
    if (list.classList.contains("todo-list")) {
      afterList.classList.add("todo-list");
    }
    while (li.nextSibling) afterList.append(li.nextSibling);
    li.remove();
    list.after(block, afterList);
    if (!list.children.length) list.remove();
  }

  placeCaretInBlock(block);
}

export function handleListKeydown(
  editor: HTMLElement,
  event: KeyboardEvent,
): boolean {
  if (event.isComposing) return false;
  const marker = selectionInEditor(editor);
  if (!marker) return false;
  const li = closestListItem(marker.range.startContainer, editor);
  const list = li ? closestList(li, editor) : null;
  if (!li || !list) return false;

  const isTodo = list.classList.contains("todo-list");
  const text = li.querySelector(".todo-text") as HTMLElement | null;

  if (event.key === "Enter" && !event.shiftKey && isTodo) {
    if (isTodoTextEmpty(text)) {
      event.preventDefault();
      // Empty todo Enter exits the list onto a plain line after it.
      liftListItemToParagraph(li, list);
      return true;
    }

    event.preventDefault();
    const next = document.createElement("li");
    ensureTodoItem(next);
    li.after(next);
    focusTodoText(next);
    return true;
  }

  if (event.key === "Backspace" && marker.range.collapsed) {
    if (!isCaretAtListItemStart(li, marker.range, isTodo)) return false;
    event.preventDefault();
    // Clear the list marker on this line; keep caret at the line start.
    liftListItemToParagraph(li, list);
    return true;
  }

  return false;
}

/** @deprecated use handleListKeydown */
export function handleTodoKeydown(
  editor: HTMLElement,
  event: KeyboardEvent,
): boolean {
  return handleListKeydown(editor, event);
}

export function readFormatState(editor: HTMLElement): FormatState {
  const marker = selectionInEditor(editor);
  const style = nearestStyle(
    marker?.range.startContainer ?? editor,
    editor,
  );
  const deco = `${style?.textDecorationLine ?? ""} ${style?.textDecoration ?? ""}`;
  const list = closestList(marker?.range.startContainer ?? null, editor);
  const inTodo = Boolean(list?.classList.contains("todo-list"));
  return {
    bold: document.queryCommandState("bold"),
    italic: document.queryCommandState("italic"),
    underline:
      document.queryCommandState("underline") || /\bunderline\b/.test(deco),
    strike:
      document.queryCommandState("strikeThrough") ||
      /\bline-through\b/.test(deco),
    color: rgbToHex(style?.color ?? "#2a2418"),
    textStyle: readTextStyleId(marker?.range.startContainer ?? null, editor),
    bullet:
      !inTodo &&
      (document.queryCommandState("insertUnorderedList") ||
        list?.tagName === "UL"),
    ordered:
      !inTodo &&
      (document.queryCommandState("insertOrderedList") ||
        list?.tagName === "OL"),
    todo: inTodo,
  };
}
