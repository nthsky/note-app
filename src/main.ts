import { getCurrentWindow } from "@tauri-apps/api/window";

const STORAGE_KEY = "sticky-note-v1";

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

function loadState(): NoteState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    const parsed = { ...defaults, ...JSON.parse(raw) } as NoteState & {
      title?: string;
      emoji?: string;
    };

    // Migrate older saves that stored emoji inside title.
    if (!parsed.emoji || parsed.emoji === defaults.emoji) {
      const match = String(parsed.title ?? "").match(emojiPrefixPattern);
      if (match) {
        parsed.emoji = match[1];
        parsed.title = String(parsed.title).slice(match[0].length).trim() || defaults.title;
      }
    }

    return {
      ...defaults,
      ...parsed,
      emoji: parsed.emoji || defaults.emoji,
      title: parsed.title || defaults.title,
    };
  } catch {
    return { ...defaults };
  }
}

function saveState(state: NoteState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
  const state = loadState();

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
    !btnPin ||
    !btnSettings ||
    !btnMinimize ||
    !btnClose ||
    !btnBgImage ||
    !btnClearBg
  ) {
    return;
  }

  const persist = () => saveState(state);

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

  const titleMeasureCanvas = document.createElement("canvas");
  const fitTitleWidth = () => {
    const value = titleInput.value || defaults.title;
    const ctx = titleMeasureCanvas.getContext("2d");
    if (!ctx) {
      titleInput.style.width = `${Math.max(value.length, 2)}ch`;
      return;
    }
    const style = window.getComputedStyle(titleInput);
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const textWidth = ctx.measureText(value).width;
    const pad =
      Number.parseFloat(style.paddingLeft) +
      Number.parseFloat(style.paddingRight) +
      Number.parseFloat(style.borderLeftWidth) +
      Number.parseFloat(style.borderRightWidth);
    titleInput.style.width = `${Math.ceil(textWidth + pad + 2)}px`;
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

  let saveTimer: number | undefined;

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
  btnClose.addEventListener("click", () => appWindow.close());

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
