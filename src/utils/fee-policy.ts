import { configure, getAppState } from "deso-protocol";
import { FeePolicy } from "./fee-policy-core";

const feePolicy = new FeePolicy({
  fetchAdvertisedRate: async () => {
    const appState = await getAppState();
    return appState.DefaultFeeRateNanosPerKB;
  },
  applyRate: (rateNanosPerKB) => {
    configure({ MinFeeRateNanosPerKB: rateNanosPerKB });
  },
});

export function withFeePolicy<T>(operation: () => Promise<T>): Promise<T> {
  return feePolicy.run(operation);
}
