import { describe, expect, it } from "vitest";
import { avatarColor, cn, initials, slugify } from "./utils";

describe("cn", () => {
  it("lets later Tailwind classes win", () => {
    expect(cn("px-2 text-sm", "px-4")).toBe("text-sm px-4");
  });

  it("drops falsy values", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });
});

describe("initials", () => {
  it("uses first and last name", () => {
    expect(initials("Hamza Faisal")).toBe("HF");
    expect(initials("Sara Ali Rehman")).toBe("SR");
  });

  it("handles single names and empty input", () => {
    expect(initials("zain")).toBe("ZA");
    expect(initials("")).toBe("?");
    expect(initials(null)).toBe("?");
  });
});

describe("slugify", () => {
  it("makes URL-safe slugs", () => {
    expect(slugify("Halcyon Labs!")).toBe("halcyon-labs");
    expect(slugify("  Café   Déjà vu  ")).toBe("cafe-deja-vu");
  });
});

describe("avatarColor", () => {
  it("is stable for the same seed", () => {
    expect(avatarColor("user-1")).toBe(avatarColor("user-1"));
    expect(avatarColor("user-1")).toMatch(/^#[0-9A-F]{6}$/i);
  });
});
