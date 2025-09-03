/**
 * Utils used by both client and api route.
 * Export BOTH sets so whichever import your route uses will work.
 */

// Old simple extractor (kept for backward compatibility)
export function sanitizeToFirstJson(text: string): string {
  const cleaned = text.replace(/^```(json)?/g, '').replace(/```$/g, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) return cleaned.substring(start, end + 1);
  return cleaned.trim();
}

// Newer explicit marker extractor used by hardened route
export function extractJson(text: string): string {
  if (!text) return '';
  const a = text.indexOf('###BEGIN_JSON###');
  const b = text.lastIndexOf('###END_JSON###');
  if (a !== -1 && b !== -1 && b > a) {
    return text.slice(a + '###BEGIN_JSON###'.length, b).trim();
  }
  // Fallback to first {...} block
  return sanitizeToFirstJson(text);
}

// Minimal best-effort repairs without extra deps
export function tryJsonRepairs(s: string): string {
  if (!s) return s;
  // Strip stray markers / fences
  s = s.replace(/^\s*`{3,}[\s\S]*?\n/, '').replace(/`{3,}\s*$/, '');
  s = s.replace(/BEGIN_JSON|END_JSON|BEGIN_PREVIOUS|END_PREVIOUS/g, '');
  // Replace single quotes around keys/strings with double quotes (simple cases)
  if (s.includes("'")) s = s.replace(/'([^']*)'/g, (_m, g1) => `"${g1.replace(/"/g, '\\"')}"`);
  // Remove trailing commas in objects/arrays
  s = s.replace(/,\s*([}\]])/g, '$1');
  return s.trim();
}

// Client helpers
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function toTitle(s: string): string {
  return s.replace(/\s+/g, ' ').trim().replace(/^./, (m) => m.toUpperCase());
}
