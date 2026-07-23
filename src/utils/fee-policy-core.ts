const CACHE_TTL_MS = 5 * 60 * 1000;
const FALLBACK_CACHE_TTL_MS = 30 * 1000;
const FALLBACK_FEE_RATE_NANOS_PER_KB = 1_000;
const MAX_FEE_RATE_NANOS_PER_KB = 5_000;
const SAFETY_MULTIPLIER_NUMERATOR = 11;
const SAFETY_MULTIPLIER_DENOMINATOR = 10;
const RETRY_MULTIPLIER = 2;
const MAX_ATTEMPTS = 3;

type FeePolicyDependencies = {
  fetchAdvertisedRate: () => Promise<number>;
  applyRate: (rateNanosPerKB: number) => void;
  now?: () => number;
  warn?: (message: string, error?: unknown) => void;
};

type CachedRate = {
  rateNanosPerKB: number;
  expiresAt: number;
};

const FEE_REJECTION_PATTERNS = [
  /RuleErrorTxnFeeBelowNetworkMinimum/i,
  /TxnFeeBelowNetworkMinimum/i,
  /fee rate.+below.+minimum/i,
  /fee.+less than.+network minimum/i,
  /minimum network fee/i,
];

// Transport timeouts are intentionally excluded: after submission starts, a
// timeout does not prove the transaction failed, and replaying it could duplicate
// a payment, message, or profile update.
function errorMessage(error: unknown): string {
  const values: unknown[] = [error];

  if (error && typeof error === "object") {
    const candidate = error as {
      message?: unknown;
      cause?: unknown;
      error?: unknown;
      response?: { data?: unknown };
    };
    values.push(
      candidate.message,
      candidate.cause,
      candidate.error,
      candidate.response?.data
    );
  }

  return values
    .filter((value) => value !== undefined && value !== null)
    .map((value) => {
      if (typeof value === "string") {
        return value;
      }

      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    })
    .join(" ");
}

export function isFeeRateRejection(error: unknown): boolean {
  const message = errorMessage(error);
  return FEE_REJECTION_PATTERNS.some((pattern) => pattern.test(message));
}

function normalizeAdvertisedRate(rateNanosPerKB: number): number {
  if (
    !Number.isFinite(rateNanosPerKB) ||
    rateNanosPerKB <= 0 ||
    !Number.isSafeInteger(rateNanosPerKB)
  ) {
    throw new Error(
      `Node advertised an invalid minimum fee rate: ${rateNanosPerKB}`
    );
  }

  if (rateNanosPerKB > MAX_FEE_RATE_NANOS_PER_KB) {
    throw new Error(
      `Node advertised a fee rate above ChatOn's safety limit: ${rateNanosPerKB}`
    );
  }

  return Math.min(
    MAX_FEE_RATE_NANOS_PER_KB,
    Math.ceil(
      (rateNanosPerKB * SAFETY_MULTIPLIER_NUMERATOR) /
        SAFETY_MULTIPLIER_DENOMINATOR
    )
  );
}

export class FeePolicy {
  private cachedRate: CachedRate | undefined;
  private pendingRate: Promise<number> | undefined;
  private readonly now: () => number;
  private readonly warn: (message: string, error?: unknown) => void;

  constructor(private readonly dependencies: FeePolicyDependencies) {
    this.now = dependencies.now ?? Date.now;
    this.warn = dependencies.warn ?? console.warn;
  }

  private async fetchRate(forceRefresh = false): Promise<number> {
    const now = this.now();
    if (!forceRefresh && this.cachedRate && this.cachedRate.expiresAt > now) {
      return this.cachedRate.rateNanosPerKB;
    }

    if (this.pendingRate) {
      return this.pendingRate;
    }

    this.pendingRate = (async () => {
      try {
        const advertisedRate = await this.dependencies.fetchAdvertisedRate();
        const rateNanosPerKB = normalizeAdvertisedRate(advertisedRate);
        this.cachedRate = {
          rateNanosPerKB,
          expiresAt: this.now() + CACHE_TTL_MS,
        };
        return rateNanosPerKB;
      } catch (error) {
        if (this.cachedRate) {
          this.warn(
            "Could not refresh the node fee rate; using the last known safe rate.",
            error
          );
          return this.cachedRate.rateNanosPerKB;
        }

        this.warn(
          "Could not fetch the node fee rate; using the conservative fallback.",
          error
        );
        this.cachedRate = {
          rateNanosPerKB: FALLBACK_FEE_RATE_NANOS_PER_KB,
          expiresAt: this.now() + FALLBACK_CACHE_TTL_MS,
        };
        return FALLBACK_FEE_RATE_NANOS_PER_KB;
      } finally {
        this.pendingRate = undefined;
      }
    })();

    return this.pendingRate;
  }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    let rateNanosPerKB = await this.fetchRate();

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      // A concurrent transaction may have already discovered a higher minimum.
      // Never lower the shared SDK rate below the newest cached value.
      rateNanosPerKB = Math.max(
        rateNanosPerKB,
        this.cachedRate?.rateNanosPerKB ?? rateNanosPerKB
      );
      this.dependencies.applyRate(rateNanosPerKB);

      try {
        return await operation();
      } catch (error) {
        if (!isFeeRateRejection(error) || attempt === MAX_ATTEMPTS) {
          throw error;
        }

        const refreshedRate = await this.fetchRate(true);
        const bumpedRate = Math.ceil(rateNanosPerKB * RETRY_MULTIPLIER);
        const nextRate = Math.min(
          MAX_FEE_RATE_NANOS_PER_KB,
          Math.max(refreshedRate, bumpedRate)
        );

        if (nextRate <= rateNanosPerKB) {
          throw error;
        }

        rateNanosPerKB = nextRate;
        this.cachedRate = {
          rateNanosPerKB,
          expiresAt: this.now() + CACHE_TTL_MS,
        };
      }
    }

    throw new Error("Fee policy exhausted without completing the transaction.");
  }
}
