/**
 * db.js — VocabMaster IndexedDB Wrapper
 * Replaces all LocalStorage usage with a structured IndexedDB layer.
 * Exposed as window.VocabDB (global singleton).
 */

(function (global) {
  'use strict';

  const DB_NAME = 'VocabMasterDB';
  const DB_VERSION = 1;

  /** @type {IDBDatabase|null} */
  let _db = null;

  /* ─────────────────────────────────────────
   * Internal helpers
   * ───────────────────────────────────────── */

  /**
   * Returns a Promise that resolves/rejects with the IDBRequest result/error.
   * @param {IDBRequest} request
   * @returns {Promise<any>}
   */
  function promisifyRequest(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Ensures the DB is open before any operation.
   * @returns {Promise<IDBDatabase>}
   */
  async function getDB() {
    if (_db) return _db;
    await VocabDB.open();
    return _db;
  }

  /**
   * Wraps a transaction + store operation in a Promise.
   * @param {string} storeName
   * @param {'readonly'|'readwrite'} mode
   * @param {function(IDBObjectStore): IDBRequest|IDBRequest[]} fn
   * @returns {Promise<any>}
   */
  async function txOp(storeName, mode, fn) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
      const store = tx.objectStore(storeName);
      try {
        const req = fn(store);
        if (req && typeof req.onsuccess !== 'undefined') {
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        } else {
          // fn handled its own resolve/reject via tx.oncomplete
          tx.oncomplete = () => resolve();
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  /* ─────────────────────────────────────────
   * Public API
   * ───────────────────────────────────────── */

  const VocabDB = {

    /**
     * Opens (or upgrades) the IndexedDB database.
     * Must be called once before any other method (auto-called if not).
     * @returns {Promise<IDBDatabase>}
     */
    open() {
      return new Promise((resolve, reject) => {
        if (_db) { resolve(_db); return; }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;

          /* ── vocabulary ── */
          if (!db.objectStoreNames.contains('vocabulary')) {
            const vocabStore = db.createObjectStore('vocabulary', { keyPath: 'id' });
            vocabStore.createIndex('topic', 'topic', { unique: false });
            vocabStore.createIndex('status', 'status', { unique: false });
            vocabStore.createIndex('word', 'word', { unique: false });
          }

          /* ── quiz_questions ── */
          if (!db.objectStoreNames.contains('quiz_questions')) {
            const quizStore = db.createObjectStore('quiz_questions', { keyPath: 'id' });
            quizStore.createIndex('topic', 'topic', { unique: false });
            quizStore.createIndex('questionType', 'questionType', { unique: false });
          }

          /* ── grammar ── */
          if (!db.objectStoreNames.contains('grammar')) {
            db.createObjectStore('grammar', { keyPath: 'id' });
          }

          /* ── rank_questions ── */
          if (!db.objectStoreNames.contains('rank_questions')) {
            const rankStore = db.createObjectStore('rank_questions', { keyPath: 'id' });
            rankStore.createIndex('rank_level', 'rank_level', { unique: false });
          }

          /* ── sentences ── */
          if (!db.objectStoreNames.contains('sentences')) {
            db.createObjectStore('sentences', { keyPath: 'id' });
          }

          /* ── settings ── */
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'key' });
          }
        };

        request.onsuccess = (event) => {
          _db = event.target.result;

          _db.onversionchange = () => {
            _db.close();
            _db = null;
            console.warn('[VocabDB] Database version changed – connection closed. Reload the page.');
          };

          resolve(_db);
        };

        request.onerror = () => reject(request.error);
        request.onblocked = () => {
          console.warn('[VocabDB] Database upgrade blocked. Please close other tabs and reload.');
        };
      });
    },

    /**
     * Retrieves all records from a store.
     * @param {string} storeName
     * @returns {Promise<any[]>}
     */
    async getAll(storeName) {
      return txOp(storeName, 'readonly', (store) => store.getAll());
    },

    /**
     * Queries records by an index value.
     * @param {string} storeName
     * @param {string} indexName
     * @param {any} value
     * @returns {Promise<any[]>}
     */
    async getByIndex(storeName, indexName, value) {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const index = store.index(indexName);
        const req = index.getAll(value);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    },

    /**
     * Adds a new record (fails if key already exists).
     * @param {string} storeName
     * @param {object} record
     * @returns {Promise<IDBValidKey>} the new record's key
     */
    async add(storeName, record) {
      return txOp(storeName, 'readwrite', (store) => store.add(record));
    },

    /**
     * Adds or updates a record (upsert).
     * @param {string} storeName
     * @param {object} record
     * @returns {Promise<IDBValidKey>}
     */
    async put(storeName, record) {
      return txOp(storeName, 'readwrite', (store) => store.put(record));
    },

    /**
     * Deletes a record by its primary key.
     * @param {string} storeName
     * @param {IDBValidKey} id
     * @returns {Promise<void>}
     */
    async delete(storeName, id) {
      return txOp(storeName, 'readwrite', (store) => store.delete(id));
    },

    /**
     * Clears all records from a store.
     * @param {string} storeName
     * @returns {Promise<void>}
     */
    async clear(storeName) {
      return txOp(storeName, 'readwrite', (store) => store.clear());
    },

    /**
     * Bulk upsert — writes many records in a single transaction.
     * @param {string} storeName
     * @param {object[]} records
     * @returns {Promise<void>}
     */
    async bulkPut(storeName, records) {
      if (!Array.isArray(records) || records.length === 0) return;
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('bulkPut aborted'));
        const store = tx.objectStore(storeName);
        records.forEach((record) => store.put(record));
      });
    },

    /**
     * Retrieves a single record by its primary key.
     * @param {string} storeName
     * @param {IDBValidKey} id
     * @returns {Promise<any|undefined>}
     */
    async get(storeName, id) {
      return txOp(storeName, 'readonly', (store) => store.get(id));
    },

    /**
     * Retrieves a setting value from the `settings` store.
     * @param {string} key
     * @param {any} [defaultVal=null]
     * @returns {Promise<any>}
     */
    async getSetting(key, defaultVal = null) {
      const record = await this.get('settings', key);
      return record !== undefined ? record.value : defaultVal;
    },

    /**
     * Saves a setting value into the `settings` store.
     * @param {string} key
     * @param {any} value
     * @returns {Promise<IDBValidKey>}
     */
    async putSetting(key, value) {
      return this.put('settings', { key, value });
    },

    /**
     * Migrates legacy data from LocalStorage into IndexedDB.
     * Safe to call multiple times — skips stores that already have data.
     * @returns {Promise<{migrated: string[], skipped: string[]}>}
     */
    async migrateFromLocalStorage() {
      const migrated = [];
      const skipped = [];

      /**
       * Map of LocalStorage key → { store, transform? }
       * transform(raw) converts the parsed JSON into an array of records ready for bulkPut.
       */
      const migrations = [
        {
          lsKey: 'vocabmaster_vocabulary',
          store: 'vocabulary',
          transform: (data) => (Array.isArray(data) ? data : Object.values(data || {})),
        },
        {
          lsKey: 'vocabmaster_quiz_questions',
          store: 'quiz_questions',
          transform: (data) => (Array.isArray(data) ? data : Object.values(data || {})),
        },
        {
          lsKey: 'vocabmaster_grammar',
          store: 'grammar',
          transform: (data) => (Array.isArray(data) ? data : Object.values(data || {})),
        },
        {
          lsKey: 'vocabmaster_rank_questions',
          store: 'rank_questions',
          transform: (data) => (Array.isArray(data) ? data : Object.values(data || {})),
        },
        {
          lsKey: 'vocabmaster_sentences',
          store: 'sentences',
          transform: (data) => (Array.isArray(data) ? data : Object.values(data || {})),
        },
      ];

      // Settings migration (key-value pairs stored as a plain object in LS)
      const settingsLSKey = 'vocabmaster_settings';
      const rawSettings = localStorage.getItem(settingsLSKey);
      if (rawSettings) {
        try {
          const existing = await this.getAll('settings');
          if (existing.length === 0) {
            const parsed = JSON.parse(rawSettings);
            const records = Object.entries(parsed).map(([k, v]) => ({ key: k, value: v }));
            await this.bulkPut('settings', records);
            migrated.push('settings');
          } else {
            skipped.push('settings');
          }
        } catch (e) {
          console.error('[VocabDB] Migration error for settings:', e);
        }
      }

      for (const { lsKey, store, transform } of migrations) {
        const raw = localStorage.getItem(lsKey);
        if (!raw) continue;

        try {
          const existing = await this.getAll(store);
          if (existing.length > 0) {
            skipped.push(store);
            continue;
          }

          const parsed = JSON.parse(raw);
          const records = transform(parsed);
          if (records && records.length > 0) {
            await this.bulkPut(store, records);
            migrated.push(store);
          }
        } catch (e) {
          console.error(`[VocabDB] Migration error for store "${store}":`, e);
        }
      }

      console.info('[VocabDB] Migration complete. Migrated:', migrated, '| Skipped (already had data):', skipped);
      return { migrated, skipped };
    },
  };

  /* Expose globally */
  global.VocabDB = VocabDB;

})(window);
