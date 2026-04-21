import { useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Bug,
  Lightbulb,
  Wrench,
  HelpCircle,
  Heart,
  MessageCircle,
  ImagePlus,
} from "lucide-react";
import { toast } from "sonner";
import { useStore } from "../store";
import { submitFeedback } from "../services/feedback.service";
import { submitManualBugReport } from "../services/ticket.service";
import { uploadImage } from "../services/media.service";

const CATEGORIES = [
  {
    value: "feature-request",
    label: "Feature Request",
    icon: Lightbulb,
    description: "I have an idea for something new",
  },
  {
    value: "improvement",
    label: "Improvement",
    icon: Wrench,
    description: "Make something better",
  },
  {
    value: "bug",
    label: "Report a Bug",
    icon: Bug,
    description: "Something isn't working right",
  },
  {
    value: "question",
    label: "Question",
    icon: HelpCircle,
    description: "I need help with something",
  },
  {
    value: "praise",
    label: "Love Something",
    icon: Heart,
    description: "Tell us what's great",
  },
  {
    value: "other",
    label: "Other",
    icon: MessageCircle,
    description: "Something else",
  },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];

const FREQUENCY_OPTIONS = [
  { value: "first-time", label: "Only once so far" },
  { value: "sometimes", label: "It happens sometimes" },
  { value: "every-time", label: "Every single time" },
] as const;

// Bug path: category → describe (combined) → frequency → confirm → done
// Feedback path: category → describe → done (submit directly, no confirm)
type Step =
  | "category"
  | "bug-describe"
  | "bug-frequency"
  | "confirm"
  | "describe"
  | "done";

export function FeedbackModal() {
  const feedbackModalOpen = useStore((s) => s.feedbackModalOpen);
  const closeFeedbackModal = useStore((s) => s.closeFeedbackModal);
  const [step, setStep] = useState<Step>("category");
  const [category, setCategory] = useState<Category | "">("");
  const [description, setDescription] = useState("");

  // Bug-specific fields
  const [whatWentWrong, setWhatWentWrong] = useState("");
  const [whatWereDoing, setWhatWereDoing] = useState("");
  const [frequency, setFrequency] = useState("");

  // Screenshot attachment
  const [screenshot, setScreenshot] = useState<{
    file: File;
    previewUrl: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const inflight = useRef(false);

  const stageScreenshot = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Only images are supported");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Image must be under 10 MB");
        return;
      }
      // Revoke previous preview URL
      if (screenshot) URL.revokeObjectURL(screenshot.previewUrl);
      setScreenshot({ file, previewUrl: URL.createObjectURL(file) });
    },
    [screenshot]
  );

  const clearScreenshot = useCallback(() => {
    if (screenshot) URL.revokeObjectURL(screenshot.previewUrl);
    setScreenshot(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [screenshot]);

  if (!feedbackModalOpen) return null;

  const isBugPath = category === "bug";
  const selectedCategory = CATEGORIES.find((c) => c.value === category);
  const hasContent =
    description.trim() ||
    whatWentWrong.trim() ||
    whatWereDoing.trim() ||
    screenshot;

  const handleSubmit = async () => {
    if (inflight.current) return;
    inflight.current = true;
    setSubmitting(true);
    try {
      let screenshotUrl: string | undefined;
      if (screenshot) {
        const result = await uploadImage(screenshot.file);
        screenshotUrl = result.ImageURL;
      }
      if (isBugPath) {
        await submitManualBugReport({
          whatWentWrong,
          whatWereDoing,
          frequency: frequency as "first-time" | "sometimes" | "every-time",
          screenshotUrl,
        });
      } else {
        await submitFeedback({ category, description, screenshotUrl });
      }
      setStep("done");
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Couldn't submit feedback: ${reason}`);
    } finally {
      setSubmitting(false);
      inflight.current = false;
    }
  };

  const resetState = () => {
    setStep("category");
    setCategory("");
    setDescription("");
    setWhatWentWrong("");
    setWhatWereDoing("");
    setFrequency("");
    clearScreenshot();
    inflight.current = false;
  };

  const handleClose = () => {
    closeFeedbackModal();
    resetState();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    if (submitting) return;
    if (hasContent && step !== "done") {
      if (!window.confirm("Discard your draft?")) return;
    }
    handleClose();
  };

  const handleCategorySelect = (value: Category) => {
    setCategory(value);
    setStep(value === "bug" ? "bug-describe" : "describe");
  };

  const goBack = () => {
    if (isBugPath) {
      const prev: Record<string, Step> = {
        "bug-frequency": "bug-describe",
        confirm: "bug-frequency",
      };
      const target = prev[step];
      if (target) {
        setStep(target);
      } else {
        setStep("category");
        setCategory("");
      }
    } else {
      setStep("category");
      setCategory("");
    }
  };

  // Step indicators
  const bugStepNumber =
    step === "bug-describe"
      ? 1
      : step === "bug-frequency"
      ? 2
      : step === "confirm"
      ? 3
      : 0;
  const totalBugSteps = 3;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 sm:items-center"
      onClick={handleBackdropClick}
    >
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-[#0a1628] shadow-2xl shadow-black/50 sm:max-h-[90vh] sm:rounded-2xl">
        {/* Gradient accent bar */}
        <div className="h-[2px] bg-gradient-to-r from-[#34F080] via-[#20E0AA] to-[#40B8E0]" />

        <div className="overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {/* Header */}
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {step !== "category" && step !== "done" ? (
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
                {step === "done"
                  ? isBugPath
                    ? "Bug Reported"
                    : "Feedback Sent"
                  : isBugPath && step !== "category"
                  ? "Report a Bug"
                  : "Send Feedback"}
              </h3>
            </div>
            <button
              onClick={() => {
                if (submitting) return;
                if (hasContent && step !== "done") {
                  if (!window.confirm("Discard your draft?")) return;
                }
                handleClose();
              }}
              aria-label="Close"
              className="rounded-lg p-2 text-white/30 transition-colors hover:bg-white/5 hover:text-white/60"
            >
              <X size={18} />
            </button>
          </div>

          {/* Bug path: step indicator */}
          {isBugPath && bugStepNumber > 0 ? (
            <div
              className="mb-4 flex gap-1.5"
              role="progressbar"
              aria-valuenow={bugStepNumber}
              aria-valuemax={totalBugSteps}
              aria-label={`Step ${bugStepNumber} of ${totalBugSteps}`}
            >
              {Array.from({ length: totalBugSteps }, (_, i) => (
                <div
                  key={i}
                  className={`h-[3px] flex-1 rounded-full transition-colors ${
                    i < bugStepNumber ? "bg-[#34F080]" : "bg-white/10"
                  }`}
                />
              ))}
            </div>
          ) : null}

          {/* ── Category selection ── */}
          {step === "category" ? (
            <div className="flex flex-col gap-1.5">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.value}
                    onClick={() => handleCategorySelect(cat.value)}
                    className="flex items-center gap-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-left transition-[border-color,background-color,transform] hover:border-[#34F080]/30 hover:bg-[#34F080]/5 active:scale-[0.98]"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] text-white/50">
                      <Icon size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white/90">
                        {cat.label}
                      </p>
                      <p className="text-xs text-white/35">{cat.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* ── Bug path: Combined describe screen ── */}
          {step === "bug-describe" ? (
            <div
              onPaste={(e) => {
                const items = e.clipboardData?.items;
                if (!items) return;
                for (const item of items) {
                  if (item.type.startsWith("image/")) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    if (file) stageScreenshot(file);
                    return;
                  }
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files?.[0];
                if (file?.type.startsWith("image/")) stageScreenshot(file);
              }}
            >
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="bug-problem"
                    className="mb-1.5 block text-sm font-medium text-white/80"
                  >
                    What went wrong?
                  </label>
                  <textarea
                    id="bug-problem"
                    value={whatWentWrong}
                    onChange={(e) => setWhatWentWrong(e.target.value)}
                    placeholder="e.g. Messages aren't loading, the screen goes blank..."
                    maxLength={500}
                    rows={3}
                    autoFocus
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3.5 text-sm text-white placeholder-white/35 transition-colors focus:border-white/20 focus:bg-white/[0.04] focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="bug-context"
                    className="mb-1.5 block text-sm font-medium text-white/80"
                  >
                    What were you trying to do?{" "}
                    <span className="font-normal text-white/30">
                      (optional)
                    </span>
                  </label>
                  <textarea
                    id="bug-context"
                    value={whatWereDoing}
                    onChange={(e) => setWhatWereDoing(e.target.value)}
                    placeholder="e.g. I was trying to send a photo in a group chat..."
                    maxLength={500}
                    rows={2}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3.5 text-sm text-white placeholder-white/35 transition-colors focus:border-white/20 focus:bg-white/[0.04] focus:outline-none"
                  />
                </div>

                {/* Screenshot attachment */}
                <div>
                  <p className="mb-1.5 text-sm font-medium text-white/80">
                    Screenshot{" "}
                    <span className="font-normal text-white/30">
                      (optional)
                    </span>
                  </p>
                  {screenshot ? (
                    <div className="relative inline-block">
                      <img
                        src={screenshot.previewUrl}
                        alt="Screenshot preview"
                        className="max-h-[120px] w-auto rounded-lg object-contain border border-white/[0.06]"
                      />
                      <button
                        onClick={clearScreenshot}
                        className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-black/70 text-gray-300 transition-colors hover:bg-black/90 hover:text-white"
                        aria-label="Remove screenshot"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex w-full items-center gap-2.5 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-3 text-left text-sm text-white/40 transition-colors hover:border-white/20 hover:bg-white/[0.04] hover:text-white/60"
                    >
                      <ImagePlus size={16} />
                      <span>Add a screenshot or paste one</span>
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) stageScreenshot(file);
                    }}
                  />
                </div>
              </div>
              <button
                onClick={() => {
                  if (whatWentWrong.trim()) setStep("bug-frequency");
                }}
                disabled={!whatWentWrong.trim()}
                className="mt-4 w-full rounded-xl bg-gradient-to-r from-[#34F080] to-[#20E0AA] px-4 py-2.5 text-sm font-semibold text-black transition-[box-shadow,transform,opacity] hover:shadow-[0_0_20px_rgba(52,240,128,0.2)] active:scale-[0.98] disabled:opacity-30 disabled:shadow-none"
              >
                Continue
              </button>
            </div>
          ) : null}

          {/* ── Bug path: Frequency ── */}
          {step === "bug-frequency" ? (
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
                      setStep("confirm");
                    }}
                    className={`rounded-xl border px-4 py-3 text-left text-sm transition-[border-color,background-color,color,transform] active:scale-[0.98] ${
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
          ) : null}

          {/* ── Bug path: Confirm ── */}
          {step === "confirm" ? (
            <div>
              <div className="space-y-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                    What went wrong
                  </p>
                  <p className="mt-0.5 break-words text-white/70">
                    {whatWentWrong}
                  </p>
                </div>
                {whatWereDoing.trim() ? (
                  <>
                    <div className="border-t border-white/[0.04]" />
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                        What you were doing
                      </p>
                      <p className="mt-0.5 break-words text-white/70">
                        {whatWereDoing}
                      </p>
                    </div>
                  </>
                ) : null}
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
                {screenshot ? (
                  <>
                    <div className="border-t border-white/[0.04]" />
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                        Screenshot
                      </p>
                      <img
                        src={screenshot.previewUrl}
                        alt="Attached screenshot"
                        className="mt-1.5 max-h-[80px] w-auto rounded-lg object-contain"
                      />
                    </div>
                  </>
                ) : null}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    if (submitting) return;
                    if (hasContent) {
                      if (!window.confirm("Discard your draft?")) return;
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
                  className="flex-1 rounded-xl bg-gradient-to-r from-[#34F080] to-[#20E0AA] px-4 py-2.5 text-sm font-semibold text-black transition-[box-shadow,transform,opacity] hover:shadow-[0_0_20px_rgba(52,240,128,0.2)] active:scale-[0.98] disabled:opacity-30 disabled:shadow-none"
                >
                  {submitting ? "Sending..." : "Submit"}
                </button>
              </div>
            </div>
          ) : null}

          {/* ── Feedback path: Describe (submits directly) ── */}
          {step === "describe" ? (
            <div
              onPaste={(e) => {
                const items = e.clipboardData?.items;
                if (!items) return;
                for (const item of items) {
                  if (item.type.startsWith("image/")) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    if (file) stageScreenshot(file);
                    return;
                  }
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files?.[0];
                if (file?.type.startsWith("image/")) stageScreenshot(file);
              }}
            >
              {selectedCategory ? (
                <div className="mb-3 flex items-center gap-2">
                  <selectedCategory.icon size={14} className="text-white/40" />
                  <p className="text-xs text-white/40">
                    {selectedCategory.label}
                  </p>
                </div>
              ) : null}
              <label
                htmlFor="feedback-description"
                className="mb-3 block text-sm font-medium text-white/80"
              >
                Tell us more
              </label>
              <textarea
                id="feedback-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  category === "feature-request"
                    ? "Describe the feature you'd like to see..."
                    : category === "improvement"
                    ? "What could we do better?"
                    : category === "praise"
                    ? "What do you love about ChatOn?"
                    : "Share your thoughts..."
                }
                maxLength={1000}
                rows={5}
                autoFocus
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3.5 text-sm text-white placeholder-white/35 transition-colors focus:border-white/20 focus:bg-white/[0.04] focus:outline-none"
              />
              <div className="mt-1.5 text-right text-[11px] text-white/30">
                {description.length}/1000
              </div>

              {/* Screenshot attachment */}
              <div className="mt-3">
                <p className="mb-1.5 text-sm font-medium text-white/80">
                  Screenshot{" "}
                  <span className="font-normal text-white/30">(optional)</span>
                </p>
                {screenshot ? (
                  <div className="relative inline-block">
                    <img
                      src={screenshot.previewUrl}
                      alt="Screenshot preview"
                      className="max-h-[120px] w-auto rounded-lg object-contain border border-white/[0.06]"
                    />
                    <button
                      onClick={clearScreenshot}
                      className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-black/70 text-gray-300 transition-colors hover:bg-black/90 hover:text-white"
                      aria-label="Remove screenshot"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full items-center gap-2.5 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-3 text-left text-sm text-white/40 transition-colors hover:border-white/20 hover:bg-white/[0.04] hover:text-white/60"
                  >
                    <ImagePlus size={16} />
                    <span>Add a screenshot or paste one</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) stageScreenshot(file);
                  }}
                />
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={goBack}
                  className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white/50 transition-colors hover:bg-white/[0.06]"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!description.trim() || submitting}
                  className="flex-1 rounded-xl bg-gradient-to-r from-[#34F080] to-[#20E0AA] px-4 py-2.5 text-sm font-semibold text-black transition-[box-shadow,transform,opacity] hover:shadow-[0_0_20px_rgba(52,240,128,0.2)] active:scale-[0.98] disabled:opacity-30 disabled:shadow-none"
                >
                  {submitting ? "Sending..." : "Submit"}
                </button>
              </div>
            </div>
          ) : null}

          {/* ── Done ── */}
          {step === "done" ? (
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
                {isBugPath
                  ? "Thanks for reporting this!"
                  : "Thanks for your feedback!"}
              </p>
              <p className="mt-1 text-xs text-white/35">
                {isBugPath
                  ? "We'll investigate and work on a fix. We read every report."
                  : "Your input helps us make ChatOn better. We read every one."}
              </p>
              <button
                onClick={handleClose}
                className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] px-8 py-2 text-sm text-white/50 transition-colors hover:bg-white/[0.06]"
              >
                Close
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
