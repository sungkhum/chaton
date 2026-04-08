import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "../store";
import { submitBugReport } from "../services/ticket.service";

type Step = "describe" | "frequency" | "extra" | "confirm" | "done";

const FREQUENCY_OPTIONS = [
  { value: "first-time", label: "First time" },
  { value: "sometimes", label: "Happens sometimes" },
  { value: "every-time", label: "Every time" },
] as const;

export function BugReportModal() {
  const bugReportError = useStore((s) => s.bugReportError);
  const closeBugReport = useStore((s) => s.closeBugReport);
  const [step, setStep] = useState<Step>("describe");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState("");
  const [extra, setExtra] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inflight = useRef(false);

  if (!bugReportError) return null;

  const handleSubmit = async () => {
    if (inflight.current) return;
    inflight.current = true;
    setSubmitting(true);
    try {
      await submitBugReport(bugReportError, {
        description,
        frequency: frequency as "first-time" | "sometimes" | "every-time",
        extra: extra || undefined,
      });
      setStep("done");
    } catch {
      toast.error("Couldn't submit report. Try again later.");
    } finally {
      setSubmitting(false);
      inflight.current = false;
    }
  };

  const handleClose = () => {
    closeBugReport();
    setStep("describe");
    setDescription("");
    setFrequency("");
    setExtra("");
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-t-2xl bg-zinc-900 p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Report a Bug</h3>
          <button
            onClick={handleClose}
            className="text-zinc-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Auto-captured context */}
        <div className="mb-4 rounded-lg bg-zinc-800 p-3 text-sm text-zinc-400">
          <p>
            We captured the error details automatically. Just need a bit of
            context from you.
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Error: {bugReportError.code}
          </p>
        </div>

        {step === "describe" ? (
          <div>
            <p className="mb-2 text-sm text-zinc-300">
              What were you doing when this happened?
            </p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. I was sending a message in a group chat..."
              maxLength={500}
              rows={3}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-3 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
            />
            <div className="mt-2 text-right text-xs text-zinc-500">
              {description.length}/500
            </div>
            <button
              onClick={() => {
                if (description.trim()) setStep("frequency");
              }}
              disabled={!description.trim()}
              className="mt-3 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
            >
              Next
            </button>
          </div>
        ) : step === "frequency" ? (
          <div>
            <p className="mb-3 text-sm text-zinc-300">
              Has this happened before?
            </p>
            <div className="flex flex-col gap-2">
              {FREQUENCY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setFrequency(opt.value);
                    setStep("extra");
                  }}
                  className={`rounded-lg border px-4 py-2.5 text-left text-sm transition-colors ${
                    frequency === opt.value
                      ? "border-blue-500 bg-blue-500/10 text-blue-400"
                      : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ) : step === "extra" ? (
          <div>
            <p className="mb-2 text-sm text-zinc-300">
              Anything else we should know?{" "}
              <span className="text-zinc-500">(optional)</span>
            </p>
            <textarea
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder="Any other details..."
              maxLength={300}
              rows={2}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-3 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
            />
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setStep("confirm")}
                className="flex-1 rounded-lg bg-zinc-700 px-4 py-2.5 text-sm text-zinc-300"
              >
                Skip
              </button>
              <button
                onClick={() => setStep("confirm")}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white"
              >
                Next
              </button>
            </div>
          </div>
        ) : step === "confirm" ? (
          <div>
            <div className="space-y-1 rounded-lg bg-zinc-800 p-3 text-sm">
              <p>
                <span className="text-zinc-500">Error:</span>{" "}
                <span className="text-zinc-300">{bugReportError.code}</span>
              </p>
              <p>
                <span className="text-zinc-500">What happened:</span>{" "}
                <span className="text-zinc-300">{description}</span>
              </p>
              <p>
                <span className="text-zinc-500">Frequency:</span>{" "}
                <span className="text-zinc-300">
                  {FREQUENCY_OPTIONS.find((o) => o.value === frequency)?.label}
                </span>
              </p>
              {extra ? (
                <p>
                  <span className="text-zinc-500">Extra:</span>{" "}
                  <span className="text-zinc-300">{extra}</span>
                </p>
              ) : null}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleClose}
                className="flex-1 rounded-lg bg-zinc-700 px-4 py-2.5 text-sm text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
              >
                {submitting ? "Sending..." : "Submit"}
              </button>
            </div>
          </div>
        ) : (
          <div className="py-4 text-center">
            <p className="text-sm text-zinc-300">
              Thanks! We'll look into this.
            </p>
            <button
              onClick={handleClose}
              className="mt-4 rounded-lg bg-zinc-700 px-6 py-2 text-sm text-zinc-300"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
