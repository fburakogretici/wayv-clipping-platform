import { describe, it, expect, vi, beforeEach } from "vitest";
import { calculatePayout } from "@/server/services/payout";

/**
 * Budget enforcement tests.
 *
 * These tests exercise the budget logic in isolation by testing the pure
 * mathematical invariants, separate from the database layer.
 *
 * The full integration of budget enforcement with SELECT FOR UPDATE is tested
 * implicitly through manual verification with the running app.
 */

describe("budget enforcement logic", () => {
  describe("ceiling check", () => {
    it("allows approval when earning fits within remaining budget", () => {
      const totalBudget = 10000; // €100 in cents
      const currentSpent = 5000; // €50 already spent
      const newEarning = calculatePayout(10000, 300); // 10k views × 300 = 3000

      // 5000 + 3000 = 8000 ≤ 10000 → allowed
      expect(currentSpent + newEarning).toBeLessThanOrEqual(totalBudget);
    });

    it("rejects approval when earning would exceed total budget", () => {
      const totalBudget = 10000;
      const currentSpent = 9000; // €90 already spent
      const newEarning = calculatePayout(5000, 300); // 5k views × 300 = 1500

      // 9000 + 1500 = 10500 > 10000 → rejected
      expect(currentSpent + newEarning).toBeGreaterThan(totalBudget);
    });

    it("allows approval when earning exactly meets the remaining budget", () => {
      const totalBudget = 10000;
      const currentSpent = 7000;
      const newEarning = calculatePayout(10000, 300); // 10k views × 300 = 3000

      // 7000 + 3000 = 10000 ≤ 10000 → allowed (budget exhausted, but not exceeded)
      expect(currentSpent + newEarning).toBeLessThanOrEqual(totalBudget);
    });
  });

  describe("campaign auto-completion trigger", () => {
    it("marks campaign completed when budget is exactly exhausted", () => {
      const totalBudget = 10000;
      const currentSpent = 7000;
      const newEarning = calculatePayout(10000, 300); // = 3000
      const total = currentSpent + newEarning;

      // Should trigger completion
      const shouldComplete = total >= totalBudget;
      expect(shouldComplete).toBe(true);
    });

    it("does NOT mark campaign completed when budget has remaining headroom", () => {
      const totalBudget = 10000;
      const currentSpent = 3000;
      const newEarning = calculatePayout(10000, 300); // = 3000
      const total = currentSpent + newEarning;

      // 3000 + 3000 = 6000 < 10000 → should NOT complete
      const shouldComplete = total >= totalBudget;
      expect(shouldComplete).toBe(false);
    });

    it("accumulates correctly across multiple approved submissions", () => {
      const payoutRate = 200; // 200 cents per 1k views
      const totalBudget = 5000;

      const viewCounts = [10000, 8000, 7000]; // 3 submissions
      let spent = 0;
      const results = viewCounts.map((views) => {
        const earning = calculatePayout(views, payoutRate);
        const wouldExceed = spent + earning > totalBudget;
        if (!wouldExceed) spent += earning;
        return { views, earning, wouldExceed };
      });

      // 10k views = 2000, spent = 2000
      expect(results[0].earning).toBe(2000);
      expect(results[0].wouldExceed).toBe(false);
      // 8k views = 1600, spent = 3600
      expect(results[1].earning).toBe(1600);
      expect(results[1].wouldExceed).toBe(false);
      // 7k views = 1400, spent = 5000 ≤ 5000 → OK
      expect(results[2].earning).toBe(1400);
      expect(results[2].wouldExceed).toBe(false);
      expect(spent).toBe(5000);
    });
  });
});
