import { describe, expect, it } from "vitest";
import { monthlyEquivalentCents, seatPrice } from "./plans";

describe("plan prices", () => {
  it("charges ten months for a year", () => {
    expect(seatPrice("pro", "month")).toBe(8);
    expect(seatPrice("pro", "year")).toBe(80);
    expect(seatPrice("business", "year")).toBe(160);
    expect(seatPrice("free", "year")).toBe(0);
  });
  it("shows yearly prices per month", () => {
    expect(monthlyEquivalentCents("pro", "year")).toBe(667);
    expect(monthlyEquivalentCents("business", "month")).toBe(1600);
  });
});
