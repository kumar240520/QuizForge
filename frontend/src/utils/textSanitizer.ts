/**
 * Universal text sanitizer for questions, options, and explanations.
 * Strips Private Use Area unicode (e.g., \uf0b7, \ue000-\uf8ff), box glyphs/tofu,
 * stray checkmarks, leaked page markers, and trailing 'Options:' headings.
 */
export function sanitizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    // Strip Private Use Area characters (e.g. \uf0b7, \ue000-\uf8ff, \ufffd)
    .replace(/[\uE000-\uF8FF\uFFF0-\uFFFF\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    // Strip box and tofu geometric symbols (e.g. \u25a0, \u25a1, \u25fb)
    .replace(/[\u25A0-\u25FF\u2B1C\u2B1B]/g, '')
    // Strip stray checkmarks (✓, ✔)
    .replace(/[✓✔]/g, '')
    // Strip page markers like '--- PAGE 2 ---'
    .replace(/---\s*PAGE\s*\d+\s*---/gi, '')
    // Strip trailing 'Options:\s*' or 'Choices:\s*'
    .replace(/(?:\n|\r|\s)*(?:Options|Choices)\s*[:\-]?(?:\s*[\u2022\u25a0\u25a1\-*])?\s*$/gi, '')
    // Normalize spaces
    .replace(/[ \t]+/g, ' ')
    .trim();
}
