import { FC, useState } from "react";
import { Loader2 } from "lucide-react";

export const MessagingConversationButton: FC<{
  onClick: () => void;
}> = ({ onClick }) => {
  const [isSending, setIsSending] = useState(false);
  return (
    <div>
      <h2 className="text-2xl font-bold mb-3 text-white">
        Awesome, we're ready!
      </h2>
      <p className="text-lg mb-5 text-gray-400">
        The app will generate a test conversation for you.
        <br />
        Just press the button below to continue.
      </p>

      <button
        className="glass-btn-primary text-[#34F080] font-bold rounded-full text-lg px-6 py-3 cursor-pointer transition-colors"
        onClick={async () => {
          setIsSending(true);
          try {
            await onClick();
          } catch {
            setIsSending(false);
          }
          setIsSending(false);
        }}
      >
        <div className="flex justify-center">
          {isSending ? (
            <Loader2 className="w-7 h-7 mx-2 animate-spin" />
          ) : (
            <div className="mx-2">Load Conversations</div>
          )}
        </div>
      </button>
    </div>
  );
};
