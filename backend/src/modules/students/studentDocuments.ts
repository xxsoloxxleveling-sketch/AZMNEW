/** Read-only compatibility adapter; never changes stored JSON or file objects. */
export function normalizeStudentDocuments(input: unknown): Record<string, any> {
  if (typeof input === 'string') {
    try { input = JSON.parse(input); } catch { return {}; }
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const source = input as Record<string, any>;
  const result: Record<string, any> = Object.create(null);
  const isFile = (value: any) => typeof value === 'string' ? value.trim().length > 0
    : value && typeof value === 'object' && !Array.isArray(value)
      && ['name', 'originalFileName', 'supabasePath', 'dataUrl', 'fileData', 'fileEndpoint', 'objectPath']
        .some(key => typeof value[key] === 'string' && value[key].length > 0);
  for (const [key, value] of Object.entries(source)) {
    if (key !== 'dmcFiles' && isFile(value)) result[key] = value;
  }
  const identity = (value: any): string | undefined => typeof value === 'string' ? value
    : value?.supabasePath || value?.objectPath || value?.dataUrl || value?.fileData;
  if (Array.isArray(source.dmcFiles)) source.dmcFiles.forEach((document: any, index: number) => {
    if (!isFile(document)) return;
    const id = identity(document);
    // Match physical references, never names: two different files may share a name.
    if (Object.entries(result).some(([key, value]) => /^dmc(?:_|$)/.test(key)
      && (value === document || (id && identity(value) === id)))) return;
    let key = index === 0 ? 'dmc' : `dmc_${index + 1}`;
    if (result[key]) {
      // Preserve a distinct individual document occupying the historical slot.
      key = `dmc_collection_${index + 1}`;
      while (result[key]) key += '_legacy';
    }
    result[key] = document;
  });
  return result;
}

/** Resolve a generated collision endpoint even when the primary slot exists only in a relation. */
export function legacyDmcCollectionEntry(input: unknown, key: string): unknown {
  const match = /^dmc_collection_([1-9]\d*)(?:_legacy)*$/.exec(key);
  if (!match) return undefined;
  if (typeof input === 'string') {
    try { input = JSON.parse(input); } catch { return undefined; }
  }
  const collection = (input as any)?.dmcFiles;
  return Array.isArray(collection) ? collection[Number(match[1]) - 1] : undefined;
}
