export function extractJson(text: string): string {
  if (!text) return '';
  const startTag = '###BEGIN_JSON###';
  const endTag = '###END_JSON###';
  const s = text.indexOf(startTag);
  const e = text.indexOf(endTag);
  if (s !== -1 && e !== -1 && e > s) {
    return text.slice(s + startTag.length, e).trim();
  }
  const cleaned = text.replace(/^```(?:json)?/gm, '').replace(/```$/gm, '').trim();
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) return cleaned.slice(first, last + 1).trim();
  return cleaned;
}

export function tryJsonRepairs(raw: string): string {
  let s = (raw || '').trim();
  s = s.replace(/^(BEGIN_.*|END_.*)$/gmi, '').trim();
  s = s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  s = s.replace(/,\s*([}\]])/g, '$1');
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    try { s = JSON.parse(s); } catch {}
  }
  if (s.indexOf('{') !== -1 && !s.trim().endsWith('}')) s = s + '}';
  return s;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function toTitle(s: string): string {
  return s.replace(/\s+/g, ' ').trim().replace(/^./, (m) => m.toUpperCase());
}
