import fs from 'fs';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';
import type { ViteDevServer } from 'vite';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'erp_state.json');
const TIMESTAMPS_FILE = path.join(DATA_DIR, 'erp_timestamps.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory cache of state, timestamps, and global version counter
let cachedState: Record<string, any[]> = {};
let moduleTimestamps: Record<string, number> = {};
let stateVersion = Date.now();

try {
  if (fs.existsSync(STATE_FILE)) {
    const raw = fs.readFileSync(STATE_FILE, 'utf-8');
    cachedState = JSON.parse(raw);
  }
} catch (e) {
  console.error('[SyncServer] Error reading initial state file:', e);
}

try {
  if (fs.existsSync(TIMESTAMPS_FILE)) {
    const raw = fs.readFileSync(TIMESTAMPS_FILE, 'utf-8');
    moduleTimestamps = JSON.parse(raw);
  }
} catch (e) {
  console.error('[SyncServer] Error reading timestamps file:', e);
}

// Ensure all keys have a timestamp
Object.keys(cachedState).forEach((k) => {
  if (!moduleTimestamps[k]) {
    moduleTimestamps[k] = Date.now();
  }
});

function saveStateToFile() {
  try {
    const tempFile = `${STATE_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(cachedState, null, 2), 'utf-8');
    fs.renameSync(tempFile, STATE_FILE);

    const tempTimestamps = `${TIMESTAMPS_FILE}.tmp`;
    fs.writeFileSync(tempTimestamps, JSON.stringify(moduleTimestamps, null, 2), 'utf-8');
    fs.renameSync(tempTimestamps, TIMESTAMPS_FILE);
  } catch (err) {
    console.error('[SyncServer] Error saving state to file:', err);
  }
}

// Active Server-Sent Events (SSE) connections
const sseClients = new Set<ServerResponse>();

function broadcastSSE(data: any) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Helper to get key for item
function getItemKey(moduleKey: string, item: any): string {
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
 * Merges local array with current server array based on item identity.
 * Respects deleted item IDs and overlays new/updated fields.
 */
function mergeItems(moduleKey: string, current: any[], incoming: any[], deletedIds?: string[]): any[] {
  const deletedSet = new Set<string>(deletedIds || []);
  const resultMap = new Map<string, any>();

  // 1. Keep existing items that were not deleted
  if (Array.isArray(current)) {
    current.forEach((item) => {
      const k = getItemKey(moduleKey, item);
      const itemId = item?.id ? String(item.id) : '';
      if (k && !deletedSet.has(k) && (!itemId || !deletedSet.has(itemId))) {
        resultMap.set(k, item);
      }
    });
  }

  // 2. Overlay incoming updates and new entries
  if (Array.isArray(incoming)) {
    incoming.forEach((item) => {
      const k = getItemKey(moduleKey, item);
      const itemId = item?.id ? String(item.id) : '';
      if (k && !deletedSet.has(k) && (!itemId || !deletedSet.has(itemId))) {
        resultMap.set(k, item);
      }
    });
  }

  return Array.from(resultMap.values());
}

export function createSyncServerPlugin() {
  return {
    name: 'santiye-erp-sync-server',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = req.url || '';
        const origin = req.headers.origin || '*';

        // Preflight OPTIONS for all /api/sync routes
        if (url.startsWith('/api/sync') && req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Credentials': 'true',
          });
          res.end();
          return;
        }

        // 1. SSE Stream: /api/sync/events (real-time push)
        if (url === '/api/sync/events' || url.startsWith('/api/sync/events?')) {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no', // Critical: disables nginx/cloud-run proxy buffering
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Credentials': 'true',
          });

          if (typeof (res as any).flushHeaders === 'function') {
            (res as any).flushHeaders();
          }

          // Initial connection message with retry interval
          res.write(`retry: 1500\n\n`);
          res.write(
            `data: ${JSON.stringify({
              type: 'CONNECTED',
              version: stateVersion,
              timestamps: moduleTimestamps,
              timestamp: Date.now(),
            })}\n\n`
          );
          sseClients.add(res);

          const keepAliveTimer = setInterval(() => {
            try {
              res.write(`: ping\n\n`);
            } catch {
              clearInterval(keepAliveTimer);
              sseClients.delete(res);
            }
          }, 5000);

          req.on('close', () => {
            clearInterval(keepAliveTimer);
            sseClients.delete(res);
          });
          return;
        }

        // 2. GET /api/sync/version (Fast lightweight polling probe)
        if ((url === '/api/sync/version' || url.startsWith('/api/sync/version?')) && req.method === 'GET') {
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Credentials': 'true',
          });
          res.end(
            JSON.stringify({
              success: true,
              version: stateVersion,
              timestamps: moduleTimestamps,
              timestamp: Date.now(),
            })
          );
          return;
        }

        // 3. GET /api/sync (Retrieve all module data)
        if ((url === '/api/sync' || url.startsWith('/api/sync?')) && req.method === 'GET') {
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Credentials': 'true',
          });
          res.end(
            JSON.stringify({
              success: true,
              version: stateVersion,
              data: cachedState,
              timestamps: moduleTimestamps,
              timestamp: Date.now(),
            })
          );
          return;
        }

        // 4. POST /api/sync (Save single module or batch)
        if ((url === '/api/sync' || url.startsWith('/api/sync?')) && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });

          req.on('end', () => {
            try {
              const payload = JSON.parse(body);
              const { key, items, deletedIds, clientId, updatedAt } = payload;
              const now = Date.now();
              const effectiveUpdatedAt = updatedAt || now;

              if (key && Array.isArray(items)) {
                const currentItems = cachedState[key] || [];
                const merged = mergeItems(key, currentItems, items, deletedIds);
                cachedState[key] = merged;
                moduleTimestamps[key] = effectiveUpdatedAt;
                stateVersion = now;
                saveStateToFile();

                // Broadcast to all other connected clients
                broadcastSSE({
                  type: 'MODULE_UPDATED',
                  key,
                  items: merged,
                  version: stateVersion,
                  updatedAt: effectiveUpdatedAt,
                  sourceClientId: clientId,
                  timestamp: now,
                });

                res.writeHead(200, {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': origin,
                  'Access-Control-Allow-Credentials': 'true',
                });
                res.end(
                  JSON.stringify({
                    success: true,
                    key,
                    version: stateVersion,
                    updatedAt: effectiveUpdatedAt,
                    count: merged.length,
                  })
                );
              } else if (payload.data && typeof payload.data === 'object') {
                // Batch full restore/save
                for (const [modKey, modItems] of Object.entries(payload.data)) {
                  if (Array.isArray(modItems)) {
                    cachedState[modKey] = modItems;
                    moduleTimestamps[modKey] = effectiveUpdatedAt;
                  }
                }
                stateVersion = now;
                saveStateToFile();
                broadcastSSE({
                  type: 'ALL_MODULES_UPDATED',
                  data: cachedState,
                  version: stateVersion,
                  timestamps: moduleTimestamps,
                  sourceClientId: clientId,
                  timestamp: now,
                });

                res.writeHead(200, {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': origin,
                  'Access-Control-Allow-Credentials': 'true',
                });
                res.end(JSON.stringify({ success: true, version: stateVersion, fullUpdate: true }));
              } else {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid payload structure' }));
              }
            } catch (err: any) {
              console.error('[SyncServer] Error processing POST /api/sync:', err);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err?.message || 'Internal error' }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}
