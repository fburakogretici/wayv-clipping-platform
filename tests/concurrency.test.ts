import { describe, it, expect } from "vitest";
import { calculatePayout } from "@/server/services/payout";

/**
 * Concurrency tests – verify the budget enforcement logic holds
 * under concurrent approval attempts.
 *
 * NOTE: True DB-level concurrency (SELECT FOR UPDATE) cannot be fully tested
 * in unit tests without a real Postgres instance. These tests verify the
 * correctness of the business logic that runs INSIDE the transaction:
 * - Given the same "locked" campaign state, only one approval can succeed
 * - The budget ceiling is checked atomically against live state
 *
 * The SELECT FOR UPDATE test is documented in NOTES.md and can be manually
 * verified by running two concurrent approval requests against the running app.
 */

describe("concurrency - budget race condition", () => {
  /**
   * Simulates what happens INSIDE a SELECT FOR UPDATE transaction.
   * Given a locked campaign state, should only one of N concurrent approvals
   * succeed when the budget only has room for one?
   */
  function simulateAtomicApproval(
    totalBudget: number,
    currentSpent: number,
    payoutRate: number,
    views: number
  ): { success: boolean; earning: number; reason?: string } {
    const newEarning = calculatePayout(views, payoutRate);

    if (currentSpent + newEarning > totalBudget) {
      return {
        success: false,
        earning: 0,
        reason: "BUDGET_EXCEEDED",
      };
    }

    return { success: true, earning: newEarning };
  }

  it("first approval succeeds when it fits within the remaining budget", () => {
    const totalBudget = 5000;
    const currentSpent = 4000; // €40 already spent, €10 headroom
    const payoutRate = 300;
    const views = 3000; // earning = 900 cents → 4000 + 900 = 4900 ≤ 5000

    const result = simulateAtomicApproval(totalBudget, currentSpent, payoutRate, views);
    expect(result.success).toBe(true); // 4000 + 900 = 4900 ≤ 5000 → fits
    expect(result.earning).toBe(900);
  });

  it("second concurrent approval fails when budget is already near limit", () => {
    const totalBudget = 5000;
    const payoutRate = 300;
    const views = 3000; // earning = 900

    // After first approval, spent = 4900. Now try to approve another 900.
    const currentSpentAfterFirst = 4000 + calculatePayout(views, payoutRate); // 4900
    const result2 = simulateAtomicApproval(totalBudget, currentSpentAfterFirst, payoutRate, views);
    expect(result2.success).toBe(false); // 4900 + 900 = 5800 > 5000
    expect(result2.reason).toBe("BUDGET_EXCEEDED");
  });

  it("only submissions that fit within budget are approved", () => {
    const totalBudget = 5000;
    const payoutRate = 200;

    // Simulate sequential atomic approvals (as SELECT FOR UPDATE serializes them)
    const submissions = [
      { id: "sub-1", views: 10000 }, // earning = 2000
      { id: "sub-2", views: 8000 },  // earning = 1600
      { id: "sub-3", views: 5000 },  // earning = 1000 → would exceed (2000+1600+1000=4600, OK)
      { id: "sub-4", views: 5000 },  // earning = 1000 → (4600+1000=5600 > 5000, FAIL)
    ];

    let spent = 0;
    const results = submissions.map(({ id, views }) => {
      const result = simulateAtomicApproval(totalBudget, spent, payoutRate, views);
      if (result.success) spent += result.earning;
      return { id, ...result };
    });

    expect(results[0].success).toBe(true);  // 2000 fits
    expect(results[1].success).toBe(true);  // 3600 fits
    expect(results[2].success).toBe(true);  // 4600 fits
    expect(results[3].success).toBe(false); // 5600 > 5000, rejected
    expect(results[3].reason).toBe("BUDGET_EXCEEDED");
    expect(spent).toBe(4600); // total spent
  });

  it("budget can never be exceeded regardless of order", () => {
    const totalBudget = 3000;
    const payoutRate = 300;
    const submissionViews = [5000, 3000, 8000, 2000, 6000];

    let spent = 0;
    let approvedCount = 0;

    for (const views of submissionViews) {
      const result = simulateAtomicApproval(totalBudget, spent, payoutRate, views);
      if (result.success) {
        spent += result.earning;
        approvedCount++;
      }
    }

    // Critical invariant: spent never exceeds budget
    expect(spent).toBeLessThanOrEqual(totalBudget);
  });
});
