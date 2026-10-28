import { db, doc, setDoc, onSnapshot, writeBatch } from '../firebase';
import {
  Personnel,
  Puantaj,
  Mesai,
  PersonelOdeme,
  Santiye,
  SantiyeGider,
  Taseron,
  Firma,
  FirmaCari,
  Cek,
  OdemeYontemi,
  KrediKarti,
  KrediKartiHarcama,
  AppUser,
} from '../types';
import {
  INITIAL_PERSONNEL,
  INITIAL_SANTIYELER,
  INITIAL_TASERONLAR,
  INITIAL_FIRMALAR,
  INITIAL_FIRMA_CARI,
  INITIAL_CEKLER,
  INITIAL_SANTIYE_GIDERLERI,
  INITIAL_MESAI,
  INITIAL_PERSONEL_ODEMELERI,
  INITIAL_ODEME_YONTEMLERI,
  INITIAL_PUANTAJ,
  INITIAL_KREDI_KARTLARI,
  INITIAL_KART_HARCAMALARI,
  INITIAL_USERS,
  DEFAULT_SANTIYE_GIDER_KATEGORILERI,
  getStoredData,
  setStoredData,
} from '../utils/storage';

export const FIRESTORE_COLLECTION = 'santiye_erp_v3';

export type SyncStatus = 'connected' | 'syncing' | 'error' | 'offline';

export interface ErpDatabaseState {
  personnel: Personnel[];
  puantaj: Puantaj[];
  mesai: Mesai[];
  odemeler: PersonelOdeme[];
  santiyeler: Santiye[];
  giderler: SantiyeGider[];
  taseronlar: Taseron[];
  firmalar: Firma[];
  cari: FirmaCari[];
  cekler: Cek[];
  odeme_yontemleri: OdemeYontemi[];
  gider_kategorileri: string[];
  kredi_kartlari: KrediKarti[];
  kart_harcamalari: KrediKartiHarcama[];
  users: AppUser[];
}

export type ModuleKey = keyof ErpDatabaseState;

export const CLIENT_SESSION_ID =
  'client_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);

// Initial defaults map for all modules
export const MODULE_DEFAULTS: Record<ModuleKey, any> = {
  personnel: INITIAL_PERSONNEL,
  puantaj: INITIAL_PUANTAJ,
  mesai: INITIAL_MESAI,
  odemeler: INITIAL_PERSONEL_ODEMELERI,
  santiyeler: INITIAL_SANTIYELER,
  giderler: INITIAL_SANTIYE_GIDERLERI,
  taseronlar: INITIAL_TASERONLAR,
  firmalar: INITIAL_FIRMALAR,
  cari: INITIAL_FIRMA_CARI,
  cekler: INITIAL_CEKLER,
  odeme_yontemleri: INITIAL_ODEME_YONTEMLERI,
  gider_kategorileri: DEFAULT_SANTIYE_GIDER_KATEGORILERI,
  kredi_kartlari: INITIAL_KREDI_KARTLARI,
  kart_harcamalari: INITIAL_KART_HARCAMALARI,
  users: INITIAL_USERS,
};

// Clean/Empty state map for resetting all data to zero records
export const MODULE_EMPTY: Record<ModuleKey, any> = {
  personnel: [],
  puantaj: [],
  mesai: [],
  odemeler: [],
  santiyeler: [],
  giderler: [],
  taseronlar: [],
  firmalar: [],
  cari: [],
  cekler: [],
  odeme_yontemleri: INITIAL_ODEME_YONTEMLERI,
  gider_kategorileri: DEFAULT_SANTIYE_GIDER_KATEGORILERI,
  kredi_kartlari: [],
  kart_harcamalari: [],
  users: INITIAL_USERS,
};

export const VALID_MODULE_KEYS: ModuleKey[] = [
  'personnel',
  'puantaj',
  'mesai',
  'odemeler',
  'santiyeler',
  'giderler',
  'taseronlar',
  'firmalar',
  'cari',
  'cekler',
  'odeme_yontemleri',
  'gider_kategorileri',
  'kredi_kartlari',
  'kart_harcamalari',
  'users',
];

// In-memory cache of the latest confirmed remote items for each module
const latestRemoteItems: Partial<Record<ModuleKey, any[]>> = {};

// In-memory timestamp tracking the latest known version for each module from ANY source
const moduleTimestamps: Partial<Record<ModuleKey, number>> = {};

// In-memory timestamp tracking when each module was last modified by THIS client
const lastLocalWriteTimestamps: Partial<Record<ModuleKey, number>> = {};

// Flag indicating if cloud Firestore has exhausted its daily write quota (429/RESOURCE_EXHAUSTED)
let isFirestoreQuotaExhausted = false;
let lastQuotaProbeTime = 0;

// Explicitly deleted item IDs tracked to ensure deletions are honored across syncs
const deletedItemIds: Record<ModuleKey, Set<string>> = {
  personnel: new Set(),
  puantaj: new Set(),
  mesai: new Set(),
  odemeler: new Set(),
  santiyeler: new Set(),
  giderler: new Set(),
  taseronlar: new Set(),
  firmalar: new Set(),
  cari: new Set(),
  cekler: new Set(),
  odeme_yontemleri: new Set(),
  gider_kategorileri: new Set(),
  kredi_kartlari: new Set(),
  kart_harcamalari: new Set(),
  users: new Set(),
};

/**
 * Marks an item as explicitly deleted so smart reconciliation will not resurrect it.
 */
export function markItemDeleted(moduleKey: ModuleKey, itemId: string) {
  if (deletedItemIds[moduleKey] && itemId) {
    deletedItemIds[moduleKey].add(itemId);
  }
}

// Cross-tab / cross-window real-time BroadcastChannel
const syncChannel =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('santiye_erp_realtime_broadcast')
    : null;

// Unique identifier resolver for each entity type
export function getItemKey(moduleKey: ModuleKey, item: any): string {
  if (!item) return '';
  if (typeof item === 'string') return item;
  if (moduleKey === 'puantaj') {
    return `${item.personelId || ''}_${item.tarih || ''}`;
  }
  if (moduleKey === 'mesai') {
    if (item.personelId && item.tarih) {
      return `${item.personelId}_${item.tarih}`;
    }
    return item.id || '';
  }
  if (moduleKey === 'odeme_yontemleri') {
    return item.id || item.isim || '';
  }
  return item.id || '';
}

/**
 * Smart merge between locally modified items and incoming remote items.
 * Preserves items added or edited locally while integrating new remote records.
 */
export function mergeModuleItems<T>(
  moduleKey: ModuleKey,
  localItems: T[],
  remoteItems: T[],
  deletedIds: Set<string>
): T[] {
  if (!Array.isArray(localItems)) return remoteItems || [];
  if (!Array.isArray(remoteItems) || remoteItems.length === 0) {
    return localItems.filter((i) => !deletedIds.has(getItemKey(moduleKey, i)));
  }

  const localMap = new Map<string, T>();
  localItems.forEach((item) => {
    const k = getItemKey(moduleKey, item);
    const itemId = (item as any)?.id ? String((item as any).id) : '';
    if (k && !deletedIds.has(k) && (!itemId || !deletedIds.has(itemId))) {
      localMap.set(k, item);
    }
  });

  const merged: T[] = [...localItems.filter((i) => {
    const k = getItemKey(moduleKey, i);
    const itemId = (i as any)?.id ? String((i as any).id) : '';
    return !deletedIds.has(k) && (!itemId || !deletedIds.has(itemId));
  })];

  // Any item in remote that is NOT in localMap and NOT explicitly deleted was added by another user
  remoteItems.forEach((remoteItem) => {
    const k = getItemKey(moduleKey, remoteItem);
    const itemId = (remoteItem as any)?.id ? String((remoteItem as any).id) : '';
    if (k && !localMap.has(k) && !deletedIds.has(k) && (!itemId || !deletedIds.has(itemId))) {
      merged.push(remoteItem);
    }
  });

  return merged;
}

/**
 * Optimizes puantaj items by validating entries and ensuring valid date and person format.
 * Preserves all user-marked states including 'Boş'.
 */
export function optimizePuantajItems(items: Puantaj[]): Puantaj[] {
  if (!Array.isArray(items)) return items;
  return items.filter((item) => !!item && !!item.personelId && !!item.tarih);
}

// Strips undefined fields which Firestore rejects
function sanitizeForFirestore<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

// Debounce timer map for saving
const debounceTimers: Partial<Record<ModuleKey, ReturnType<typeof setTimeout>>> = {};

/**
 * Saves a specific module's data with smart non-destructive merging.
 * Never overwrites records added by other simultaneous users.
 * Immediately syncs across Applet Server SSE, LocalStorage, BroadcastChannel, and Firestore.
 */
export async function saveModuleToFirestore<K extends ModuleKey>(
  key: K,
  data: ErpDatabaseState[K],
  immediate = true,
  onStatusChange?: (status: SyncStatus) => void
): Promise<void> {
  const now = Date.now();
  lastLocalWriteTimestamps[key] = now;
  moduleTimestamps[key] = now;

  let cleanData: any = data;
  if (key === 'puantaj' && Array.isArray(data)) {
    cleanData = optimizePuantajItems(data as Puantaj[]);
  }

  // Automatic deletion detection: compare with previously known items
  const prevList = latestRemoteItems[key];
  if (Array.isArray(prevList) && prevList.length > 0 && Array.isArray(cleanData)) {
    const newKeys = new Set(cleanData.map((it: any) => getItemKey(key, it)));
    const newIds = new Set(cleanData.map((it: any) => it?.id).filter(Boolean));
    prevList.forEach((prevItem: any) => {
      const pk = getItemKey(key, prevItem);
      const pid = prevItem?.id;
      if (pk && !newKeys.has(pk)) {
        markItemDeleted(key, pk);
      }
      if (pid && !newIds.has(pid)) {
        markItemDeleted(key, pid);
      }
    });
  }

  // Update local state and memory cache immediately
  setStoredData(key, cleanData);
  latestRemoteItems[key] = cleanData;

  // Broadcast to other local browser tabs / windows immediately via BroadcastChannel
  if (syncChannel) {
    syncChannel.postMessage({
      type: 'MODULE_UPDATED',
      key,
      data: cleanData,
      updatedAt: now,
      sourceClientId: CLIENT_SESSION_ID,
    });
  }

  // Instantly persist to Applet Server API (/api/sync) and broadcast over SSE to other users
  const deletedArray = Array.from(deletedItemIds[key] || []);
  if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        key,
        items: sanitizeForFirestore(cleanData),
        deletedIds: deletedArray,
        clientId: CLIENT_SESSION_ID,
        updatedAt: now,
      }),
    })
      .then((res) => res.json())
      .then((res) => {
        if (res && res.updatedAt) {
          moduleTimestamps[key] = Math.max(moduleTimestamps[key] || 0, res.updatedAt);
        }
      })
      .catch((err) => {
        console.warn('[SyncServer] POST /api/sync warning:', err?.message || err);
      });
  }

  const doSave = async () => {
    try {
      if (onStatusChange) onStatusChange('syncing');

      // If Firestore quota is currently exhausted, do not spam futile writes that trigger rollback snapshots
      const shouldAttemptFirestore =
        !isFirestoreQuotaExhausted || now - lastQuotaProbeTime > 300000;

      if (shouldAttemptFirestore) {
        lastQuotaProbeTime = now;
        const docRef = doc(db, FIRESTORE_COLLECTION, key);

        const writePromise = setDoc(docRef, {
          items: sanitizeForFirestore(cleanData),
          updatedAt: now,
        });

        // 2.5s timeout guard so a hanging network write never blocks the UI
        await Promise.race([
          writePromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Firestore write timeout')), 2500)
          ),
        ]);

        // Write succeeded! Quota is healthy
        isFirestoreQuotaExhausted = false;
        latestRemoteItems[key] = cleanData;
        deletedItemIds[key].clear();
      }

      if (onStatusChange) onStatusChange('connected');
    } catch (err: any) {
      if (
        err?.code === 'resource-exhausted' ||
        (err?.message && err.message.includes('Quota limit exceeded'))
      ) {
        isFirestoreQuotaExhausted = true;
      }
      latestRemoteItems[key] = cleanData;
      deletedItemIds[key].clear();

      if (onStatusChange) onStatusChange('connected');
    }
  };

  if (immediate) {
    if (debounceTimers[key]) {
      clearTimeout(debounceTimers[key]!);
      delete debounceTimers[key];
    }
    await doSave();
  } else {
    if (debounceTimers[key]) {
      clearTimeout(debounceTimers[key]!);
    }
    debounceTimers[key] = setTimeout(() => {
      delete debounceTimers[key];
      doSave();
    }, 150);
  }
}

/**
 * Saves all modules to Server and Firestore in batch
 */
export async function saveAllModulesToFirestore(
  allData: Partial<ErpDatabaseState> & Record<string, any>,
  onStatusChange?: (status: SyncStatus) => void
): Promise<void> {
  try {
    if (onStatusChange) onStatusChange('syncing');
    const now = Date.now();

    const actualData: Record<string, any> =
      allData.data && typeof allData.data === 'object' && !Array.isArray(allData.data)
        ? allData.data
        : allData.erpData && typeof allData.erpData === 'object' && !Array.isArray(allData.erpData)
        ? allData.erpData
        : allData;

    // 1. Sync to server API
    if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            data: actualData,
            clientId: CLIENT_SESSION_ID,
            updatedAt: now,
          }),
        });
      } catch (e) {
        console.warn('[SyncServer] saveAll batch warning:', e);
      }
    }

    // 2. Also try batch commit to Firestore if quota is not known to be exhausted
    if (!isFirestoreQuotaExhausted) {
      try {
        const batch = writeBatch(db);
        let writeCount = 0;
        for (const key of VALID_MODULE_KEYS) {
          let data = actualData[key];
          if (data !== undefined && data !== null) {
            if (key === 'puantaj' && Array.isArray(data)) {
              data = optimizePuantajItems(data);
            }
            setStoredData(key, data);
            latestRemoteItems[key] = data;
            moduleTimestamps[key] = now;
            const docRef = doc(db, FIRESTORE_COLLECTION, key);
            batch.set(docRef, {
              items: sanitizeForFirestore(data),
              updatedAt: now,
            });
            writeCount++;
          }
        }

        if (writeCount > 0) {
          await batch.commit();
        }
      } catch (fsErr: any) {
        if (
          fsErr?.code === 'resource-exhausted' ||
          (fsErr?.message && fsErr.message.includes('Quota limit exceeded'))
        ) {
          isFirestoreQuotaExhausted = true;
        }
      }
    }

    if (onStatusChange) onStatusChange('connected');
  } catch (err) {
    console.error('Error saving all modules:', err);
    if (onStatusChange) onStatusChange('error');
    throw err;
  }
}

/**
 * Subscribes to real-time updates for all ERP modules from Applet Server SSE, Polling, Firestore, and peer tabs.
 * Strictly prevents stale cloud or rollback snapshots from reverting entered user data.
 */
export function subscribeToErpDatabase(
  callbacks: {
    [K in ModuleKey]: (data: ErpDatabaseState[K]) => void;
  },
  onStatusChange?: (status: SyncStatus, lastSynced?: Date) => void
): () => void {
  const keys = Object.keys(MODULE_DEFAULTS) as ModuleKey[];
  const unsubs: (() => void)[] = [];
  let currentServerVersion = 0;

  if (onStatusChange) onStatusChange('syncing');

  const applyIncomingModuleData = (
    key: ModuleKey,
    incomingItems: any[],
    incomingUpdatedAt?: number
  ) => {
    if (!Array.isArray(incomingItems)) return;

    // Safety Guard: If incoming data timestamp is older than current known timestamp, reject it!
    const currentTs = moduleTimestamps[key] || 0;
    if (incomingUpdatedAt && incomingUpdatedAt < currentTs) {
      return;
    }

    // Safety: check if local write happened very recently by THIS user
    const localTime = lastLocalWriteTimestamps[key] || 0;
    const isVeryRecentLocal = Date.now() - localTime < 2500;

    const clean = key === 'puantaj' ? optimizePuantajItems(incomingItems) : incomingItems;

    if (isVeryRecentLocal) {
      // Merge incoming with local state to preserve recent typing
      const local = getStoredData(key, MODULE_EMPTY[key]);
      const merged = mergeModuleItems(key, local, clean, deletedItemIds[key]);
      latestRemoteItems[key] = merged;
      setStoredData(key, merged);
      moduleTimestamps[key] = Math.max(currentTs, incomingUpdatedAt || Date.now());
      callbacks[key]([...merged] as any);
    } else {
      latestRemoteItems[key] = clean;
      setStoredData(key, clean);
      moduleTimestamps[key] = Math.max(currentTs, incomingUpdatedAt || Date.now());
      callbacks[key]([...clean] as any);
    }
  };

  // 1. Initial Load: Fetch authoritative full state from Applet Server API
  if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
    fetch('/api/sync', { credentials: 'include' })
      .then((res) => res.json())
      .then((res) => {
        if (res && res.success && res.data) {
          if (res.version) currentServerVersion = res.version;
          if (res.timestamps) {
            Object.entries(res.timestamps).forEach(([k, ts]) => {
              if (ts && typeof ts === 'number') {
                moduleTimestamps[k as ModuleKey] = ts;
              }
            });
          }
          keys.forEach((key) => {
            const serverItems = res.data[key];
            if (Array.isArray(serverItems)) {
              applyIncomingModuleData(key, serverItems, res.timestamps?.[key] || res.version);
            }
          });
          if (onStatusChange) onStatusChange('connected', new Date());
        }
      })
      .catch((err) => {
        console.warn('[SyncServer] Initial GET /api/sync warning:', err);
      });
  }

  // 2. Real-time Server-Sent Events (SSE) listener for multi-user instant updates (<30ms)
  let eventSource: EventSource | null = null;
  if (typeof window !== 'undefined' && 'EventSource' in window) {
    try {
      eventSource = new EventSource('/api/sync/events', { withCredentials: true });
      eventSource.onmessage = (event) => {
        try {
          if (!event.data) return;
          const msg = JSON.parse(event.data);
          if (msg.version) currentServerVersion = msg.version;
          if (msg.timestamps) {
            Object.entries(msg.timestamps).forEach(([k, ts]) => {
              if (ts && typeof ts === 'number') {
                moduleTimestamps[k as ModuleKey] = Math.max(moduleTimestamps[k as ModuleKey] || 0, ts);
              }
            });
          }

          if (msg.type === 'MODULE_UPDATED' && msg.key && msg.sourceClientId !== CLIENT_SESSION_ID) {
            const k = msg.key as ModuleKey;
            if (callbacks[k] && Array.isArray(msg.items)) {
              applyIncomingModuleData(k, msg.items, msg.updatedAt || msg.version);
              if (onStatusChange) onStatusChange('connected', new Date());
            }
          } else if (msg.type === 'ALL_MODULES_UPDATED' && msg.data && msg.sourceClientId !== CLIENT_SESSION_ID) {
            keys.forEach((k) => {
              if (Array.isArray(msg.data[k])) {
                applyIncomingModuleData(k, msg.data[k], msg.timestamps?.[k] || msg.version);
              }
            });
            if (onStatusChange) onStatusChange('connected', new Date());
          }
        } catch (e) {
          console.warn('[SyncServer] SSE parse warning:', e);
        }
      };
      eventSource.onerror = () => {
        // SSE reconnects automatically
      };
    } catch (e) {
      console.warn('[SyncServer] SSE connection warning:', e);
    }
  }

  // 3. Fast Poll Heartbeat (1.5s probe to ensure syncing even if browser tab was asleep or SSE throttled)
  const pollTimer = setInterval(() => {
    if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
    fetch('/api/sync/version', { credentials: 'include' })
      .then((res) => res.json())
      .then((res) => {
        if (res && res.success) {
          let hasNewerModule = false;
          if (res.version && res.version > currentServerVersion) {
            hasNewerModule = true;
            currentServerVersion = res.version;
          }
          if (res.timestamps) {
            for (const [k, ts] of Object.entries(res.timestamps)) {
              if (typeof ts === 'number' && ts > (moduleTimestamps[k as ModuleKey] || 0)) {
                hasNewerModule = true;
                break;
              }
            }
          }

          if (hasNewerModule) {
            fetch('/api/sync', { credentials: 'include' })
              .then((r) => r.json())
              .then((dataRes) => {
                if (dataRes && dataRes.success && dataRes.data) {
                  keys.forEach((key) => {
                    const items = dataRes.data[key];
                    if (Array.isArray(items)) {
                      applyIncomingModuleData(key, items, dataRes.timestamps?.[key] || dataRes.version);
                    }
                  });
                  if (onStatusChange) onStatusChange('connected', new Date());
                }
              })
              .catch(() => {});
          }
        }
      })
      .catch(() => {});
  }, 1500);

  // 4. Listen for cross-tab broadcasts
  const handleBroadcast = (event: MessageEvent) => {
    if (
      event.data &&
      event.data.type === 'MODULE_UPDATED' &&
      event.data.key &&
      event.data.sourceClientId !== CLIENT_SESSION_ID
    ) {
      const { key, data, updatedAt } = event.data;
      if (callbacks[key as ModuleKey] && Array.isArray(data)) {
        applyIncomingModuleData(key as ModuleKey, data, updatedAt);
      }
    }
  };

  if (syncChannel) {
    syncChannel.addEventListener('message', handleBroadcast);
  }

  // 5. Firestore real-time snapshots (with strict rollback guards so stale cloud snapshots never revert local/server data)
  keys.forEach((key) => {
    const docRef = doc(db, FIRESTORE_COLLECTION, key);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.metadata.hasPendingWrites) {
          return;
        }

        if (snapshot.exists()) {
          const docData = snapshot.data();
          const remoteUpdatedAt = docData?.updatedAt || 0;
          const currentKnownTimestamp = moduleTimestamps[key] || 0;
          const localWriteTime = lastLocalWriteTimestamps[key] || 0;

          if (remoteUpdatedAt > 0 && (remoteUpdatedAt <= currentKnownTimestamp || remoteUpdatedAt < localWriteTime)) {
            return;
          }

          if (docData && Array.isArray(docData.items)) {
            applyIncomingModuleData(key, docData.items, remoteUpdatedAt);
          }
        }
      },
      (error: any) => {
        if (
          error?.code === 'resource-exhausted' ||
          (error?.message && error.message.includes('Quota limit exceeded'))
        ) {
          isFirestoreQuotaExhausted = true;
        }
      }
    );

    unsubs.push(unsubscribe);
  });

  return () => {
    clearInterval(pollTimer);
    if (eventSource) {
      eventSource.close();
    }
    if (syncChannel) {
      syncChannel.removeEventListener('message', handleBroadcast);
    }
    unsubs.forEach((unsub) => unsub());
  };
}

/**
 * Resets all ERP modules to either completely blank or pre-seeded demo data
 */
export async function resetAllModules(
  mode: 'empty' | 'demo' = 'empty',
  onStatusChange?: (status: SyncStatus) => void
): Promise<void> {
  const targetData = mode === 'demo' ? MODULE_DEFAULTS : MODULE_EMPTY;
  await saveAllModulesToFirestore(targetData, onStatusChange);
}
