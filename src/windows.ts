import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

export function windowLabelFor(noteId: string) {
  return `note-${noteId}`;
}

export const MANAGER_LABEL = "manager";

const WINDOW_BIND_PREFIX = "note-window-bind:";

export function bindWindowToNote(windowLabel: string, noteId: string) {
  localStorage.setItem(`${WINDOW_BIND_PREFIX}${windowLabel}`, noteId);
}

export function unbindWindow(windowLabel: string) {
  localStorage.removeItem(`${WINDOW_BIND_PREFIX}${windowLabel}`);
}

export async function findWindowForNote(noteId: string) {
  const labeled = await WebviewWindow.getByLabel(windowLabelFor(noteId));
  if (labeled) return labeled;

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(WINDOW_BIND_PREFIX)) continue;
    if (localStorage.getItem(key) !== noteId) continue;
    const label = key.slice(WINDOW_BIND_PREFIX.length);
    const win = await WebviewWindow.getByLabel(label);
    if (win) return win;
  }
  return null;
}

export async function closeNoteWindow(noteId: string) {
  const wins = new Set<WebviewWindow>();
  const labeled = await WebviewWindow.getByLabel(windowLabelFor(noteId));
  if (labeled) wins.add(labeled);

  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(WINDOW_BIND_PREFIX)) continue;
    if (localStorage.getItem(key) !== noteId) continue;
    const label = key.slice(WINDOW_BIND_PREFIX.length);
    const win = await WebviewWindow.getByLabel(label);
    if (win) wins.add(win);
    localStorage.removeItem(key);
  }

  for (const win of wins) {
    try {
      await win.destroy();
    } catch {
      // ignore
    }
  }
}

async function positionRelativeToCurrent(
  placement: "below" | "cascade",
  index = 0,
) {
  const current = getCurrentWindow();
  const scale = await current.scaleFactor();
  const pos = await current.outerPosition();
  const size = await current.outerSize();
  const x = pos.x / scale;
  const y = pos.y / scale;
  const width = size.width / scale;
  const height = size.height / scale;
  const gap = 16;

  if (placement === "below") {
    return { x, y: y + height + gap, width, height };
  }

  const stepX = Math.max(48, Math.round(width * 0.15));
  const stepY = Math.max(48, Math.round(height * 0.15));
  return {
    x: x + stepX * (index + 1),
    y: y + stepY * (index + 1),
    width,
    height,
  };
}

export async function openNoteWindow(
  noteId: string,
  options: {
    placement?: "below" | "cascade" | "center";
    cascadeIndex?: number;
    focus?: boolean;
  } = {},
) {
  const placement = options.placement ?? "below";
  const focus = options.focus ?? false;
  const label = windowLabelFor(noteId);
  const existing = await findWindowForNote(noteId);
  if (existing) {
    if (focus) {
      await existing.show();
      await existing.setFocus();
    }
    return existing;
  }

  let x: number | undefined;
  let y: number | undefined;
  let width = 360;
  let height = 420;
  let center = placement === "center";

  if (placement !== "center") {
    try {
      const pos = await positionRelativeToCurrent(
        placement,
        options.cascadeIndex ?? 0,
      );
      x = pos.x;
      y = pos.y;
      width = Math.round(pos.width);
      height = Math.round(pos.height);
      center = false;
    } catch {
      center = true;
    }
  }

  const win = new WebviewWindow(label, {
    url: `index.html?id=${noteId}`,
    title: "便签",
    width,
    height,
    minWidth: 240,
    minHeight: 200,
    resizable: true,
    decorations: false,
    transparent: true,
    shadow: false,
    focus,
    visible: true,
    center,
    x,
    y,
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => resolve(), 1500);
    win.once("tauri://created", () => {
      window.clearTimeout(timeout);
      resolve();
    });
    win.once("tauri://error", (event) => {
      window.clearTimeout(timeout);
      reject(event);
    });
  });

  if (focus) {
    await win.show();
    await win.setFocus();
  }

  return win;
}

export async function openManagerWindow() {
  const existing = await WebviewWindow.getByLabel(MANAGER_LABEL);
  if (existing) {
    await existing.show();
    await existing.setFocus();
    return existing;
  }

  const win = new WebviewWindow(MANAGER_LABEL, {
    url: "manager.html",
    title: "便签管理",
    width: 720,
    height: 520,
    minWidth: 520,
    minHeight: 360,
    resizable: true,
    decorations: false,
    transparent: true,
    shadow: false,
    center: true,
    focus: true,
    visible: true,
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => resolve(), 1500);
    win.once("tauri://created", () => {
      window.clearTimeout(timeout);
      resolve();
    });
    win.once("tauri://error", (event) => {
      window.clearTimeout(timeout);
      reject(event);
    });
  });

  await win.show();
  await win.setFocus();
  return win;
}
