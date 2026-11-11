import { describe, expect, it } from "vitest";
import {
  continueList,
  parseInline,
  parseRichText,
  prefixLines,
  richTextToPlain,
  toggleChecklistLine,
  wrapSelection,
} from "./rich-text";

describe("rich text", () => {
  it("parses bold, italic, code and links", () => {
    expect(parseInline("a **b** *c* `d` [e](https://x.io)")).toEqual([
      { t: "text", v: "a " },
      { t: "bold", c: [{ t: "text", v: "b" }] },
      { t: "text", v: " " },
      { t: "italic", c: [{ t: "text", v: "c" }] },
      { t: "text", v: " " },
      { t: "code", v: "d" },
      { t: "text", v: " " },
      { t: "link", href: "https://x.io", c: [{ t: "text", v: "e" }] },
    ]);
  });

  it("never turns unsafe links into links", () => {
    const nodes = parseInline("[x](javascript:alert(1)) <b>hi</b>");
    expect(nodes.some((n) => n.t === "link")).toBe(false);
    expect(nodes.map((n) => (n.t === "text" ? n.v : "")).join("")).toContain("<b>hi</b>");
  });

  it("leaves snake_case words alone", () => {
    expect(parseInline("use user_id_here")).toEqual([{ t: "text", v: "use user_id_here" }]);
  });

  it("groups list items and checklists", () => {
    const blocks = parseRichText("## Plan\n- one\n- two\n\n- [ ] a\n- [x] b\n1. first");
    expect(blocks.map((b) => b.t)).toEqual(["h", "ul", "check", "ol"]);
    const check = blocks[2];
    expect(check.t === "check" && check.items.map((i) => [i.done, i.line])).toEqual([
      [false, 4],
      [true, 5],
    ]);
  });

  it("toggles a checklist line", () => {
    expect(toggleChecklistLine("- [ ] a\n- [x] b", 0)).toBe("- [x] a\n- [x] b");
    expect(toggleChecklistLine("- [ ] a\n- [x] b", 1)).toBe("- [ ] a\n- [ ] b");
  });

  it("wraps and unwraps a selection", () => {
    const on = wrapSelection({ text: "make it bold", start: 8, end: 12 }, "**", "x");
    expect(on).toEqual({ text: "make it **bold**", start: 10, end: 14 });
    expect(wrapSelection(on, "**", "x").text).toBe("make it bold");
  });

  it("prefixes and numbers lines", () => {
    expect(prefixLines({ text: "a\nb", start: 0, end: 3 }, "1. ").text).toBe("1. a\n2. b");
    expect(prefixLines({ text: "- a", start: 0, end: 3 }, "- ").text).toBe("a");
  });

  it("continues lists on Enter and ends them on an empty item", () => {
    expect(continueList({ text: "- [x] a", start: 7, end: 7 })?.text).toBe("- [x] a\n- [ ] ");
    expect(continueList({ text: "3. c", start: 4, end: 4 })?.text).toBe("3. c\n4. ");
    expect(continueList({ text: "a\n- ", start: 4, end: 4 })?.text).toBe("a\n");
    expect(continueList({ text: "plain", start: 5, end: 5 })).toBeNull();
  });

  it("strips formatting for plain text", () => {
    expect(richTextToPlain("**Goal:** ship\n- [ ] *test*")).toBe("Goal: ship\n- test");
  });
});
