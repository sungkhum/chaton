import { AppUser } from "../store";
import { identity } from "deso-protocol";
import { Fragment } from "react";
import { desoNanosToDeso } from "../utils/helpers";
import { shortenLongWord } from "../utils/search-helpers";
import { AlertNotification } from "./shared/alert-notification";
import { SaveToClipboard } from "./shared/save-to-clipboard";

export interface StartGroupChatProps {
  appUser: AppUser;
  onClose: () => void;
}

export const SendFundsDialog = ({ appUser, onClose }: StartGroupChatProps) => {
  return (
    <Fragment>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-50 modal-backdrop-enter"
        onClick={onClose}
      />
      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-[#0c1220] text-white border border-white/8 w-[min(95vw,440px)] max-h-[95%] overflow-y-auto custom-scrollbar rounded-2xl shadow-2xl shadow-black/40 modal-card-enter">
          <div className="text-white text-xl font-semibold p-5 border-b border-white/8">
            Get $DESO to get started
          </div>

          <div className="p-5">
            <AlertNotification type="info">
              <div className="break-words text-black text-center">
                No deso funds found for your address:
                <div>
                  <div className="bg-gray-700 text-white px-2 md:px-4 py-2 my-2 md:my-3 rounded mx-auto inline-block">
                    <SaveToClipboard text={appUser.PublicKeyBase58Check}>
                      {shortenLongWord(appUser.PublicKeyBase58Check, 8, 8)}
                    </SaveToClipboard>
                  </div>
                </div>
                Click &quot;Get $DESO&quot; button below to add some through
                phone verification. Otherwise you can send $DESO from another
                account.
              </div>
            </AlertNotification>

            <div className="text-[24px] text-center my-2 md:my-8 text-white">
              <span>
                Your Balance:{" "}
                <b>{desoNanosToDeso(appUser.BalanceNanos)} $DESO</b>
              </span>

              <div className="text-sm italic">
                We refresh your balance every 3 seconds.
              </div>

              <div className="mt-1 md:mt-2">
                <button
                  className="glass-btn-primary text-[#34F080] font-semibold rounded-lg text-sm px-4 py-2 cursor-pointer transition-colors"
                  onClick={() => identity.verifyPhoneNumber()}
                >
                  Get $DESO
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Fragment>
  );
};
