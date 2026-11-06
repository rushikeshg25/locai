export function cleanChatTitle(value: string): string | null {
  const title = value
    .trim()
    .replace(/^title\s*:\s*/i, "")
    .replace(/^["'“”‘’`#\s]+|["'“”‘’`\s]+$/g, "")
    .trim();
  if (
    !title ||
    /[\r\n<>]/.test(title) ||
    title.length > 80 ||
    title.split(/\s+/).length > 12
  )
    return null;
  return title;
}
