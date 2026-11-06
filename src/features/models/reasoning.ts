// Parse only the leading Qwen3 thinking block. A partial delimiter is held
// back until the next chunk so raw tags never flash in the final answer.
export function splitReasoning(raw: string) {
  const text = raw.trimStart();
  const open = "<think>",
    close = "</think>";
  if (text && open.startsWith(text))
    return { content: "", reasoning: "", thinking: true };
  if (!text.startsWith(open))
    return { content: raw, reasoning: "", thinking: false };
  const end = text.indexOf(close, open.length);
  if (end >= 0)
    return {
      content: text.slice(end + close.length).trimStart(),
      reasoning: text.slice(open.length, end).trim(),
      thinking: false,
    };
  let thought = text.slice(open.length);
  for (let n = close.length - 1; n > 0; n--) {
    if (thought.endsWith(close.slice(0, n))) {
      thought = thought.slice(0, -n);
      break;
    }
  }
  return { content: "", reasoning: thought.trim(), thinking: true };
}
