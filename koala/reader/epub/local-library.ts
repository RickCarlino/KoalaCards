type ReaderFilePermissionMode = "read" | "readwrite";

type ReaderFilePermissionDescriptor = {
  mode?: ReaderFilePermissionMode;
};

export type ReaderFileSystemFileHandle = {
  kind: "file";
  name: string;
  getFile: () => Promise<File>;
  queryPermission?: (
    descriptor?: ReaderFilePermissionDescriptor,
  ) => Promise<PermissionState>;
  requestPermission?: (
    descriptor?: ReaderFilePermissionDescriptor,
  ) => Promise<PermissionState>;
};

type WindowWithFilePicker = Window & {
  showOpenFilePicker?: (
    options?: unknown,
  ) => Promise<ReaderFileSystemFileHandle[]>;
};

export type LocalBookHandleRecord = {
  fingerprint: string;
  localId: string;
  serverPublicId: string | null;
  fileName: string;
  fileSize: number;
  fileLastModified: number;
  handle: ReaderFileSystemFileHandle;
  updatedAt: number;
};

export type LocalBookAvailability = {
  hasHandle: boolean;
  permission: PermissionState | "unsupported";
};

const DB_NAME = "koala-reader-books";
const DB_VERSION = 2;
const HANDLE_STORE = "localBookHandle";
const COVER_STORE = "localBookCoverCache";
const REMOVED_STORES = [
  "localBookManifestCache",
  "localBookSectionCache",
] as const;

export function localBookDataStoreNames(): [string, string] {
  return [HANDLE_STORE, COVER_STORE];
}

function hasBrowserStorage(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

export function isFileSystemAccessSupported(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    typeof (window as WindowWithFilePicker).showOpenFilePicker ===
    "function"
  );
}

export async function requestPersistentReaderStorage(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) {
    return false;
  }

  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

function randomLocalId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function openReaderBookDb(): Promise<IDBDatabase> {
  if (!hasBrowserStorage()) {
    return Promise.reject(
      new Error("Local book storage is not available in this browser."),
    );
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(HANDLE_STORE)) {
        const store = db.createObjectStore(HANDLE_STORE, {
          keyPath: "fingerprint",
        });
        store.createIndex("serverPublicId", "serverPublicId", {
          unique: false,
        });
        store.createIndex("localId", "localId", { unique: false });
      }

      if (!db.objectStoreNames.contains(COVER_STORE)) {
        db.createObjectStore(COVER_STORE, { keyPath: "fingerprint" });
      }

      for (const storeName of REMOVED_STORES) {
        if (db.objectStoreNames.contains(storeName)) {
          db.deleteObjectStore(storeName);
        }
      }
    };

    request.onerror = () => {
      reject(request.error ?? new Error("Could not open book storage."));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => {
      reject(request.error ?? new Error("IndexedDB request failed."));
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.onerror = () => {
      reject(
        transaction.error ?? new Error("IndexedDB transaction failed."),
      );
    };
    transaction.oncomplete = () => {
      resolve();
    };
  });
}

async function readByKey<T>(
  storeName: string,
  key: IDBValidKey,
): Promise<T | null> {
  const db = await openReaderBookDb();
  try {
    const transaction = db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).get(key);
    const result = await requestToPromise<T | undefined>(request);
    await transactionDone(transaction);
    return result ?? null;
  } finally {
    db.close();
  }
}

async function putValue(storeName: string, value: unknown): Promise<void> {
  const db = await openReaderBookDb();
  try {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(value);
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

export async function openEpubFileWithPicker(): Promise<{
  handle: ReaderFileSystemFileHandle;
  file: File;
}> {
  const picker = (window as WindowWithFilePicker).showOpenFilePicker;
  if (!picker) {
    throw new Error("Local EPUB files require Chrome.");
  }

  const handles = await picker({
    multiple: false,
    types: [
      {
        description: "EPUB books",
        accept: {
          "application/epub+zip": [".epub"],
        },
      },
    ],
  });
  const handle = handles[0];
  if (!handle) {
    throw new Error("No EPUB file selected.");
  }

  return {
    handle,
    file: await handle.getFile(),
  };
}

export async function queryLocalBookPermission(
  handle: ReaderFileSystemFileHandle,
): Promise<PermissionState | "unsupported"> {
  if (!handle.queryPermission) {
    return "unsupported";
  }

  return handle.queryPermission({ mode: "read" });
}

export async function requestLocalBookPermission(
  handle: ReaderFileSystemFileHandle,
): Promise<PermissionState | "unsupported"> {
  if (!handle.requestPermission) {
    return "unsupported";
  }

  return handle.requestPermission({ mode: "read" });
}

export async function ensureLocalBookPermission(
  handle: ReaderFileSystemFileHandle,
): Promise<boolean> {
  const existing = await queryLocalBookPermission(handle);
  if (existing === "granted" || existing === "unsupported") {
    return true;
  }

  const requested = await requestLocalBookPermission(handle);
  return requested === "granted" || requested === "unsupported";
}

export async function saveLocalBookHandle(options: {
  fingerprint: string;
  serverPublicId: string | null;
  file: File;
  handle: ReaderFileSystemFileHandle;
}): Promise<LocalBookHandleRecord> {
  const existing = await readByKey<LocalBookHandleRecord>(
    HANDLE_STORE,
    options.fingerprint,
  );
  const record: LocalBookHandleRecord = {
    fingerprint: options.fingerprint,
    localId: existing?.localId ?? randomLocalId(),
    serverPublicId: options.serverPublicId,
    fileName: options.file.name,
    fileSize: options.file.size,
    fileLastModified: options.file.lastModified,
    handle: options.handle,
    updatedAt: Date.now(),
  };

  await putValue(HANDLE_STORE, record);
  return record;
}

export async function getLocalBookHandleByFingerprint(
  fingerprint: string,
): Promise<LocalBookHandleRecord | null> {
  return readByKey<LocalBookHandleRecord>(HANDLE_STORE, fingerprint);
}

export async function getLocalBookHandleByPublicId(
  publicId: string,
): Promise<LocalBookHandleRecord | null> {
  const db = await openReaderBookDb();
  try {
    const transaction = db.transaction(HANDLE_STORE, "readonly");
    const index = transaction
      .objectStore(HANDLE_STORE)
      .index("serverPublicId");
    const request = index.get(publicId);
    const result = await requestToPromise<
      LocalBookHandleRecord | undefined
    >(request);
    await transactionDone(transaction);
    return result ?? null;
  } finally {
    db.close();
  }
}

export async function saveLocalCoverCache(options: {
  fingerprint: string;
  coverDataUrl: string;
}): Promise<void> {
  await putValue(COVER_STORE, {
    fingerprint: options.fingerprint,
    coverDataUrl: options.coverDataUrl,
    updatedAt: Date.now(),
  });
}

export async function readLocalCoverCache(
  fingerprint: string,
): Promise<string | null> {
  const record = await readByKey<{
    fingerprint: string;
    coverDataUrl: string;
    updatedAt: number;
  }>(COVER_STORE, fingerprint);

  return record?.coverDataUrl ?? null;
}

export async function listLocalBookAvailability(
  fingerprints: string[],
): Promise<Record<string, LocalBookAvailability>> {
  const availability: Record<string, LocalBookAvailability> = {};

  for (const fingerprint of fingerprints) {
    const record = await getLocalBookHandleByFingerprint(fingerprint);
    if (!record) {
      availability[fingerprint] = {
        hasHandle: false,
        permission: "denied",
      };
      continue;
    }

    availability[fingerprint] = {
      hasHandle: true,
      permission: await queryLocalBookPermission(record.handle),
    };
  }

  return availability;
}

export async function removeLocalBookData(
  fingerprint: string,
): Promise<void> {
  const db = await openReaderBookDb();
  try {
    const [handleStore, coverStore] = localBookDataStoreNames();
    const transaction = db.transaction(
      [handleStore, coverStore],
      "readwrite",
    );
    transaction.objectStore(handleStore).delete(fingerprint);
    transaction.objectStore(coverStore).delete(fingerprint);
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}
