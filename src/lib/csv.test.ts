import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "./csv";

describe("csv", () => {
  it("quotes only when needed and neutralises formulas", () => {
    expect(toCsv([["a", 'say "hi"', "x,y", null, 3, "=SUM(A1)"]])).toBe(
      'a,"say ""hi""","x,y",,3,\'=SUM(A1)',
    );
  });

  it("round-trips quotes, commas and newlines", () => {
    const rows = [
      ["Title", "Notes"],
      ['Fix "login"', "line one\nline two, with comma"],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });

  it("handles a BOM, CRLF and blank lines", () => {
    expect(parseCsv("﻿a,b\r\n\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});
