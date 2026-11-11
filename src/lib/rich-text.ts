/**
 * A small, safe subset of Markdown for task descriptions. It is parsed into plain data and rendered as
 * React elements, so nothing a person types can ever become HTML.
 *
 * Blocks: paragraphs, "## " headings, "- " bullets, "1. " numbered items, "- [ ] " / "- [x] " checklist
 * items, "> " quotes. Inline: **bold**, *italic* or _italic_, `code`, ~~strike~~, [text](https://…) and
 * bare https:// links.
 */

export type Inline =
  | { t: "text"; v: string }
  | { t: "bold" | "italic" | "strike"; c: Inline[] }
  | { t: "code"; v: string }
  | { t: "link"; href: string; c: Inline[] };

export type Block =
  | { t: "p"; c: Inline[] }
  | { t: "h"; c: Inline[] }
  | { t: "quote"; c: Inline[] }
  | { t: "ul"; items: Inline[][] }
  | { t: "ol"; items: Inline[][] }
  | { t: "check"; items: { done: boolean; c: Inline[]; line: number }[] };

const SAFE_URL = /^https?:\/\/[^\s<>"]+$/i;

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let text = "";
  const flush = () => {
    if (text) out.push({ t: "text", v: text });
    text = "";
  };
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    let m: RegExpMatchArray | null;
    if ((m = rest.match(/^`([^`\n]+)`/))) {
      flush();
      out.push({ t: "code", v: m[1] });
    } else if ((m = rest.match(/^\*\*(?=\S)([\s\S]*?\S)\*\*/))) {
      flush();
      out.push({ t: "bold", c: parseInline(m[1]) });
    } else if ((m = rest.match(/^~~(?=\S)([\s\S]*?\S)~~/))) {
      flush();
      out.push({ t: "strike", c: parseInline(m[1]) });
    } else if (
      (m = rest.match(/^\*(?=[^\s*])([^*\n]*?[^\s*])\*/)) ||
      ((i === 0 || /\W/.test(src[i - 1])) && (m = rest.match(/^_(?=\S)([^_\n]*?\S)_(?!\w)/)))
    ) {
      flush();
      out.push({ t: "italic", c: parseInline(m[1]) });
    } else if ((m = rest.match(/^\[([^\]\n]+)\]\(([^)\s]+)\)/)) && SAFE_URL.test(m[2])) {
      flush();
      out.push({ t: "link", href: m[2], c: parseInline(m[1]) });
    } else if (
      (i === 0 || /\s|\(/.test(src[i - 1])) &&
      (m = rest.match(/^https?:\/\/[^\s<>"]+[^\s<>".,;:!?)]/i))
    ) {
      flush();
      out.push({ t: "link", href: m[0], c: [{ t: "text", v: m[0] }] });
    } else {
      text += src[i];
      i++;
      continue;
    }
    i += m[0].length;
  }
  flush();
  return out;
}

export function parseRichText(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push({ t: "p", c: parseInline(para.join("\n")) });
    para = [];
  };
  const last = () => blocks[blocks.length - 1];

  lines.forEach((line, n) => {
    let m: RegExpMatchArray | null;
    if (!line.trim()) return flushPara();
    if ((m = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/))) {
      flushPara();
      const item = { done: m[1] !== " ", c: parseInline(m[2]), line: n };
      const b = last();
      if (b?.t === "check") b.items.push(item);
      else blocks.push({ t: "check", items: [item] });
    } else if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) {
      flushPara();
      const b = last();
      if (b?.t === "ul") b.items.push(parseInline(m[1]));
      else blocks.push({ t: "ul", items: [parseInline(m[1])] });
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      flushPara();
      const b = last();
      if (b?.t === "ol") b.items.push(parseInline(m[1]));
      else blocks.push({ t: "ol", items: [parseInline(m[1])] });
    } else if ((m = line.match(/^#{1,3}\s+(.*)$/))) {
      flushPara();
      blocks.push({ t: "h", c: parseInline(m[1]) });
    } else if ((m = line.match(/^>\s?(.*)$/))) {
      flushPara();
      blocks.push({ t: "quote", c: parseInline(m[1]) });
    } else {
      para.push(line);
    }
  });
  flushPara();
  return blocks;
}

/** Ticks or unticks the checklist item on a given line of the source text. */
export function toggleChecklistLine(src: string, line: number): string {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const l = lines[line];
  if (l === undefined) return src;
  lines[line] = l.replace(
    /^(\s*[-*]\s+\[)( |x|X)(\])/,
    (_, a, mark, b) => `${a}${mark === " " ? "x" : " "}${b}`,
  );
  return lines.join("\n");
}

/** Plain text without the formatting marks, for previews and the AI. */
export function richTextToPlain(src: string): string {
  const inline = (c: Inline[]): string =>
    c.map((n) => (n.t === "text" || n.t === "code" ? n.v : inline(n.c))).join("");
  return parseRichText(src)
    .map((b) =>
      b.t === "ul" || b.t === "ol"
        ? b.items.map((i) => `- ${inline(i)}`).join("\n")
        : b.t === "check"
          ? b.items.map((i) => `- ${inline(i.c)}`).join("\n")
          : inline(b.c),
    )
    .join("\n");
}

/** Text-editing helpers for the toolbar: each returns the new text and selection. */
export type Edit = { text: string; start: number; end: number };

export function wrapSelection(e: Edit, mark: string, placeholder: string): Edit {
  const sel = e.text.slice(e.start, e.end);
  if (sel.startsWith(mark) && sel.endsWith(mark) && sel.length >= mark.length * 2) {
    const inner = sel.slice(mark.length, sel.length - mark.length);
    return {
      text: e.text.slice(0, e.start) + inner + e.text.slice(e.end),
      start: e.start,
      end: e.start + inner.length,
    };
  }
  const before = e.text.slice(e.start - mark.length, e.start);
  const after = e.text.slice(e.end, e.end + mark.length);
  if (before === mark && after === mark) {
    return {
      text: e.text.slice(0, e.start - mark.length) + sel + e.text.slice(e.end + mark.length),
      start: e.start - mark.length,
      end: e.end - mark.length,
    };
  }
  const inner = sel || placeholder;
  return {
    text: e.text.slice(0, e.start) + mark + inner + mark + e.text.slice(e.end),
    start: e.start + mark.length,
    end: e.start + mark.length + inner.length,
  };
}

export function prefixLines(e: Edit, prefix: string): Edit {
  const lineStart = e.text.lastIndexOf("\n", e.start - 1) + 1;
  const nl = e.text.indexOf("\n", e.end);
  const lineEnd = nl === -1 ? e.text.length : nl;
  const lines = e.text.slice(lineStart, lineEnd).split("\n");
  const has = lines.every((l) => l.startsWith(prefix));
  const next = lines.map((l, i) =>
    has ? l.slice(prefix.length) : prefix === "1. " ? `${i + 1}. ${l}` : `${prefix}${l}`,
  );
  const block = next.join("\n");
  return {
    text: e.text.slice(0, lineStart) + block + e.text.slice(lineEnd),
    start: lineStart,
    end: lineStart + block.length,
  };
}

export function insertLink(e: Edit): Edit {
  const sel = e.text.slice(e.start, e.end) || "link text";
  const url = "https://";
  const text = `${e.text.slice(0, e.start)}[${sel}](${url})${e.text.slice(e.end)}`;
  const urlStart = e.start + sel.length + 3;
  return { text, start: urlStart, end: urlStart + url.length };
}

/** When Enter is pressed inside a list item, continue the list (or end it on an empty item). */
export function continueList(e: Edit): Edit | null {
  if (e.start !== e.end) return null;
  const lineStart = e.text.lastIndexOf("\n", e.start - 1) + 1;
  const line = e.text.slice(lineStart, e.start);
  const m = line.match(/^(\s*)([-*] \[[ xX]\] |[-*•] |(\d+)[.)] )(.*)$/);
  if (!m) return null;
  if (!m[4].trim()) {
    const text = e.text.slice(0, lineStart) + e.text.slice(e.start);
    return { text, start: lineStart, end: lineStart };
  }
  const marker = m[3] ? `${Number(m[3]) + 1}. ` : m[2].includes("[") ? "- [ ] " : m[2];
  const ins = `\n${m[1]}${marker}`;
  const text = e.text.slice(0, e.start) + ins + e.text.slice(e.end);
  return { text, start: e.start + ins.length, end: e.start + ins.length };
}
