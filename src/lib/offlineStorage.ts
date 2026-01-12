// Offline storage utilities using IndexedDB for larger datasets
const DB_NAME = 'custos-gourmet-offline';
const DB_VERSION = 1;

interface CachedData {
  key: string;
  data: unknown;
  timestamp: number;
  expiresAt: number;
}

let db: IDBDatabase | null = null;

async function openDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      
      // Create stores for different data types
      if (!database.objectStoreNames.contains('cache')) {
        const store = database.createObjectStore('cache', { keyPath: 'key' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }

      if (!database.objectStoreNames.contains('pendingActions')) {
        database.createObjectStore('pendingActions', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

// Cache data with expiration (default 1 hour)
export async function cacheData(key: string, data: unknown, ttlMinutes = 60): Promise<void> {
  try {
    const database = await openDB();
    const transaction = database.transaction(['cache'], 'readwrite');
    const store = transaction.objectStore('cache');
    
    const cachedData: CachedData = {
      key,
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + (ttlMinutes * 60 * 1000),
    };

    store.put(cachedData);
  } catch (error) {
    console.error('Error caching data:', error);
    // Fallback to localStorage
    try {
      localStorage.setItem(`offline_${key}`, JSON.stringify({
        data,
        expiresAt: Date.now() + (ttlMinutes * 60 * 1000),
      }));
    } catch (e) {
      console.error('localStorage fallback failed:', e);
    }
  }
}

// Get cached data
export async function getCachedData<T>(key: string): Promise<T | null> {
  try {
    const database = await openDB();
    const transaction = database.transaction(['cache'], 'readonly');
    const store = transaction.objectStore('cache');
    
    return new Promise((resolve) => {
      const request = store.get(key);
      
      request.onsuccess = () => {
        const result = request.result as CachedData | undefined;
        
        if (!result) {
          resolve(null);
          return;
        }

        // Check if expired
        if (result.expiresAt < Date.now()) {
          // Delete expired data
          const deleteTransaction = database.transaction(['cache'], 'readwrite');
          deleteTransaction.objectStore('cache').delete(key);
          resolve(null);
          return;
        }

        resolve(result.data as T);
      };

      request.onerror = () => resolve(null);
    });
  } catch (error) {
    console.error('Error getting cached data:', error);
    // Fallback to localStorage
    try {
      const stored = localStorage.getItem(`offline_${key}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.expiresAt > Date.now()) {
          return parsed.data as T;
        }
        localStorage.removeItem(`offline_${key}`);
      }
    } catch (e) {
      console.error('localStorage fallback failed:', e);
    }
    return null;
  }
}

// Store pending action for sync
export async function storePendingAction(action: {
  type: string;
  table: string;
  data: unknown;
}): Promise<void> {
  try {
    const database = await openDB();
    const transaction = database.transaction(['pendingActions'], 'readwrite');
    const store = transaction.objectStore('pendingActions');
    
    store.add({
      ...action,
      createdAt: Date.now(),
    });
  } catch (error) {
    console.error('Error storing pending action:', error);
  }
}

// Get all pending actions
export async function getPendingActions(): Promise<Array<{
  id: number;
  type: string;
  table: string;
  data: unknown;
  createdAt: number;
}>> {
  try {
    const database = await openDB();
    const transaction = database.transaction(['pendingActions'], 'readonly');
    const store = transaction.objectStore('pendingActions');
    
    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch (error) {
    console.error('Error getting pending actions:', error);
    return [];
  }
}

// Clear pending action after sync
export async function clearPendingAction(id: number): Promise<void> {
  try {
    const database = await openDB();
    const transaction = database.transaction(['pendingActions'], 'readwrite');
    const store = transaction.objectStore('pendingActions');
    store.delete(id);
  } catch (error) {
    console.error('Error clearing pending action:', error);
  }
}

// Clear all cache
export async function clearAllCache(): Promise<void> {
  try {
    const database = await openDB();
    const transaction = database.transaction(['cache'], 'readwrite');
    const store = transaction.objectStore('cache');
    store.clear();
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}
