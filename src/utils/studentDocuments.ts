/** Collection bookkeeping is never a clickable student document. */
export function isStudentDocumentEntry(key: string, value: unknown): boolean {
  if (key === 'dmcFiles' || key === 'photoThumbnail' || !value || Array.isArray(value)) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return typeof value === 'object'
    && ['name', 'originalFileName', 'supabasePath', 'dataUrl', 'fileEndpoint', 'objectPath']
      .some(field => typeof (value as any)[field] === 'string' && (value as any)[field].length > 0);
}

export function buildDmcDocuments<T extends Record<string, any>>(files: readonly T[], uploadedAt: string) {
  return Object.fromEntries(files.map((file, index) => [
    index === 0 ? 'dmc' : `dmc_${index + 1}`, { ...file, uploadedAt },
  ]));
}
