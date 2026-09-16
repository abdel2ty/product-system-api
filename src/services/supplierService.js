import { ulid } from 'ulid';
import { store } from '../store/ProductStore.js';
import { sheetsClient } from '../integrations/sheets/client.js';
import { SHEETS, rowRange, dataRange } from '../integrations/sheets/schema.js';
import { serialiseSupplier } from '../integrations/sheets/mapper.js';
import { conflict, notFound, badRequest } from '../utils/errors.js';
import { reassignSupplier } from './productService.js';

const now = () => new Date().toISOString();
const key = (s) => String(s ?? '').trim().toLowerCase();

function present(supplier) {
  return {
    id: supplier.id,
    name: supplier.name,
    description: supplier.description,
    sortOrder: supplier.sortOrder,
    productCount: store.countInSupplier(supplier.id),
    createdAt: supplier.createdAt,
    updatedAt: supplier.updatedAt,
  };
}

export async function listSuppliers() {
  await store.ready();
  return [...store.suppliers.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map(present);
}

function assertNameFree(name, excludeId) {
  for (const s of store.suppliers.values()) {
    if (s.id === excludeId) continue;
    if (key(s.name) === key(name)) throw conflict(`"${s.name}" already exists.`, 'name');
  }
}

export async function createSupplier(input) {
  await store.ready();
  return store.writeLock.run(async () => {
    assertNameFree(input.name);
    const timestamp = now();
    const supplier = {
      ...input,
      id: ulid(),
      sortOrder: input.sortOrder || store.suppliers.size + 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
      rowNumber: null,
    };
    const rowNumber = await sheetsClient.append(dataRange(SHEETS.suppliers), serialiseSupplier(supplier));
    supplier.rowNumber = rowNumber ?? store.lastSupplierRow + 1;
    store.lastSupplierRow = supplier.rowNumber;
    store.suppliers.set(supplier.id, supplier);
    return present(supplier);
  });
}

export async function updateSupplier(id, input) {
  await store.ready();
  const current = store.suppliers.get(id);
  if (!current) throw notFound('That supplier no longer exists.');

  return store.writeLock.run(async () => {
    const merged = { ...current, ...input, id, rowNumber: current.rowNumber };
    assertNameFree(merged.name, id);
    merged.updatedAt = now();
    await sheetsClient.updateRow(rowRange(SHEETS.suppliers, current.rowNumber), serialiseSupplier(merged));
    store.suppliers.set(id, merged);
    return present(merged);
  });
}

export async function deleteSupplier(id) {
  await store.ready();
  const current = store.suppliers.get(id);
  if (!current) throw notFound('That supplier no longer exists.');

  const count = store.countInSupplier(id);
  if (count > 0) {
    throw conflict(
      `"${current.name}" still has ${count} product${count === 1 ? '' : 's'}. Move them to another supplier first.`,
    );
  }

  return store.writeLock.run(async () => {
    const removed = { ...current, deletedAt: now(), updatedAt: now() };
    await sheetsClient.updateRow(rowRange(SHEETS.suppliers, current.rowNumber), serialiseSupplier(removed));
    store.suppliers.delete(id);
    return { id, deleted: true };
  });
}

/** Moves every product across, then removes the now-empty supplier. */
export async function mergeSupplier(fromId, toId) {
  await store.ready();
  if (fromId === toId) throw badRequest('Choose a different supplier to merge into.');
  const from = store.suppliers.get(fromId);
  const to = store.suppliers.get(toId);
  if (!from || !to) throw notFound('One of those suppliers no longer exists.');

  const moved = await store.writeLock.run(() => reassignSupplier(fromId, toId));
  await deleteSupplier(fromId);
  return { moved, into: present(store.suppliers.get(toId)) };
}
