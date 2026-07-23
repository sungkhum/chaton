import assert from "node:assert/strict";
import test from "node:test";
import { FeePolicy, isFeeRateRejection } from "../../src/utils/fee-policy-core";

const silentWarn = () => {};

test("uses the advertised rate with a safety margin and caches it", async () => {
  let fetchCount = 0;
  const appliedRates: number[] = [];
  const policy = new FeePolicy({
    fetchAdvertisedRate: async () => {
      fetchCount += 1;
      return 100;
    },
    applyRate: (rate) => appliedRates.push(rate),
    warn: silentWarn,
  });

  await policy.run(async () => "first");
  await policy.run(async () => "second");

  assert.equal(fetchCount, 1);
  assert.deepEqual(appliedRates, [110, 110]);
});

test("deduplicates concurrent live-rate requests", async () => {
  let fetchCount = 0;
  let resolveRate: ((rate: number) => void) | undefined;
  const ratePromise = new Promise<number>((resolve) => {
    resolveRate = resolve;
  });
  const policy = new FeePolicy({
    fetchAdvertisedRate: async () => {
      fetchCount += 1;
      return ratePromise;
    },
    applyRate: () => {},
    warn: silentWarn,
  });

  const first = policy.run(async () => "first");
  const second = policy.run(async () => "second");
  resolveRate?.(100);

  assert.deepEqual(await Promise.all([first, second]), ["first", "second"]);
  assert.equal(fetchCount, 1);
});

test("refreshes and retries after an explicit minimum-fee rejection", async () => {
  const advertisedRates = [100, 200];
  const appliedRates: number[] = [];
  let attempts = 0;
  const policy = new FeePolicy({
    fetchAdvertisedRate: async () => advertisedRates.shift() ?? 200,
    applyRate: (rate) => appliedRates.push(rate),
    warn: silentWarn,
  });

  const result = await policy.run(async () => {
    attempts += 1;
    if (attempts === 1) {
      throw {
        response: {
          data: {
            error:
              "RuleErrorTxnFeeBelowNetworkMinimum: transaction fee rate below minimum",
          },
        },
      };
    }
    return "submitted";
  });

  assert.equal(result, "submitted");
  assert.equal(attempts, 2);
  assert.deepEqual(appliedRates, [110, 220]);
});

test("bumps a stale advertised rate on each rejected attempt", async () => {
  const appliedRates: number[] = [];
  let attempts = 0;
  const policy = new FeePolicy({
    fetchAdvertisedRate: async () => 100,
    applyRate: (rate) => appliedRates.push(rate),
    warn: silentWarn,
  });

  await policy.run(async () => {
    attempts += 1;
    if (attempts < 3) {
      throw new Error("TxnFeeBelowNetworkMinimum");
    }
    return "submitted";
  });

  assert.deepEqual(appliedRates, [110, 220, 440]);
});

test("stops after three explicit fee rejections", async () => {
  const appliedRates: number[] = [];
  let attempts = 0;
  let fetchCount = 0;
  const rejection = new Error("TxnFeeBelowNetworkMinimum");
  const policy = new FeePolicy({
    fetchAdvertisedRate: async () => {
      fetchCount += 1;
      return 100;
    },
    applyRate: (rate) => appliedRates.push(rate),
    warn: silentWarn,
  });

  await assert.rejects(
    policy.run(async () => {
      attempts += 1;
      throw rejection;
    }),
    rejection
  );

  assert.equal(attempts, 3);
  assert.equal(fetchCount, 3);
  assert.deepEqual(appliedRates, [110, 220, 440]);
});

test("does not replay an operation after an ambiguous timeout", async () => {
  let attempts = 0;
  const timeout = new Error("Request timed out while submitting transaction");
  const policy = new FeePolicy({
    fetchAdvertisedRate: async () => 100,
    applyRate: () => {},
    warn: silentWarn,
  });

  await assert.rejects(
    policy.run(async () => {
      attempts += 1;
      throw timeout;
    }),
    timeout
  );
  assert.equal(attempts, 1);
});

test("uses and briefly caches the conservative fallback when lookup fails", async () => {
  let fetchCount = 0;
  const appliedRates: number[] = [];
  const policy = new FeePolicy({
    fetchAdvertisedRate: async () => {
      fetchCount += 1;
      throw new Error("node unavailable");
    },
    applyRate: (rate) => appliedRates.push(rate),
    warn: silentWarn,
  });

  await policy.run(async () => undefined);
  await policy.run(async () => undefined);

  assert.equal(fetchCount, 1);
  assert.deepEqual(appliedRates, [1_000, 1_000]);
});

test("recognizes fee errors but not generic validation errors", () => {
  assert.equal(
    isFeeRateRejection({
      response: { data: "fee rate is below the network minimum" },
    }),
    true
  );
  assert.equal(
    isFeeRateRejection(new Error("transaction failed validation")),
    false
  );
});
