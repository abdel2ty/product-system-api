import { ulid } from 'ulid';
import { store } from '../store/ProductStore.js';
import { sheetsClient } from '../integrations/sheets/client.js';
import { SHEETS, rowRange, dataRange } from '../integrations/sheets/schema.js';
import { serialiseCategory } from '../integrations/sheets/mapper.js';
import { conflict, notFound, badRequest } from '../utils/errors.js';
import { reassignCategory } from './productService.js';

const now = () => new Date().toISOString();
const key = (s) => String(s ?? '').trim().toLowerCase();

function present(category) {
  return {
    id: category.id,
    name: category.name,
    code: category.code,
    description: category.description,
    sortOrder: category.sortOrder,
    productCount: store.countInCategory(category.id),
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

export async function listCategories() {
  await store.ready();
  return [...store.categories.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map(present);
}

function assertNameFree(name, code, excludeId) {
  for (const c of store.categories.values()) {
    if (c.id === excludeId) continue;
    if (key(c.name) === key(name)) throw conflict(`"${c.name}" already exists.`, 'name');
    if (key(c.code) === key(code)) throw conflict(`The code ${c.code} is used by "${c.name}".`, 'code');
  }
}

export async function createCategory(input) {
  await store.ready();
  return store.writeLock.run(async () => {
    assertNameFree(input.name, input.code);
    const timestamp = now();
    const category = {
      ...input,
      id: ulid(),
      code: input.code.toUpperCase(),
      sortOrder: input.sortOrder || store.categories.size + 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
      rowNumber: null,
    };
    const rowNumber = await sheetsClient.append(dataRange(SHEETS.categories), serialiseCategory(category));
    category.rowNumber = rowNumber ?? store.lastCategoryRow + 1;
    store.lastCategoryRow = category.rowNumber;
    store.categories.set(category.id, category);
    store.reindex();
    return present(category);
  });
}

export async function updateCategory(id, input) {
  await store.ready();
  const current = store.categories.get(id);
  if (!current) throw notFound('That category no longer exists.');

  return store.writeLock.run(async () => {
    const merged = { ...current, ...input, id, rowNumber: current.rowNumber };
    if (merged.code) merged.code = merged.code.toUpperCase();
    assertNameFree(merged.name, merged.code, id);
    merged.updatedAt = now();
    await sheetsClient.updateRow(rowRange(SHEETS.categories, current.rowNumber), serialiseCategory(merged));
    store.categories.set(id, merged);
    store.reindex();
    return present(merged);
  });
}

export async function deleteCategory(id) {
  await store.ready();
  const current = store.categories.get(id);
  if (!current) throw notFound('That category no longer exists.');

  const count = store.countInCategory(id);
  if (count > 0) {
    throw conflict(
      `"${current.name}" still holds ${count} product${count === 1 ? '' : 's'}. Move them to another category first.`,
    );
  }

  return store.writeLock.run(async () => {
    const removed = { ...current, deletedAt: now(), updatedAt: now() };
    await sheetsClient.updateRow(rowRange(SHEETS.categories, current.rowNumber), serialiseCategory(removed));
    store.categories.delete(id);
    store.reindex();
    return { id, deleted: true };
  });
}

/** Moves every product across, then removes the now-empty category. */
export async function mergeCategory(fromId, toId) {
  await store.ready();
  if (fromId === toId) throw badRequest('Choose a different category to merge into.');
  const from = store.categories.get(fromId);
  const to = store.categories.get(toId);
  if (!from || !to) throw notFound('One of those categories no longer exists.');

  const moved = await store.writeLock.run(() => reassignCategory(fromId, toId));
  await deleteCategory(fromId);
  return { moved, into: present(store.categories.get(toId)) };
}

export async function reorderCategories(ids) {
  await store.ready();
  return store.writeLock.run(async () => {
    const entries = [];
    ids.forEach((id, index) => {
      const category = store.categories.get(id);
      if (!category) return;
      const updated = { ...category, sortOrder: index + 1, updatedAt: now() };
      store.categories.set(id, updated);
      entries.push({ range: rowRange(SHEETS.categories, category.rowNumber), row: serialiseCategory(updated) });
    });
    if (entries.length) await sheetsClient.writeRanges(entries);
    return listCategories();
  });
}
