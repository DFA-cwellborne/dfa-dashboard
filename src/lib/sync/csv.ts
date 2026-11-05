// Quote-aware CSV parsing — handles quoted fields, escaped `""` inside
// quotes, commas/newlines inside quoted fields, and both \n and \r\n line
// endings. Mirrors the parser already proven on the live dreamforamerica.org
// chapter map (same source data), rewritten here as pure, tested functions.

/** Parses raw CSV text into rows of raw string cells (no header handling). */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Parses CSV text into header-keyed objects — first row is the header, keys lowercased/trimmed. */
export function parseCsvObjects(text: string): Record<string, string>[] {
  const rows = parseCsvRows(text);
  const header = (rows.shift() ?? []).map((h) => h.trim().toLowerCase());
  return rows.map((cells) => {
    const obj: Record<string, string> = {};
    header.forEach((key, i) => {
      obj[key] = (cells[i] ?? "").trim();
    });
    return obj;
  });
}
