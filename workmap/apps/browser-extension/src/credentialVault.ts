export type ProtectedCredential = {
  credentialCiphertext: string;
  credentialIv: string;
  credentialVersion: 1;
};

const DATABASE_NAME = "workmap-credential-vault";
const STORE_NAME = "keys";
const KEY_ID = "device-credential-aes-gcm-v1";
const ADDITIONAL_DATA = new TextEncoder().encode("workmap-device-credential:v1");

export async function protectCredential(credential: string, key?: CryptoKey): Promise<ProtectedCredential> {
  const encryptionKey = key ?? await getOrCreateVaultKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: ADDITIONAL_DATA },
    encryptionKey,
    new TextEncoder().encode(credential),
  );

  return {
    credentialCiphertext: encodeBytes(new Uint8Array(ciphertext)),
    credentialIv: encodeBytes(iv),
    credentialVersion: 1,
  };
}

export async function unprotectCredential(protectedCredential: ProtectedCredential, key?: CryptoKey) {
  const encryptionKey = key ?? await getOrCreateVaultKey();
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decodeBytes(protectedCredential.credentialIv), additionalData: ADDITIONAL_DATA },
    encryptionKey,
    decodeBytes(protectedCredential.credentialCiphertext),
  );
  return new TextDecoder().decode(plaintext);
}

async function getOrCreateVaultKey() {
  const database = await openVaultDatabase();
  try {
    const existing = await requestResult<CryptoKey | undefined>(database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(KEY_ID));
    if (existing) return existing;

    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    await transactionComplete(database, "readwrite", (store) => store.put(key, KEY_ID));
    return key;
  } finally {
    database.close();
  }
}

function openVaultDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Credential vault could not be opened."));
  });
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Credential vault request failed."));
  });
}

function transactionComplete(database: IDBDatabase, mode: IDBTransactionMode, action: (store: IDBObjectStore) => void) {
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    action(transaction.objectStore(STORE_NAME));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Credential vault transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Credential vault transaction was aborted."));
  });
}

function encodeBytes(value: Uint8Array) {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBytes(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}
