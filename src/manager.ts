import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  createBlankNote,
  displayTitle,
  formatUpdatedAt,
  listNotes,
  loadStore,
  previewText,
  saveStore,
} from "./store";
import { closeNoteWindow, openNoteWindow } from "./windows";

async function main() {
  const appWindow = getCurrentWindow();
  const listEl = document.querySelector<HTMLTableSectionElement>("#note-list");
  const emptyEl = document.querySelector<HTMLElement>("#empty");
  const countEl = document.querySelector<HTMLElement>("#note-count");
  const searchInput = document.querySelector<HTMLInputElement>("#search");
  const btnNew = document.querySelector<HTMLButtonElement>("#btn-new");
  const btnRefresh = document.querySelector<HTMLButtonElement>("#btn-refresh");
  const btnClose = document.querySelector<HTMLButtonElement>("#btn-close");

  if (
    !listEl ||
    !emptyEl ||
    !countEl ||
    !searchInput ||
    !btnNew ||
    !btnRefresh ||
    !btnClose
  ) {
    return;
  }

  let selectedId: string | null = null;

  const render = () => {
    const store = loadStore();
    const query = searchInput.value.trim().toLowerCase();
    const rows = listNotes(store).filter(({ note }) => {
      if (!query) return true;
      const haystack = `${note.emoji} ${note.title} ${note.content}`.toLowerCase();
      return haystack.includes(query);
    });

    countEl.textContent = `${Object.keys(store.notes).length} 条`;
    listEl.replaceChildren();
    emptyEl.hidden = rows.length > 0;

    for (const { id, note } of rows) {
      const open = store.openIds.includes(id);
      const tr = document.createElement("tr");
      if (selectedId === id) tr.classList.add("is-selected");

      tr.innerHTML = `
        <td class="col-icon"><span class="note-emoji">${note.emoji}</span></td>
        <td class="col-title"><div class="note-title-cell"></div></td>
        <td class="col-preview"><div class="note-preview-cell"></div></td>
        <td class="col-status"></td>
        <td class="col-updated updated-cell"></td>
        <td class="col-actions"><div class="row-actions"></div></td>
      `;

      tr.querySelector(".note-title-cell")!.textContent = note.title;
      tr.querySelector(".note-preview-cell")!.textContent = previewText(
        note.content,
      );
      tr.querySelector(".updated-cell")!.textContent = formatUpdatedAt(
        note.updatedAt,
      );

      const status = document.createElement("span");
      status.className = `status-pill ${open ? "open" : "closed"}`;
      status.textContent = open ? "打开中" : "已关闭";
      tr.querySelector(".col-status")!.append(status);

      const actions = tr.querySelector(".row-actions")!;
      const openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.className = "row-btn open";
      openBtn.textContent = open ? "前置" : "打开";
      openBtn.addEventListener("click", async (event) => {
        event.stopPropagation();
        await openNote(id);
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "row-btn danger";
      deleteBtn.textContent = "删除";
      deleteBtn.addEventListener("click", async (event) => {
        event.stopPropagation();
        await deleteNote(id);
      });

      actions.append(openBtn, deleteBtn);

      tr.addEventListener("click", () => {
        selectedId = id;
        render();
      });

      tr.addEventListener("dblclick", async () => {
        await openNote(id);
      });

      tr.title = displayTitle(note);
      listEl.append(tr);
    }
  };

  const openNote = async (id: string) => {
    const store = loadStore();
    if (!store.notes[id]) return;
    if (!store.openIds.includes(id)) {
      store.openIds.push(id);
      saveStore(store);
    }
    await openNoteWindow(id, { placement: "center", focus: true });
    render();
  };

  const deleteNote = async (id: string) => {
    const store = loadStore();
    const note = store.notes[id];
    if (!note) return;
    const ok = window.confirm(`删除「${displayTitle(note)}」？此操作不可恢复。`);
    if (!ok) return;

    try {
      await closeNoteWindow(id);
    } catch {
      // window may already be closed
    }

    delete store.notes[id];
    store.openIds = store.openIds.filter((item) => item !== id);
    saveStore(store);
    if (selectedId === id) selectedId = null;
    render();
  };

  btnNew.addEventListener("click", async () => {
    const created = createBlankNote(loadStore());
    saveStore(created.store);
    await openNoteWindow(created.id, { placement: "center", focus: true });
    selectedId = created.id;
    render();
  });

  btnRefresh.addEventListener("click", () => render());
  searchInput.addEventListener("input", () => render());
  btnClose.addEventListener("click", () => appWindow.destroy());

  window.addEventListener("storage", (event) => {
    if (event.key === null || event.key === "sticky-notes-v2") render();
  });
  window.addEventListener("focus", () => render());

  render();
}

window.addEventListener("DOMContentLoaded", () => {
  void main();
});
