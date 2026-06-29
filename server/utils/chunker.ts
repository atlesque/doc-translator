/**
 * Normalizes line endings to \n (handles Windows \r\n and old Mac \r).
 */
function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

/**
 * Splits text into paragraphs separated by two or more newlines.
 * Normalizes line endings first so Windows (\r\n) and Unix (\n) files
 * both split correctly on blank-line paragraph separators.
 * Trims each paragraph and filters out empty strings.
 */
export function splitIntoChunks(text: string): string[] {
  const normalized = normalizeLineEndings(text)
  return normalized
    .split(/\n{2,}/)
    .map(chunk => chunk.trim())
    .filter(chunk => chunk.length > 0)
}
