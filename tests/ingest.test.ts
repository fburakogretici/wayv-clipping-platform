import { describe, it, expect } from "vitest";

/**
 * Ingest idempotency tests.
 *
 * The real ingest script uses ON CONFLICT (submission_id, captured_at) DO UPDATE
 * which ensures the same day's data can be re-ingested safely without duplicates.
 *
 * These tests verify the pure logic of the ingest pipeline:
 * - Idempotency: running twice produces the same result
 * - Monotonic views: views only increase, never decrease
 * - Partial failure isolation: one bad item doesn't break the whole batch
 */

type MetricRecord = {
  submissionId: string;
  capturedAt: string;
  views: number;
  likes: number;
  comments: number;
};

// Simulates the upsert logic from the ingest script
function upsertMetric(
  store: Map<string, MetricRecord>,
  record: MetricRecord
): void {
  const key = `${record.submissionId}::${record.capturedAt}`;
  const existing = store.get(key);

  if (existing) {
    // ON CONFLICT DO UPDATE: merge with monotonic view enforcement
    store.set(key, {
      ...record,
      views: Math.max(existing.views, record.views), // views only grow
    });
  } else {
    store.set(key, record);
  }
}

// Simulates the per-item error isolation in the ingest loop
async function ingestBatch(
  items: Array<{ submissionId: string; fetchData: () => Promise<MetricRecord> }>,
  store: Map<string, MetricRecord>
): Promise<{ succeeded: number; failed: number; errors: string[] }> {
  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const item of items) {
    try {
      const data = await item.fetchData();
      upsertMetric(store, data);
      succeeded++;
    } catch (err) {
      failed++;
      errors.push(`${item.submissionId}: ${(err as Error).message}`);
    }
  }

  return { succeeded, failed, errors };
}

describe("ingest idempotency", () => {
  it("inserting the same record twice produces one entry", () => {
    const store = new Map<string, MetricRecord>();
    const record: MetricRecord = {
      submissionId: "sub-1",
      capturedAt: "2026-09-03",
      views: 10000,
      likes: 500,
      comments: 30,
    };

    upsertMetric(store, record);
    upsertMetric(store, record); // same data again

    expect(store.size).toBe(1);
    expect(store.get("sub-1::2026-09-03")?.views).toBe(10000);
  });

  it("updated metrics overwrite existing ones for the same date", () => {
    const store = new Map<string, MetricRecord>();

    upsertMetric(store, {
      submissionId: "sub-1",
      capturedAt: "2026-09-03",
      views: 10000,
      likes: 500,
      comments: 30,
    });

    upsertMetric(store, {
      submissionId: "sub-1",
      capturedAt: "2026-09-03",
      views: 15000, // views grew during the day
      likes: 700,
      comments: 42,
    });

    const record = store.get("sub-1::2026-09-03");
    expect(record?.views).toBe(15000); // updated to latest
    expect(store.size).toBe(1); // still one record
  });

  it("views are monotonically increasing - lower value does not overwrite higher", () => {
    const store = new Map<string, MetricRecord>();

    upsertMetric(store, {
      submissionId: "sub-1",
      capturedAt: "2026-09-03",
      views: 20000,
      likes: 900,
      comments: 60,
    });

    // Simulate stale/delayed data with lower view count (API fluke)
    upsertMetric(store, {
      submissionId: "sub-1",
      capturedAt: "2026-09-03",
      views: 5000, // lower than existing – should NOT decrease
      likes: 200,
      comments: 10,
    });

    expect(store.get("sub-1::2026-09-03")?.views).toBe(20000);
  });

  it("different dates create separate records", () => {
    const store = new Map<string, MetricRecord>();

    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      upsertMetric(store, {
        submissionId: "sub-1",
        capturedAt: date.toISOString().split("T")[0],
        views: 1000 + i * 500,
        likes: 50,
        comments: 5,
      });
    }

    expect(store.size).toBe(7);
  });
});

describe("ingest partial failure isolation", () => {
  it("a single failing item does not prevent other items from being processed", async () => {
    const store = new Map<string, MetricRecord>();
    const today = new Date().toISOString().split("T")[0];

    const items = [
      {
        submissionId: "sub-1",
        fetchData: async () => ({
          submissionId: "sub-1",
          capturedAt: today,
          views: 12000,
          likes: 600,
          comments: 35,
        }),
      },
      {
        submissionId: "sub-2",
        fetchData: async (): Promise<MetricRecord> => {
          throw new Error("API rate limit exceeded"); // simulates failure
        },
      },
      {
        submissionId: "sub-3",
        fetchData: async () => ({
          submissionId: "sub-3",
          capturedAt: today,
          views: 8000,
          likes: 400,
          comments: 22,
        }),
      },
    ];

    const result = await ingestBatch(items, store);

    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.errors[0]).toContain("sub-2");
    expect(store.size).toBe(2); // sub-1 and sub-3 succeeded
  });
});
