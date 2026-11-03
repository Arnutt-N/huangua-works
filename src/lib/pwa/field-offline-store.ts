/**
 * src/lib/pwa/field-offline-store.ts
 *
 * ที่เก็บข้อมูลออฟไลน์สำหรับเจ้าหน้าที่ลงพื้นที่ (Field Staff IndexedDB Store)
 * ใช้บันทึกภาพถ่ายหลักฐาน (Before & After) และบันทึกข้อความภาคสนามขณะอยู่ในจุดอับสัญญาณ
 * พร้อมกลไก fallback ที่ปลอดภัยเมื่อทำงานในสภาพแวดล้อม SSR / Node.js
 */

export interface FieldDraft {
  id: string;
  kind: 'resolution_photo' | 'field_note';
  caseId?: string;
  queueBookingId?: string;
  title: string;
  content: string; // ข้อความบันทึก หรือ Data URL ของรูปภาพ
  tag: 'before' | 'after' | 'general';
  createdAt: string;
  synced: boolean;
  syncedAt?: string | null;
}

const DB_NAME = 'huangua_field_store';
const DB_VERSION = 1;
const STORE_NAME = 'field_drafts';

// In-memory fallback สำหรับ environment ที่ไม่มี IndexedDB (เช่น Node.js / SSR / Unit test)
let memoryStore: Map<string, FieldDraft> = new Map();

export function _resetMemoryStore(): void {
  memoryStore = new Map();
}

function getIndexedDB(): IDBFactory | null {
  if (typeof window !== 'undefined' && window.indexedDB) {
    return window.indexedDB;
  }
  if (typeof indexedDB !== 'undefined') {
    return indexedDB;
  }
  return null;
}

function openDatabase(): Promise<IDBDatabase> {
  const idb = getIndexedDB();
  if (!idb) {
    return Promise.reject(new Error('IndexedDB not supported'));
  }

  return new Promise((resolve, reject) => {
    const request = idb.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('synced', 'synced', { unique: false });
        store.createIndex('kind', 'kind', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function generateLocalId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `draft_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * บันทึกแบบร่างภาคสนามลงในเครื่อง (IndexedDB พร้อม Memory Fallback)
 */
export async function saveFieldDraft(
  data: Omit<FieldDraft, 'id' | 'createdAt' | 'synced'> & { id?: string; createdAt?: string },
): Promise<FieldDraft> {
  const draft: FieldDraft = {
    ...data,
    id: data.id || generateLocalId(),
    createdAt: data.createdAt || new Date().toISOString(),
    synced: false,
    syncedAt: null,
  };

  const idb = getIndexedDB();
  if (!idb) {
    memoryStore.set(draft.id, draft);
    return draft;
  }

  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(draft);
      req.onsuccess = () => resolve(draft);
      req.onerror = () => reject(req.error);
    });
  } catch {
    memoryStore.set(draft.id, draft);
    return draft;
  }
}

function sortDrafts(drafts: FieldDraft[]): FieldDraft[] {
  return drafts.sort((a, b) => {
    const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (diff !== 0) return diff;
    return b.id.localeCompare(a.id);
  });
}

/**
 * ดึงรายการแบบร่างภาคสนามทั้งหมด เรียงจากใหม่ไปเก่า
 */
export async function listFieldDrafts(): Promise<FieldDraft[]> {
  const idb = getIndexedDB();
  if (!idb) {
    return sortDrafts(Array.from(memoryStore.values()));
  }

  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = (req.result as FieldDraft[]) || [];
        // รวม draft ที่ค้างใน memoryStore (กรณีเขียน IDB ไม่สำเร็จ)
        if (memoryStore.size > 0) {
          const idbIds = new Set(list.map((d) => d.id));
          for (const [memId, memDraft] of memoryStore.entries()) {
            if (!idbIds.has(memId)) {
              list.push(memDraft);
            }
          }
        }
        resolve(sortDrafts(list));
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return sortDrafts(Array.from(memoryStore.values()));
  }
}

/**
 * ลบแบบร่างภาคสนามตาม ID
 */
export async function deleteFieldDraft(id: string): Promise<boolean> {
  const idb = getIndexedDB();
  if (!idb) {
    return memoryStore.delete(id);
  }

  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => {
        memoryStore.delete(id);
        resolve(true);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return memoryStore.delete(id);
  }
}

/**
 * ทำเครื่องหมายว่าแบบร่างนี้ได้ซิงค์ขึ้นเซิร์ฟเวอร์สำเร็จแล้ว
 */
export async function markFieldDraftSynced(id: string): Promise<boolean> {
  const idb = getIndexedDB();
  if (!idb) {
    const target = memoryStore.get(id);
    if (!target) return false;
    memoryStore.set(id, { ...target, synced: true, syncedAt: new Date().toISOString() });
    return true;
  }

  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const target = getReq.result as FieldDraft | undefined;
        if (!target) {
          const memTarget = memoryStore.get(id);
          if (memTarget) {
            memoryStore.set(id, { ...memTarget, synced: true, syncedAt: new Date().toISOString() });
            resolve(true);
            return;
          }
          resolve(false);
          return;
        }

        const updated: FieldDraft = {
          ...target,
          synced: true,
          syncedAt: new Date().toISOString(),
        };
        const putReq = store.put(updated);
        putReq.onsuccess = () => {
          memoryStore.delete(id);
          resolve(true);
        };
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  } catch {
    const target = memoryStore.get(id);
    if (!target) return false;
    memoryStore.set(id, { ...target, synced: true, syncedAt: new Date().toISOString() });
    return true;
  }
}
