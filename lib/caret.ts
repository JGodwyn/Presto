// Cross-browser: Chrome/Safari ship caretRangeFromPoint, Firefox ships the
// newer caretPositionFromPoint — both resolve a screen point to a text
// node + character offset, which is what places a cursor at the actual
// click position rather than always at the start/end of the text.
export function getCaretOffsetFromPoint(
  x: number,
  y: number
): { node: Node; offset: number } | null {
  if (typeof document.caretPositionFromPoint === "function") {
    const position = document.caretPositionFromPoint(x, y)
    return position ? { node: position.offsetNode, offset: position.offset } : null
  }
  if (typeof document.caretRangeFromPoint === "function") {
    const range = document.caretRangeFromPoint(x, y)
    return range ? { node: range.startContainer, offset: range.startOffset } : null
  }
  return null
}
