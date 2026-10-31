// A separate database per capability prevents accidentally mixing editing links.
export async function openWorksheetCache(scope) {
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(scope)))].map(x => x.toString(16).padStart(2, '0')).join('');
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open(`inkwire-worksheet-${hash}`, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('state');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return {
    read: () => new Promise((resolve, reject) => {
      const store = database.transaction('state').objectStore('state');
      const request = store.get('worksheet'), pdf = store.get('pdf');
      pdf.onsuccess = () => resolve({ ...request.result, cachedPdf: pdf.result });
      request.onerror = pdf.onerror = () => reject(request.error || pdf.error);
    }),
    write: (value, pdf) => new Promise((resolve, reject) => {
      const transaction = database.transaction('state', 'readwrite');
      transaction.objectStore('state').put(value, 'worksheet');
      if (pdf) transaction.objectStore('state').put(pdf, 'pdf');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || Error('Local worksheet save failed.'));
    }),
  };
}
