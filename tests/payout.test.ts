import { describe, it, expect } from "vitest";
import { calculatePayout } from "@/server/services/payout";

describe("calculatePayout", () => {
  it("returns 0 for 0 views", () => {
    expect(calculatePayout(0, 250)).toBe(0);
  });

  it("returns 0 for less than 1000 views", () => {
    expect(calculatePayout(999, 250)).toBe(0);
  });

  it("correctly calculates payout for exactly 1000 views", () => {
    // 1000 views, €2.50 per 1k = €2.50 = 250 cents
    expect(calculatePayout(1000, 250)).toBe(250);
  });

  it("floors partial thousands", () => {
    // 1500 views = floor(1500/1000) = 1 unit × 250 = 250
    expect(calculatePayout(1500, 250)).toBe(250);
  });

  it("correctly calculates for large view counts", () => {
    // 45,200 views = floor(45200/1000) = 45 units × 300 = 13500 cents = €135
    expect(calculatePayout(45200, 300)).toBe(13500);
  });

  it("handles different payout rates", () => {
    // 10,000 views × 150 cents per 1k = 1500 cents
    expect(calculatePayout(10000, 150)).toBe(1500);
  });

  it("is deterministic - same inputs always produce same output", () => {
    const result1 = calculatePayout(25000, 200);
    const result2 = calculatePayout(25000, 200);
    expect(result1).toBe(result2);
    expect(result1).toBe(5000); // 25 units × 200 cents
  });
});
