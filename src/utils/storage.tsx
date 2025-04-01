interface SavedFileData {
    id: string;
    name: string;
    date: string;
    notes: Record<string, string>; // featureId -> note
    fileData: ArrayBuffer | null;
}

export const saveToLocalStorage = (fileData: SavedFileData): void => {
    try {
        // Save metadata and notes to localStorage
        const savedFiles = getSavedFiles();
        savedFiles[fileData.id] = {
            id: fileData.id,
            name: fileData.name,
            date: fileData.date,
            notes: fileData.notes
        };

        localStorage.setItem('shapeFileViewerSavedFiles', JSON.stringify(savedFiles));

        // Save actual file data to IndexedDB (since localStorage has size limitations)
        if (fileData.fileData) {
            saveFileToIndexedDB(fileData.id, fileData.fileData);
        }
    } catch (error) {
        console.error('Error saving to localStorage:', error);
    }
};

export const getSavedFiles = (): Record<string, Omit<SavedFileData, 'fileData'>> => {
    try {
        const savedFiles = localStorage.getItem('shapeFileViewerSavedFiles');
        return savedFiles ? JSON.parse(savedFiles) : {};
    } catch (error) {
        console.error('Error getting saved files:', error);
        return {};
    }
};

// IndexedDB functions for storing larger binary data
const dbName = 'shapeFileViewerDB';
const storeName = 'files';

const openDatabase = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName);
            }
        };

        request.onsuccess = (event) => {
            resolve((event.target as IDBOpenDBRequest).result);
        };

        request.onerror = (event) => {
            reject((event.target as IDBOpenDBRequest).error);
        };
    });
};

export const saveFileToIndexedDB = async (id: string, fileData: ArrayBuffer): Promise<void> => {
    try {
        const db = await openDatabase();
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        store.put(fileData, id);
    } catch (error) {
        console.error('Error saving file to IndexedDB:', error);
    }
};

export const getFileFromIndexedDB = async (id: string): Promise<ArrayBuffer | null> => {
    try {
        const db = await openDatabase();
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);

        return new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Error getting file from IndexedDB:', error);
        return null;
    }
};
