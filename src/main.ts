import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  applyForeColor,
  applyTextStyle,
  cleanupEditorStructure,
  contentToHtml,
  handleListKeydown,
  handleMarkdownListShortcut,
  isEditorEmpty,
  normalizeFontSizeTree,
  normalizeTodoLists,
  readFormatState,
  repairTodoCaret,
  resetEmptyEditor,
  saveEditorRange,
  sanitizeHtml,
  toggleBulletList,
  toggleFormat,
  toggleOrderedList,
  toggleTodoChecked,
  toggleTodoList,
} from "./format";
import {
  createBlankNote,
  defaults,
  displayTitle,
  emptyStore,
  loadStore,
  saveStore,
  touchNote,
  type NoteState,
} from "./store";
import {
  bindWindowToNote,
  openManagerWindow,
  openNoteWindow,
  unbindWindow,
} from "./windows";

function noteIdFromUrl() {
  return new URLSearchParams(window.location.search).get("id");
}

function setUrlNoteId(noteId: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("id", noteId);
  window.history.replaceState({}, "", url);
}

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: "表情",
    emojis: [
      "😀",
      "😃",
      "😄",
      "😁",
      "😆",
      "😅",
      "😂",
      "🤣",
      "😊",
      "😇",
      "🙂",
      "😉",
      "😌",
      "😍",
      "🥰",
      "😘",
      "😗",
      "😙",
      "😚",
      "😋",
      "😜",
      "🤪",
      "😝",
      "🤑",
      "🤗",
      "🤭",
      "🤫",
      "🤔",
      "🫡",
      "🤐",
      "🤨",
      "😐",
      "😑",
      "😶",
      "🫥",
      "😏",
      "😒",
      "🙄",
      "😬",
      "😮‍💨",
      "🤥",
      "😔",
      "😪",
      "🤤",
      "😴",
      "😷",
      "🤒",
      "🤕",
      "🤢",
      "🤮",
      "🥵",
      "🥶",
      "🥴",
      "😵",
      "🤯",
      "🤠",
      "🥳",
      "😎",
      "🤓",
      "🧐",
      "😕",
      "😟",
      "🙁",
      "☹️",
      "😮",
      "😯",
      "😲",
      "😳",
      "🥺",
      "😦",
      "😧",
      "😨",
      "😰",
      "😥",
      "😢",
      "😭",
      "😱",
      "😖",
      "😣",
      "😞",
      "😓",
      "😩",
      "😫",
      "🥱",
      "😤",
      "😡",
      "😠",
      "🤬",
      "😈",
      "👿",
      "💀",
      "☠️",
      "💩",
      "🤡",
      "👹",
      "👺",
      "👻",
      "👽",
      "👾",
      "🤖",
      "😺",
      "😸",
      "😹",
      "😻",
      "😼",
      "😽",
      "🙀",
      "😿",
      "😾",
      "🤩",
      "🫠",
      "🫢",
      "🫣",
    ],
  },
  {
    label: "便签",
    emojis: [
      "📝",
      "📌",
      "📍",
      "✏️",
      "✒️",
      "🖋️",
      "📄",
      "📃",
      "📋",
      "📁",
      "📂",
      "🗂️",
      "💡",
      "💭",
      "💬",
      "🗯️",
      "🧠",
      "👀",
      "✅",
      "☑️",
      "✔️",
      "❌",
      "❗",
      "❓",
    ],
  },
  {
    label: "标记",
    emojis: [
      "⭐",
      "🌟",
      "✨",
      "💫",
      "🔥",
      "💥",
      "🎯",
      "🏁",
      "🚩",
      "🚀",
      "🛸",
      "✈️",
      "❤️",
      "🧡",
      "💛",
      "💚",
      "💙",
      "💜",
      "🖤",
      "🤍",
      "💔",
      "💯",
      "🔔",
      "📣",
    ],
  },
  {
    label: "工作",
    emojis: [
      "📚",
      "📖",
      "📕",
      "📗",
      "📘",
      "📙",
      "🗓️",
      "📅",
      "⏳",
      "⏰",
      "⏱️",
      "🕒",
      "🛠️",
      "⚙️",
      "🔧",
      "🔨",
      "🧰",
      "🧪",
      "💻",
      "📱",
      "⌨️",
      "🔒",
      "🔑",
      "📈",
    ],
  },
  {
    label: "生活",
    emojis: [
      "🎵",
      "🎶",
      "🎧",
      "🎬",
      "🎮",
      "🧩",
      "🌈",
      "☀️",
      "🌙",
      "☁️",
      "❄️",
      "🌊",
      "☕",
      "🍵",
      "🧋",
      "🍎",
      "🍋",
      "🍇",
      "🐶",
      "🐱",
      "🐼",
      "🦊",
      "🐻",
      "🐸",
      "🏠",
      "🏢",
      "🎒",
      "🎁",
      "🛒",
      "💰",
      "🎉",
      "🙌",
      "👍",
      "🤝",
      "🙏",
      "💪",
    ],
  },
];

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;
  const num = Number.parseInt(full, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const R = toLinear(r);
  const G = toLinear(g);
  const B = toLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function applyTheme(state: NoteState) {
  const root = document.documentElement;
  root.style.setProperty("--paper", state.bgColor);
  root.style.setProperty("--opacity", String(state.opacity / 100));
  root.style.setProperty(
    "--bg-image",
    state.bgImage ? `url("${state.bgImage}")` : "none",
  );

  const dark = relativeLuminance(state.bgColor) < 0.35;
  root.style.setProperty("--ink", dark ? "#f7f1e6" : "#2a2418");
  root.style.setProperty(
    "--ink-soft",
    dark ? "rgba(247, 241, 230, 0.78)" : "rgba(42, 36, 24, 0.72)",
  );
  root.style.setProperty(
    "--ink-faint",
    dark ? "rgba(247, 241, 230, 0.45)" : "rgba(42, 36, 24, 0.42)",
  );
  root.style.setProperty(
    "--line",
    dark ? "rgba(247, 241, 230, 0.16)" : "rgba(42, 36, 24, 0.12)",
  );
}

async function main() {
  const appWindow = getCurrentWindow();
  try {
    await invoke("init_window_chrome");
  } catch {
    // Non-Tauri preview can ignore this.
  }

  const store = loadStore();
  let noteId = noteIdFromUrl();
  if (!noteId || !store.notes[noteId]) {
    noteId = store.openIds[0] ?? Object.keys(store.notes)[0];
    if (!noteId) {
      const created = emptyStore();
      Object.assign(store, created);
      saveStore(store);
      noteId = created.openIds[0];
    }
    setUrlNoteId(noteId);
  }
  if (!store.openIds.includes(noteId)) {
    store.openIds.push(noteId);
    saveStore(store);
  }

  bindWindowToNote(appWindow.label, noteId);
  const state = store.notes[noteId];

  const app = document.querySelector<HTMLElement>("#app");
  const titleInput = document.querySelector<HTMLInputElement>("#note-title");
  const btnEmoji = document.querySelector<HTMLButtonElement>("#btn-emoji");
  const emojiPicker = document.querySelector<HTMLElement>("#emoji-picker");
  const btnEditTitle =
    document.querySelector<HTMLButtonElement>("#btn-edit-title");
  const formatToolbar = document.querySelector<HTMLElement>("#format-toolbar");
  const editorShell = document.querySelector<HTMLElement>(".editor-shell");
  const editorPlaceholder =
    document.querySelector<HTMLElement>("#editor-placeholder");
  const editor = document.querySelector<HTMLElement>("#editor");
  const fmtSize = document.querySelector<HTMLSelectElement>("#fmt-size");
  const fmtColor = document.querySelector<HTMLInputElement>("#fmt-color");
  const fmtBold = document.querySelector<HTMLButtonElement>("#fmt-bold");
  const fmtItalic = document.querySelector<HTMLButtonElement>("#fmt-italic");
  const fmtUnderline =
    document.querySelector<HTMLButtonElement>("#fmt-underline");
  const fmtStrike = document.querySelector<HTMLButtonElement>("#fmt-strike");
  const fmtBullet = document.querySelector<HTMLButtonElement>("#fmt-bullet");
  const fmtOrdered = document.querySelector<HTMLButtonElement>("#fmt-ordered");
  const fmtTodo = document.querySelector<HTMLButtonElement>("#fmt-todo");
  const settings = document.querySelector<HTMLElement>("#settings");
  const opacityInput = document.querySelector<HTMLInputElement>("#opacity");
  const opacityValue = document.querySelector<HTMLOutputElement>("#opacity-value");
  const bgColorInput = document.querySelector<HTMLInputElement>("#bg-color");
  const alwaysOnTopInput =
    document.querySelector<HTMLInputElement>("#always-on-top");
  const bgImageInput =
    document.querySelector<HTMLInputElement>("#bg-image-input");
  const btnNew = document.querySelector<HTMLButtonElement>("#btn-new");
  const btnManager = document.querySelector<HTMLButtonElement>("#btn-manager");
  const btnPin = document.querySelector<HTMLButtonElement>("#btn-pin");
  const btnSettings = document.querySelector<HTMLButtonElement>("#btn-settings");
  const btnMinimize = document.querySelector<HTMLButtonElement>("#btn-minimize");
  const btnClose = document.querySelector<HTMLButtonElement>("#btn-close");
  const btnBgImage = document.querySelector<HTMLButtonElement>("#btn-bg-image");
  const btnClearBg = document.querySelector<HTMLButtonElement>("#btn-clear-bg");

  if (
    !app ||
    !titleInput ||
    !btnEmoji ||
    !emojiPicker ||
    !btnEditTitle ||
    !formatToolbar ||
    !editorShell ||
    !editorPlaceholder ||
    !editor ||
    !fmtSize ||
    !fmtColor ||
    !fmtBold ||
    !fmtItalic ||
    !fmtUnderline ||
    !fmtStrike ||
    !fmtBullet ||
    !fmtOrdered ||
    !fmtTodo ||
    !settings ||
    !opacityInput ||
    !opacityValue ||
    !bgColorInput ||
    !alwaysOnTopInput ||
    !bgImageInput ||
    !btnNew ||
    !btnManager ||
    !btnPin ||
    !btnSettings ||
    !btnMinimize ||
    !btnClose ||
    !btnBgImage ||
    !btnClearBg
  ) {
    return;
  }

  const persist = () => {
    store.notes[noteId] = touchNote(state);
    Object.assign(state, store.notes[noteId]);
    saveStore(store);
  };

  const markClosed = () => {
    const latest = loadStore();
    latest.openIds = latest.openIds.filter((id) => id !== noteId);
    saveStore(latest);
    unbindWindow(appWindow.label);
  };

  const syncPinUi = (on: boolean) => {
    btnPin.setAttribute("aria-pressed", String(on));
    alwaysOnTopInput.checked = on;
    btnPin.title = on ? "取消置顶" : "置顶";
  };

  const setAlwaysOnTop = async (on: boolean) => {
    state.alwaysOnTop = on;
    syncPinUi(on);
    persist();
    await appWindow.setAlwaysOnTop(on);
  };

  const normalizeTitle = (value: string) => {
    const trimmed = value.trim();
    return trimmed || defaults.title;
  };

  const syncWindowTitle = async () => {
    const full = displayTitle(state);
    document.title = full;
    await appWindow.setTitle(full);
  };

  const titleMeasure = document.createElement("span");
  titleMeasure.setAttribute("aria-hidden", "true");
  titleMeasure.className = "note-title-measure";
  document.body.append(titleMeasure);

  const fitTitleWidth = () => {
    const value = titleInput.value || defaults.title;
    const style = window.getComputedStyle(titleInput);
    titleMeasure.textContent = value;
    titleMeasure.style.fontFamily = style.fontFamily;
    titleMeasure.style.fontSize = style.fontSize;
    titleMeasure.style.fontWeight = style.fontWeight;
    titleMeasure.style.letterSpacing = style.letterSpacing;
    const pad =
      Number.parseFloat(style.paddingLeft) +
      Number.parseFloat(style.paddingRight) +
      Number.parseFloat(style.borderLeftWidth) +
      Number.parseFloat(style.borderRightWidth);
    // Tiny slack avoids subpixel clipping without leaving a large gap.
    const width = Math.ceil(titleMeasure.getBoundingClientRect().width + pad + 2);
    titleInput.style.width = `${Math.max(width, 24)}px`;
  };

  const renderTitleUi = async ({ persistNow = true } = {}) => {
    state.title = normalizeTitle(state.title);
    btnEmoji.textContent = state.emoji;
    titleInput.value = state.title;
    fitTitleWidth();
    if (persistNow) persist();
    await syncWindowTitle();
  };

  const setEmojiPickerOpen = (open: boolean) => {
    if (open) {
      emojiPicker.removeAttribute("hidden");
    } else {
      emojiPicker.setAttribute("hidden", "");
    }
    btnEmoji.setAttribute("aria-expanded", String(open));
  };

  const startTitleEdit = () => {
    setEmojiPickerOpen(false);
    titleInput.readOnly = false;
    titleInput.classList.add("is-editing");
    titleInput.focus();
    titleInput.select();
  };

  const endTitleEdit = async (commit: boolean) => {
    if (commit) {
      state.title = normalizeTitle(titleInput.value);
    } else {
      titleInput.value = state.title;
    }
    titleInput.readOnly = true;
    titleInput.classList.remove("is-editing");
    await renderTitleUi();
  };

  emojiPicker.replaceChildren(
    ...EMOJI_CATEGORIES.flatMap((category) => {
      const section = document.createElement("section");
      section.className = "emoji-section";

      const heading = document.createElement("h3");
      heading.className = "emoji-section-title";
      heading.textContent = category.label;

      const grid = document.createElement("div");
      grid.className = "emoji-grid";
      for (const emoji of category.emojis) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "emoji-option";
        button.textContent = emoji;
        button.title = emoji;
        button.addEventListener("click", async () => {
          state.emoji = emoji;
          setEmojiPickerOpen(false);
          await renderTitleUi();
        });
        grid.append(button);
      }

      section.append(heading, grid);
      return [section];
    }),
  );

  titleInput.value = state.title;
  btnEmoji.textContent = state.emoji;
  editor.innerHTML = contentToHtml(state.content);
  normalizeFontSizeTree(editor);
  normalizeTodoLists(editor);
  if (isEditorEmpty(editor)) resetEmptyEditor(editor);
  else cleanupEditorStructure(editor);
  opacityInput.value = String(state.opacity);
  opacityValue.value = `${state.opacity}%`;
  bgColorInput.value = state.bgColor;
  applyTheme(state);
  await renderTitleUi({ persistNow: false });
  await setAlwaysOnTop(state.alwaysOnTop);
  if (document.fonts?.ready) {
    void document.fonts.ready.then(() => fitTitleWidth());
  }

  // Only the bootstrap window restores sibling notes to avoid fan-out.
  if (appWindow.label === "main") {
    const siblings = store.openIds.filter((id) => id !== noteId);
    for (const [index, id] of siblings.entries()) {
      try {
        await openNoteWindow(id, {
          placement: "cascade",
          cascadeIndex: index,
          focus: false,
        });
      } catch (error) {
        console.error("failed to restore note window", id, error);
      }
    }
  }

  let saveTimer: number | undefined;

  btnNew.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });
  btnManager.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });
  btnEmoji.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });
  btnEditTitle.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });
  emojiPicker.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });
  titleInput.addEventListener("pointerdown", (event) => {
    if (titleInput.classList.contains("is-editing")) {
      event.stopPropagation();
    }
  });

  btnEmoji.addEventListener("click", () => {
    const open = emojiPicker.hasAttribute("hidden");
    setEmojiPickerOpen(open);
  });

  btnEditTitle.addEventListener("click", () => {
    startTitleEdit();
  });

  titleInput.addEventListener("input", () => {
    if (!titleInput.classList.contains("is-editing")) return;
    fitTitleWidth();
  });

  titleInput.addEventListener("keydown", (event) => {
    if (!titleInput.classList.contains("is-editing")) return;
    if (event.key === "Enter") {
      event.preventDefault();
      void endTitleEdit(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      void endTitleEdit(false);
    }
  });

  titleInput.addEventListener("blur", () => {
    if (!titleInput.classList.contains("is-editing")) return;
    void endTitleEdit(true);
  });

  document.addEventListener("pointerdown", (event) => {
    const target = event.target as Node | null;
    if (
      !emojiPicker.hasAttribute("hidden") &&
      target &&
      !emojiPicker.contains(target) &&
      !btnEmoji.contains(target)
    ) {
      setEmojiPickerOpen(false);
    }
  });

  const syncEmptyState = () => {
    const empty = isEditorEmpty(editor);
    editor.classList.toggle("is-empty", empty);
    editorPlaceholder.hidden = !empty;
  };

  const persistEditor = () => {
    state.content = sanitizeHtml(editor.innerHTML);
    syncEmptyState();
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(persist, 200);
  };

  syncEmptyState();

  const syncFormatToolbar = () => {
    if (app.classList.contains("settings-open")) return;
    const format = readFormatState(editor);
    fmtBold.setAttribute("aria-pressed", String(format.bold));
    fmtItalic.setAttribute("aria-pressed", String(format.italic));
    fmtUnderline.setAttribute("aria-pressed", String(format.underline));
    fmtStrike.setAttribute("aria-pressed", String(format.strike));
    fmtBullet.setAttribute("aria-pressed", String(format.bullet));
    fmtOrdered.setAttribute("aria-pressed", String(format.ordered));
    fmtTodo.setAttribute("aria-pressed", String(format.todo));
    if (document.activeElement !== fmtColor) {
      fmtColor.value = format.color;
    }
    if (document.activeElement !== fmtSize) {
      fmtSize.value = format.textStyle;
    }
  };

  const keepSelection = (event: Event) => {
    event.preventDefault();
  };

  // Buttons need preventDefault so the editor selection isn't cleared.
  // Native <select>/<input type=color> must NOT preventDefault or they won't open.
  for (const control of [
    fmtBold,
    fmtItalic,
    fmtUnderline,
    fmtStrike,
    fmtBullet,
    fmtOrdered,
    fmtTodo,
  ]) {
    control.addEventListener("mousedown", keepSelection);
  }

  let savedRange: Range | null = null;
  const rememberSelection = () => {
    savedRange = saveEditorRange(editor) ?? savedRange;
  };

  fmtSize.addEventListener("mousedown", rememberSelection);
  fmtSize.addEventListener("focus", rememberSelection);
  fmtColor.addEventListener("mousedown", rememberSelection);
  fmtColor.addEventListener("focus", rememberSelection);

  fmtBold.addEventListener("click", () => {
    toggleFormat(editor, "bold");
    persistEditor();
    syncFormatToolbar();
  });
  fmtItalic.addEventListener("click", () => {
    toggleFormat(editor, "italic");
    persistEditor();
    syncFormatToolbar();
  });
  fmtUnderline.addEventListener("click", () => {
    toggleFormat(editor, "underline");
    persistEditor();
    syncFormatToolbar();
  });
  fmtStrike.addEventListener("click", () => {
    toggleFormat(editor, "strikeThrough");
    persistEditor();
    syncFormatToolbar();
  });
  fmtBullet.addEventListener("click", () => {
    toggleBulletList(editor);
    normalizeTodoLists(editor);
    persistEditor();
    syncFormatToolbar();
  });
  fmtOrdered.addEventListener("click", () => {
    toggleOrderedList(editor);
    normalizeTodoLists(editor);
    persistEditor();
    syncFormatToolbar();
  });
  fmtTodo.addEventListener("click", () => {
    toggleTodoList(editor);
    normalizeTodoLists(editor);
    persistEditor();
    syncFormatToolbar();
  });
  fmtSize.addEventListener("change", () => {
    applyTextStyle(editor, fmtSize.value, savedRange);
    savedRange = saveEditorRange(editor);
    persistEditor();
    syncFormatToolbar();
  });
  fmtColor.addEventListener("input", () => {
    if (savedRange) {
      const selection = window.getSelection();
      editor.focus();
      selection?.removeAllRanges();
      selection?.addRange(savedRange);
    }
    applyForeColor(editor, fmtColor.value);
    savedRange = saveEditorRange(editor);
    persistEditor();
    syncFormatToolbar();
  });

  editor.addEventListener("input", () => {
    if (editor.querySelector("ul.todo-list")) normalizeTodoLists(editor);
    persistEditor();
  });
  editor.addEventListener("keydown", (event) => {
    if (handleMarkdownListShortcut(editor, event)) {
      normalizeTodoLists(editor);
      persistEditor();
      syncFormatToolbar();
      return;
    }
    if (handleListKeydown(editor, event)) {
      normalizeTodoLists(editor);
      persistEditor();
      syncFormatToolbar();
    }
  });
  editor.addEventListener("keyup", () => {
    repairTodoCaret(editor);
    syncFormatToolbar();
  });
  editor.addEventListener("mouseup", () => {
    repairTodoCaret(editor);
    syncFormatToolbar();
  });
  editor.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !editor.contains(target)) return;
    if (toggleTodoChecked(target)) {
      event.preventDefault();
      persistEditor();
    }
  });
  editor.addEventListener("paste", (event) => {
    event.preventDefault();
    const html = event.clipboardData?.getData("text/html");
    const text = event.clipboardData?.getData("text/plain") ?? "";
    if (html) {
      document.execCommand("insertHTML", false, sanitizeHtml(html));
    } else {
      document.execCommand("insertText", false, text);
    }
    normalizeTodoLists(editor);
    persistEditor();
  });
  document.addEventListener("selectionchange", () => {
    if (document.activeElement !== editor) return;
    repairTodoCaret(editor);
    syncFormatToolbar();
  });
  syncFormatToolbar();

  opacityInput.addEventListener("input", () => {
    state.opacity = Number(opacityInput.value);
    opacityValue.value = `${state.opacity}%`;
    applyTheme(state);
    persist();
  });

  bgColorInput.addEventListener("input", () => {
    state.bgColor = bgColorInput.value;
    applyTheme(state);
    persist();
  });

  alwaysOnTopInput.addEventListener("change", async () => {
    await setAlwaysOnTop(alwaysOnTopInput.checked);
  });

  btnNew.addEventListener("click", async () => {
    const latest = loadStore();
    const created = createBlankNote(latest);
    saveStore(created.store);
    Object.assign(store, created.store);
    try {
      await openNoteWindow(created.id, { placement: "below", focus: false });
    } catch (error) {
      console.error("failed to create note window", error);
      window.alert("新建便签失败，请重试");
    }
  });

  btnManager.addEventListener("click", async () => {
    try {
      await openManagerWindow();
    } catch (error) {
      console.error("failed to open manager", error);
      window.alert("打开便签管理失败，请重试");
    }
  });

  btnPin.addEventListener("click", async () => {
    await setAlwaysOnTop(!state.alwaysOnTop);
  });

  btnSettings.addEventListener("click", () => {
    const open = settings.hasAttribute("hidden");
    if (open) {
      settings.removeAttribute("hidden");
      editorShell.setAttribute("hidden", "");
      formatToolbar.setAttribute("hidden", "");
      app.classList.add("settings-open");
    } else {
      settings.setAttribute("hidden", "");
      editorShell.removeAttribute("hidden");
      formatToolbar.removeAttribute("hidden");
      app.classList.remove("settings-open");
    }
    btnSettings.setAttribute("aria-pressed", String(open));
  });

  btnMinimize.addEventListener("click", () => appWindow.minimize());
  btnClose.addEventListener("click", async () => {
    markClosed();
    // destroy bypasses close-requested recirculation and reliably closes.
    await appWindow.destroy();
  });

  await appWindow.onCloseRequested(() => {
    markClosed();
  });

  btnBgImage.addEventListener("click", () => bgImageInput.click());
  btnClearBg.addEventListener("click", () => {
    state.bgImage = null;
    bgImageInput.value = "";
    applyTheme(state);
    persist();
  });

  bgImageInput.addEventListener("change", async () => {
    const file = bgImageInput.files?.[0];
    if (!file) return;
    if (file.size > 2.5 * 1024 * 1024) {
      window.alert("图片请小于 2.5MB");
      bgImageInput.value = "";
      return;
    }
    const dataUrl = await readAsDataUrl(file);
    state.bgImage = dataUrl;
    applyTheme(state);
    persist();
  });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

window.addEventListener("DOMContentLoaded", () => {
  void main();
});
