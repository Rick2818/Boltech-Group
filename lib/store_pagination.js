// Never present a partial read as complete evidence.
export function paginationGuard(maxRecords = 10000, maxPages = 100) {
  const cursors = new Set();
  let records = 0, pages = 0;
  return page => {
    if (!page || !Array.isArray(page.records) ||
        page.records.some(r => !r || !r.fields || typeof r.fields !== 'object' || Array.isArray(r.fields)))
      throw new Error('Invalid store page');
    records += page.records.length; pages++;
    const offset = page.offset;
    if (offset !== undefined && (typeof offset !== 'string' || !offset.trim()))
      throw new Error('Invalid store cursor');
    if (records > maxRecords || pages > maxPages ||
        (offset && (records >= maxRecords || pages >= maxPages || cursors.has(offset))))
      throw new Error('Incomplete store pagination');
    if (offset) cursors.add(offset);
    return offset;
  };
}
