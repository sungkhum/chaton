import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "../store";
import { submitFeedback } from "../services/feedback.service";

const CATEGORIES = [
  { value: "feature-request", label: "Feature Request", icon: "\u{1F4A1}" },
  { value: "improvement", label: "Improvement", icon: "\u{1F527}" },
  { value: "question", label: "Question", icon: "\u{2753}" },
  { value: "praise", label: "Love Something", icon: "\u{2764}\u{FE0F}" },
  { value: "other", label: "Other", icon: "\u{1F4AC}" },
] as const;

type Step = "category" | "describe" | "confirm" | "done";

export function FeedbackModal() {
  const feedbackModalOpen = useStore((s) => s.feedbackModalOpen);
  const closeFeedbackModal = useStore((s) => s.closeFeedbackModal);
  const [step, setStep] = useState<Step>("category");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inflight = useRef(false);

  if (!feedbackModalOpen) return null;

  const selectedCategory = CATEGORIES.find((c) => c.value === category);

  const handleSubmit = async () => {
    if (inflight.current) return;
    inflight.current = true;
    setSubmitting(true);
    try {
      await submitFeedback({ category, description });
      setStep("done");
    } catch {
      toast.error("Couldn't submit feedback. Try again later.");
    } finally {
      setSubmitting(false);
      inflight.current = false;
    }
  };

  const handleClose = () => {
    closeFeedbackModal();
    setStep("category");
    setCategory("");
    setDescription("");
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-t-2xl bg-zinc-900 p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Send Feedback</h3>
          <button
            onClick={handleClose}
            className="text-zinc-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {step === "category" ? (
          <div>
            <p className="mb-3 text-sm text-zinc-300">What kind of feedback?</p>
            <div className="flex flex-col gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => {
                    setCategory(cat.value);
                    setStep("describe");
                  }}
                  className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-left text-sm text-zinc-300 transition-colors hover:border-zinc-500"
                >
                  <span className="text-lg">{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : step === "describe" ? (
          <div>
            {selectedCategory ? (
              <p className="mb-1 text-xs text-zinc-500">
                {selectedCategory.icon} {selectedCategory.label}
              </p>
            ) : null}
            <p className="mb-2 text-sm text-zinc-300">Tell us more</p>
            <textarea
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
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-3 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
            />
            <div className="mt-2 text-right text-xs text-zinc-500">
              {description.length}/1000
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setStep("category")}
                className="flex-1 rounded-lg bg-zinc-700 px-4 py-2.5 text-sm text-zinc-300"
              >
                Back
              </button>
              <button
                onClick={() => {
                  if (description.trim()) setStep("confirm");
                }}
                disabled={!description.trim()}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        ) : step === "confirm" ? (
          <div>
            <div className="space-y-1 rounded-lg bg-zinc-800 p-3 text-sm">
              <p>
                <span className="text-zinc-500">Type:</span>{" "}
                <span className="text-zinc-300">
                  {selectedCategory
                    ? `${selectedCategory.icon} ${selectedCategory.label}`
                    : category}
                </span>
              </p>
              <p>
                <span className="text-zinc-500">Feedback:</span>{" "}
                <span className="text-zinc-300">{description}</span>
              </p>
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
            <p className="text-sm text-zinc-300">Thanks for your feedback!</p>
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
