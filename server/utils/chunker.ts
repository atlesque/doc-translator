/**
 * Splits text into paragraphs separated by two or more newlines.
 * Trims each paragraph and filters out empty strings.
 */
export function splitIntoChunks(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map(chunk => chunk.trim())
    .filter(chunk => chunk.length > 0)
}
