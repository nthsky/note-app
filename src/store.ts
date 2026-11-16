export const STORE_KEY = "sticky-notes-v2";
export const LEGACY_KEY = "sticky-note-v1";

export const NOTE_COLORS = [
  "#ffe08a",
  "#ffc9c9",
  "#c3e6cb",
  "#c5d8ff",
  "#f3d9ff",
  "#ffe2c6",
];

export type NoteState = {
  emoji: string;
  title: string;
  content: string;
  opacity: number;
  bgColor: string;
  bgImage: string | null;
  alwaysOnTop: boolean;
  updatedAt: number;
  createdAt: number;
};

export type NoteStore = {
  notes: Record<string, NoteState>;
  openIds: string[];
};

export const defaults: NoteState = {
  emoji: "📝",
  title: "便签",
  content: "",
  opacity: 92,
  bgColor: "#ffe08a",
  bgImage: null,
  alwaysOnTop: false,
  updatedAt: Date.now(),
  createdAt: Date.now(),
};

const emojiPrefixPattern =
  /^(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)\s*/u;

export function createNoteId() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

export function displayTitle(state: Pick<NoteState, "emoji" | "title">) {
  return `${state.emoji} ${state.title}`.trim();
}

export function normalizeNote(
  input: Partial<NoteState> | null | undefined,
): NoteState {
  const now = Date.now();
  const parsed = { ...defaults, createdAt: now, updatedAt: now, ...(input ?? {}) };
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
    createdAt: parsed.createdAt || now,
    updatedAt: parsed.updatedAt || now,
  };
}

export function emptyStore(): NoteStore {
  const id = createNoteId();
  const now = Date.now();
  return {
    notes: {
      [id]: {
        ...defaults,
        createdAt: now,
        updatedAt: now,
      },
    },
    openIds: [id],
  };
}

export function loadStore(): NoteStore {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as NoteStore;
      const notes: Record<string, NoteState> = {};
      for (const [id, note] of Object.entries(parsed.notes ?? {})) {
        notes[id] = normalizeNote(note);
      }
      const openIds = (parsed.openIds ?? []).filter((id) => Boolean(notes[id]));
      if (Object.keys(notes).length === 0) return emptyStore();
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

export function saveStore(store: NoteStore) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

export function touchNote(note: NoteState): NoteState {
  return { ...note, updatedAt: Date.now() };
}

export function listNotes(store: NoteStore) {
  return Object.entries(store.notes)
    .map(([id, note]) => ({ id, note }))
    .sort((a, b) => b.note.updatedAt - a.note.updatedAt);
}

export function createBlankNote(store: NoteStore): { id: string; store: NoteStore } {
  const id = createNoteId();
  const now = Date.now();
  const color = NOTE_COLORS[Object.keys(store.notes).length % NOTE_COLORS.length];
  const next: NoteStore = {
    notes: {
      ...store.notes,
      [id]: {
        ...defaults,
        bgColor: color,
        title: `便签 ${Object.keys(store.notes).length + 1}`,
        createdAt: now,
        updatedAt: now,
      },
    },
    openIds: store.openIds.includes(id) ? store.openIds : [...store.openIds, id],
  };
  return { id, store: next };
}

export function stripHtml(content: string) {
  if (!content) return "";
  if (!/<\/?[a-z][\s\S]*>/i.test(content)) {
    return content.replace(/\s+/g, " ").trim();
  }
  return content
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(div|p|li|h[1-6])>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function previewText(content: string, max = 48) {
  const text = stripHtml(content);
  if (!text) return "空便签";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function formatUpdatedAt(ts: number) {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString();
  }
}
