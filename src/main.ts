import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

const STORE_KEY = "sticky-notes-v2";
const LEGACY_KEY = "sticky-note-v1";
const NOTE_COLORS = [
  "#ffe08a",
  "#ffc9c9",
  "#c3e6cb",
  "#c5d8ff",
  "#f3d9ff",
  "#ffe2c6",
];

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

type NoteState = {
  emoji: string;
  title: string;
  content: string;
  opacity: number;
  bgColor: string;
  bgImage: string | null;
  alwaysOnTop: boolean;
};

const defaults: NoteState = {
  emoji: "📝",
  title: "便签",
  content: "",
  opacity: 92,
  bgColor: "#ffe08a",
  bgImage: null,
  alwaysOnTop: false,
};

const emojiPrefixPattern = /^(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)\s*/u;

type NoteStore = {
  notes: Record<string, NoteState>;
  openIds: string[];
};

function normalizeNote(input: Partial<NoteState> | null | undefined): NoteState {
  const parsed = { ...defaults, ...(input ?? {}) };
  if (!parsed.emoji || parsed.emoji === defaults.emoji) {
    const match = String(parsed.title ?? "").match(emojiPrefixPattern);
    if (match) {
      parsed.emoji = match[1];
      parsed.title =
        String(parsed.title).slice(match[0].length).trim() || defaults.title;
    }
  }
  return {
    ...defaults,
    ...parsed,
    emoji: parsed.emoji || defaults.emoji,
    title: parsed.title || defaults.title,
  };
}

function createNoteId() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

function emptyStore(): NoteStore {
  const id = createNoteId();
  return {
    notes: { [id]: { ...defaults } },
    openIds: [id],
  };
}

function loadStore(): NoteStore {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as NoteStore;
      const notes: Record<string, NoteState> = {};
      for (const [id, note] of Object.entries(parsed.notes ?? {})) {
        notes[id] = normalizeNote(note);
      }
      const openIds = (parsed.openIds ?? []).filter((id) => notes[id]);
      if (Object.keys(notes).length === 0) return emptyStore();
      if (openIds.length === 0) openIds.push(Object.keys(notes)[0]);
      return { notes, openIds };
    }

    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const id = createNoteId();
      const note = normalizeNote(JSON.parse(legacy));
      const store = { notes: { [id]: note }, openIds: [id] };
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
      return store;
    }
  } catch {
    // fall through
  }
  return emptyStore();
}

function saveStore(store: NoteStore) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

function windowLabelFor(noteId: string) {
  return `note-${noteId}`;
}

function noteIdFromUrl() {
  return new URLSearchParams(window.location.search).get("id");
}

function setUrlNoteId(noteId: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("id", noteId);
  window.history.replaceState({}, "", url);
}

async function openNoteWindow(noteId: string, offset = { x: 28, y: 28 }) {
  const label = windowLabelFor(noteId);
  const existing = await WebviewWindow.getByLabel(label);
  if (existing) {
    await existing.setFocus();
    return existing;
  }

  let x: number | undefined;
  let y: number | undefined;
  try {
    const current = getCurrentWindow();
    const pos = await current.outerPosition();
    x = pos.x + offset.x;
    y = pos.y + offset.y;
  } catch {
    // ignore
  }

  return new WebviewWindow(label, {
    url: `index.html?id=${noteId}`,
    title: "便签",
    width: 360,
    height: 420,
    minWidth: 240,
    minHeight: 200,
    resizable: true,
    decorations: false,
    transparent: true,
    shadow: false,
    center: x === undefined,
    x,
    y,
  });
}

function displayTitle(state: Pick<NoteState, "emoji" | "title">) {
  return `${state.emoji} ${state.title}`.trim();
}

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

  const state = store.notes[noteId];

  const titleInput = document.querySelector<HTMLInputElement>("#note-title");
  const btnEmoji = document.querySelector<HTMLButtonElement>("#btn-emoji");
  const emojiPicker = document.querySelector<HTMLElement>("#emoji-picker");
  const btnEditTitle =
    document.querySelector<HTMLButtonElement>("#btn-edit-title");
  const editor = document.querySelector<HTMLTextAreaElement>("#editor");
  const settings = document.querySelector<HTMLElement>("#settings");
  const opacityInput = document.querySelector<HTMLInputElement>("#opacity");
  const opacityValue = document.querySelector<HTMLOutputElement>("#opacity-value");
  const bgColorInput = document.querySelector<HTMLInputElement>("#bg-color");
  const alwaysOnTopInput =
    document.querySelector<HTMLInputElement>("#always-on-top");
  const bgImageInput =
    document.querySelector<HTMLInputElement>("#bg-image-input");
  const btnNew = document.querySelector<HTMLButtonElement>("#btn-new");
  const btnPin = document.querySelector<HTMLButtonElement>("#btn-pin");
  const btnSettings = document.querySelector<HTMLButtonElement>("#btn-settings");
  const btnMinimize = document.querySelector<HTMLButtonElement>("#btn-minimize");
  const btnClose = document.querySelector<HTMLButtonElement>("#btn-close");
  const btnBgImage = document.querySelector<HTMLButtonElement>("#btn-bg-image");
  const btnClearBg = document.querySelector<HTMLButtonElement>("#btn-clear-bg");

  if (
    !titleInput ||
    !btnEmoji ||
    !emojiPicker ||
    !btnEditTitle ||
    !editor ||
    !settings ||
    !opacityInput ||
    !opacityValue ||
    !bgColorInput ||
    !alwaysOnTopInput ||
    !bgImageInput ||
    !btnNew ||
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
    store.notes[noteId] = state;
    saveStore(store);
  };

  const markClosed = () => {
    const latest = loadStore();
    latest.openIds = latest.openIds.filter((id) => id !== noteId);
    if (latest.openIds.length === 0 && Object.keys(latest.notes).length > 0) {
      // Keep at least one note marked open for next launch.
      latest.openIds = [noteId];
    }
    saveStore(latest);
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
  editor.value = state.content;
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
        await openNoteWindow(id, { x: 28 * (index + 1), y: 28 * (index + 1) });
      } catch (error) {
        console.error("failed to restore note window", id, error);
      }
    }
  }

  let saveTimer: number | undefined;

  btnNew.addEventListener("pointerdown", (event) => {
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

  editor.addEventListener("input", () => {
    state.content = editor.value;
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(persist, 200);
  });

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
    const id = createNoteId();
    const color = NOTE_COLORS[Object.keys(latest.notes).length % NOTE_COLORS.length];
    latest.notes[id] = {
      ...defaults,
      bgColor: color,
      title: `便签 ${Object.keys(latest.notes).length + 1}`,
    };
    if (!latest.openIds.includes(id)) latest.openIds.push(id);
    saveStore(latest);
    Object.assign(store, latest);
    try {
      await openNoteWindow(id);
    } catch (error) {
      console.error("failed to create note window", error);
      window.alert("新建便签失败，请重试");
    }
  });

  btnPin.addEventListener("click", async () => {
    await setAlwaysOnTop(!state.alwaysOnTop);
  });

  btnSettings.addEventListener("click", () => {
    const open = settings.hasAttribute("hidden");
    if (open) {
      settings.removeAttribute("hidden");
    } else {
      settings.setAttribute("hidden", "");
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
