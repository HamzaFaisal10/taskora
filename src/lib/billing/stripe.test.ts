import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { verifyWebhook } = await import("./stripe");

const secret = "whsec_test";
const sign = (payload: string, t: number) =>
  `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex")}`;

describe("Stripe webhook signatures", () => {
  const payload = '{"type":"checkout.session.completed"}';
  const now = 1_800_000_000_000;
  const t = now / 1000;

  it("accepts a valid signature", () => {
    expect(verifyWebhook(payload, sign(payload, t), secret, now)).toBe(true);
  });
  it("rejects a tampered body", () => {
    expect(verifyWebhook(payload + " ", sign(payload, t), secret, now)).toBe(false);
  });
  it("rejects old events (replay protection)", () => {
    expect(verifyWebhook(payload, sign(payload, t - 600), secret, now)).toBe(false);
  });
  it("rejects a missing header", () => {
    expect(verifyWebhook(payload, null, secret, now)).toBe(false);
  });
});
