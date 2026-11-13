import { getCurrentWindow } from "@tauri-apps/api/window";

const STORAGE_KEY = "sticky-note-v1";

type NoteState = {
  content: string;
  opacity: number;
  bgColor: string;
  bgImage: string | null;
  alwaysOnTop: boolean;
};

const defaults: NoteState = {
  content: "",
  opacity: 92,
  bgColor: "#ffe08a",
  bgImage: null,
  alwaysOnTop: false,
};

function loadState(): NoteState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return { ...defaults };
  }
}

function saveState(state: NoteState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
  const note = document.getElementById("app");
  if (!note) return;

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

  editor.value = state.content;
  opacityInput.value = String(state.opacity);
  opacityValue.value = `${state.opacity}%`;
  bgColorInput.value = state.bgColor;
  applyTheme(state);
  await setAlwaysOnTop(state.alwaysOnTop);

  let saveTimer: number | undefined;
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
