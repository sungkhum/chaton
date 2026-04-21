import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "../store";
import { submitBugReport } from "../services/ticket.service";

type Step = "describe" | "frequency" | "extra" | "confirm" | "done";

const FREQUENCY_OPTIONS = [
  { value: "first-time", label: "Only once so far" },
  { value: "sometimes", label: "It happens sometimes" },
  { value: "every-time", label: "Every single time" },
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

  const stepNumber =
    step === "describe"
      ? 1
      : step === "frequency"
      ? 2
      : step === "extra"
      ? 3
      : step === "confirm"
      ? 3
      : 0;
  const totalSteps = 3;
  const hasContent = description.trim() || extra.trim();

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
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Couldn't submit report: ${reason}`);
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
    inflight.current = false;
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    if (submitting) return;
    if (hasContent && step !== "done") {
      if (!window.confirm("Discard your report?")) return;
    }
    handleClose();
  };

  const goBack = () => {
    const prev: Record<string, Step> = {
      frequency: "describe",
      extra: "frequency",
      confirm: "extra",
    };
    setStep(prev[step] || "describe");
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 sm:items-center"
      onClick={handleBackdropClick}
    >
      <div className="flex max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-[#0a1628] shadow-2xl shadow-black/50 sm:max-h-[90vh] sm:rounded-2xl">
        {/* Amber accent bar for error-triggered reports */}
        <div className="h-[2px] bg-gradient-to-r from-amber-500 via-amber-400 to-orange-400" />

        <div className="overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {step !== "describe" && step !== "done" ? (
                <button
                  onClick={goBack}
                  aria-label="Go back"
                  className="-ml-2 mr-0.5 rounded-lg p-2 text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
              ) : null}
              <h3 className="text-[15px] font-semibold text-white">
                {step === "done" ? "Bug Reported" : "Report a Bug"}
              </h3>
            </div>
            <button
              onClick={() => {
                if (submitting) return;
                if (hasContent && step !== "done") {
                  if (!window.confirm("Discard your report?")) return;
                }
                handleClose();
              }}
              aria-label="Close"
              className="rounded-lg p-2 text-white/30 transition-colors hover:bg-white/5 hover:text-white/60"
            >
              <X size={18} />
            </button>
          </div>

          {/* Auto-captured context pill + empathetic message */}
          <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
            <p className="text-xs text-white/60">
              Sorry about that. We captured the error details — a few quick
              answers will help us fix this.
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              <code className="text-[10px] text-amber-400/70">
                {bugReportError.code}
              </code>
            </div>
          </div>

          {/* Step indicator */}
          {stepNumber > 0 ? (
            <div
              className="mb-4 flex gap-1.5"
              role="progressbar"
              aria-valuenow={stepNumber}
              aria-valuemax={totalSteps}
              aria-label={`Step ${stepNumber} of ${totalSteps}`}
            >
              {Array.from({ length: totalSteps }, (_, i) => (
                <div
                  key={i}
                  className={`h-[3px] flex-1 rounded-full transition-colors ${
                    i < stepNumber ? "bg-amber-400" : "bg-white/10"
                  }`}
                />
              ))}
            </div>
          ) : null}

          {step === "describe" ? (
            <div>
              <label
                htmlFor="bug-describe"
                className="mb-1 block text-sm font-medium text-white/80"
              >
                What were you doing when this happened?
              </label>
              <p className="mb-3 text-xs text-white/35">
                Help us understand the context
              </p>
              <textarea
                id="bug-describe"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. I was sending a message in a group chat..."
                maxLength={500}
                rows={3}
                autoFocus
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3.5 text-sm text-white placeholder-white/35 transition-colors focus:border-white/20 focus:bg-white/[0.04] focus:outline-none"
              />
              <div className="mt-1.5 text-right text-[11px] text-white/20 tabular-nums">
                {description.length}/500
              </div>
              <button
                onClick={() => {
                  if (description.trim()) setStep("frequency");
                }}
                disabled={!description.trim()}
                className="mt-2 w-full rounded-xl bg-gradient-to-r from-[#34F080] to-[#20E0AA] px-4 py-2.5 text-sm font-semibold text-black transition-all hover:shadow-[0_0_20px_rgba(52,240,128,0.2)] active:scale-[0.96] disabled:opacity-30 disabled:shadow-none"
              >
                Continue
              </button>
            </div>
          ) : step === "frequency" ? (
            <div>
              <p className="mb-1 text-sm font-medium text-white/80">
                Has this happened before?
              </p>
              <p className="mb-3 text-xs text-white/35">
                Helps us understand how urgent this is
              </p>
              <div
                className="flex flex-col gap-2"
                role="radiogroup"
                aria-label="Frequency"
              >
                {FREQUENCY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    role="radio"
                    aria-checked={frequency === opt.value}
                    onClick={() => {
                      setFrequency(opt.value);
                      setStep("extra");
                    }}
                    className={`rounded-xl border px-4 py-3 text-left text-sm transition-all active:scale-[0.96] ${
                      frequency === opt.value
                        ? "border-[#34F080]/40 bg-[#34F080]/10 text-[#34F080]"
                        : "border-white/[0.06] bg-white/[0.02] text-white/70 hover:border-white/15 hover:bg-white/[0.04]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ) : step === "extra" ? (
            <div>
              <label
                htmlFor="bug-extra"
                className="mb-1 block text-sm font-medium text-white/80"
              >
                Anything else we should know?
              </label>
              <p className="mb-3 text-xs text-white/35">
                Optional — skip if nothing comes to mind
              </p>
              <textarea
                id="bug-extra"
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                placeholder="Any other details..."
                maxLength={300}
                rows={2}
                autoFocus
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3.5 text-sm text-white placeholder-white/35 transition-colors focus:border-white/20 focus:bg-white/[0.04] focus:outline-none"
              />
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setStep("confirm")}
                  className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white/50 transition-colors hover:bg-white/[0.06]"
                >
                  Skip
                </button>
                <button
                  onClick={() => setStep("confirm")}
                  className="flex-1 rounded-xl bg-gradient-to-r from-[#34F080] to-[#20E0AA] px-4 py-2.5 text-sm font-semibold text-black transition-all hover:shadow-[0_0_20px_rgba(52,240,128,0.2)] active:scale-[0.96]"
                >
                  Continue
                </button>
              </div>
            </div>
          ) : step === "confirm" ? (
            <div>
              <p className="mb-3 text-xs text-white/40">
                Here's what we'll send along with the auto-captured error data:
              </p>
              <div className="space-y-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                    Error
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-amber-400/70">
                    {bugReportError.code}
                  </p>
                </div>
                <div className="border-t border-white/[0.04]" />
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                    What happened
                  </p>
                  <p className="mt-0.5 break-words text-white/70">
                    {description}
                  </p>
                </div>
                <div className="border-t border-white/[0.04]" />
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                    Frequency
                  </p>
                  <p className="mt-0.5 text-white/70">
                    {
                      FREQUENCY_OPTIONS.find((o) => o.value === frequency)
                        ?.label
                    }
                  </p>
                </div>
                {extra ? (
                  <>
                    <div className="border-t border-white/[0.04]" />
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                        Extra
                      </p>
                      <p className="mt-0.5 text-white/70">{extra}</p>
                    </div>
                  </>
                ) : null}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    if (submitting) return;
                    if (hasContent) {
                      if (!window.confirm("Discard your report?")) return;
                    }
                    handleClose();
                  }}
                  className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white/50 transition-colors hover:bg-white/[0.06]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 rounded-xl bg-gradient-to-r from-[#34F080] to-[#20E0AA] px-4 py-2.5 text-sm font-semibold text-black transition-all hover:shadow-[0_0_20px_rgba(52,240,128,0.2)] active:scale-[0.96] disabled:opacity-30 disabled:shadow-none"
                >
                  {submitting ? "Sending..." : "Submit"}
                </button>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#34F080]/10">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#34F080"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-sm font-medium text-white/80">
                Thanks for reporting this!
              </p>
              <p className="mt-1 text-xs text-white/35">
                We'll investigate and work on a fix. We read every report.
              </p>
              <button
                onClick={handleClose}
                className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] px-8 py-2 text-sm text-white/50 transition-colors hover:bg-white/[0.06]"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
