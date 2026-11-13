import { invoke } from "@tauri-apps/api/core";
import { confirm } from "@tauri-apps/plugin-dialog";
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
  try {
    await invoke("init_window_chrome");
  } catch {
    // ignore in browser preview
  }

  const listEl = document.querySelector<HTMLTableSectionElement>("#note-list");
  const emptyEl = document.querySelector<HTMLElement>("#empty");
  const countEl = document.querySelector<HTMLElement>("#note-count");
  const searchInput = document.querySelector<HTMLInputElement>("#search");
  const checkAll = document.querySelector<HTMLInputElement>("#check-all");
  const btnNew = document.querySelector<HTMLButtonElement>("#btn-new");
  const btnBatchDelete =
    document.querySelector<HTMLButtonElement>("#btn-batch-delete");
  const btnRefresh = document.querySelector<HTMLButtonElement>("#btn-refresh");
  const btnClose = document.querySelector<HTMLButtonElement>("#btn-close");

  if (
    !listEl ||
    !emptyEl ||
    !countEl ||
    !searchInput ||
    !checkAll ||
    !btnNew ||
    !btnBatchDelete ||
    !btnRefresh ||
    !btnClose
  ) {
    return;
  }

  let selectedId: string | null = null;
  const checkedIds = new Set<string>();

  const syncBatchButton = () => {
    const count = checkedIds.size;
    btnBatchDelete.disabled = count === 0;
    btnBatchDelete.textContent = count > 0 ? `删除所选 (${count})` : "删除所选";
  };

  const render = () => {
    const store = loadStore();
    const query = searchInput.value.trim().toLowerCase();
    const rows = listNotes(store).filter(({ note }) => {
      if (!query) return true;
      const haystack = `${note.emoji} ${note.title} ${note.content}`.toLowerCase();
      return haystack.includes(query);
    });

    // Drop checks that no longer exist / are filtered out of current view optionally keep
    const visibleIds = new Set(rows.map((row) => row.id));
    for (const id of [...checkedIds]) {
      if (!store.notes[id]) checkedIds.delete(id);
    }

    countEl.textContent = `${Object.keys(store.notes).length} 条`;
    listEl.replaceChildren();
    const isEmpty = rows.length === 0;
    emptyEl.classList.toggle("is-visible", isEmpty);
    emptyEl.hidden = !isEmpty;
    emptyEl.setAttribute("aria-hidden", String(!isEmpty));

    const visibleChecked = rows.filter((row) => checkedIds.has(row.id)).length;
    checkAll.checked = rows.length > 0 && visibleChecked === rows.length;
    checkAll.indeterminate =
      visibleChecked > 0 && visibleChecked < rows.length;

    for (const { id, note } of rows) {
      const open = store.openIds.includes(id);
      const tr = document.createElement("tr");
      if (selectedId === id) tr.classList.add("is-selected");
      if (checkedIds.has(id)) tr.classList.add("is-checked");

      tr.innerHTML = `
        <td class="col-check"></td>
        <td class="col-icon"><span class="note-emoji">${note.emoji}</span></td>
        <td class="col-title"><div class="note-title-cell"></div></td>
        <td class="col-preview"><div class="note-preview-cell"></div></td>
        <td class="col-status"></td>
        <td class="col-updated updated-cell"></td>
        <td class="col-actions"><div class="row-actions"></div></td>
      `;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = checkedIds.has(id);
      checkbox.setAttribute("aria-label", `选择 ${note.title}`);
      checkbox.addEventListener("click", (event) => {
        event.stopPropagation();
      });
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) checkedIds.add(id);
        else checkedIds.delete(id);
        selectedId = id;
        render();
      });
      tr.querySelector(".col-check")!.append(checkbox);

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
        await deleteNotes([id]);
      });

      actions.append(openBtn, deleteBtn);

      tr.addEventListener("click", (event) => {
        const target = event.target as HTMLElement;
        if (target.closest("input, button")) return;
        selectedId = id;
        render();
      });

      tr.addEventListener("dblclick", async (event) => {
        const target = event.target as HTMLElement;
        if (target.closest("input, button")) return;
        await openNote(id);
      });

      tr.title = displayTitle(note);
      listEl.append(tr);
    }

    syncBatchButton();
    void visibleIds;
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

  const deleteNotes = async (ids: string[]) => {
    const uniqueIds = [...new Set(ids)].filter(Boolean);
    if (uniqueIds.length === 0) return;

    const store = loadStore();
    const titles = uniqueIds
      .map((id) => store.notes[id])
      .filter(Boolean)
      .map((note) => displayTitle(note));

    if (titles.length === 0) return;

    const message =
      uniqueIds.length === 1
        ? `删除「${titles[0]}」？此操作不可恢复。`
        : `删除选中的 ${uniqueIds.length} 条便签？此操作不可恢复。`;

    const ok = await confirm(message, {
      title: "删除便签",
      kind: "warning",
      okLabel: "删除",
      cancelLabel: "取消",
    });
    if (!ok) return;

    for (const id of uniqueIds) {
      try {
        await closeNoteWindow(id);
      } catch {
        // window may already be closed
      }
    }

    const latest = loadStore();
    for (const id of uniqueIds) {
      delete latest.notes[id];
      checkedIds.delete(id);
      if (selectedId === id) selectedId = null;
    }
    latest.openIds = latest.openIds.filter((id) => Boolean(latest.notes[id]));
    saveStore(latest);
    render();
  };

  checkAll.addEventListener("change", () => {
    const store = loadStore();
    const query = searchInput.value.trim().toLowerCase();
    const rows = listNotes(store).filter(({ note }) => {
      if (!query) return true;
      const haystack = `${note.emoji} ${note.title} ${note.content}`.toLowerCase();
      return haystack.includes(query);
    });

    if (checkAll.checked) {
      for (const row of rows) checkedIds.add(row.id);
    } else {
      for (const row of rows) checkedIds.delete(row.id);
    }
    render();
  });

  btnBatchDelete.addEventListener("click", async () => {
    await deleteNotes([...checkedIds]);
  });

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
