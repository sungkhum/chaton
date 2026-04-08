import { useState } from "react";
import { identity } from "deso-protocol";
import { ArrowLeft, ArrowRight, X } from "lucide-react";

interface PreSignupTutorialProps {
  onClose: () => void;
}

const SLIDES = [
  {
    image: "/assets/step1.png",
    alt: "DeSo Identity signup options: DeSo Seed, Google, or MetaMask",
    title: "Choose how to sign up",
    description:
      "You can create your account with Google, MetaMask, or a DeSo seed phrase. Pick whichever you prefer.",
  },
  {
    image: "/assets/step2.jpg",
    alt: "Seed phrase backup screen with Copy, Download, and Print buttons",
    title: "Save your recovery phrase",
    description:
      "Copy or download your recovery phrase and keep it somewhere safe. This is the only way to recover your account.",
  },
  {
    image: "/assets/step3.png",
    alt: "Captcha verification to receive free DESO tokens",
    title: "Verify and get free tokens",
    description:
      "Complete a quick captcha to prove you're human. You'll receive free $DESO — enough for thousands of messages.",
  },
];

export const PreSignupTutorial = ({ onClose }: PreSignupTutorialProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const isLastSlide = currentSlide === SLIDES.length - 1;
  const slide = SLIDES[currentSlide];

  const handleCreateAccount = () => {
    onClose();
    identity.login();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] animate-[fadeIn_0.2s_ease-out]"
        onClick={onClose}
      />

      {/* Modal — centered with safe-area awareness */}
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div
          className="relative w-full max-w-[420px] max-h-[min(92vh,640px)] overflow-y-auto rounded-2xl border border-white/[0.08] shadow-[0_32px_80px_-12px_rgba(0,0,0,0.8),0_0_60px_-20px_rgba(52,240,128,0.08)] animate-[fadeIn_0.25s_ease-out]"
          style={{
            background:
              "linear-gradient(165deg, rgba(20,28,43,0.97) 0%, rgba(12,18,30,0.99) 100%)",
            backdropFilter: "blur(40px)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Decorative glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[280px] h-[2px] bg-gradient-to-r from-transparent via-[#34F080]/40 to-transparent" />

          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6">
            <div className="flex items-center gap-2.5">
              <img
                src="/ChatOn-Logo-Small.png"
                alt=""
                className="w-8 h-8 rounded-lg"
              />
              <span className="text-white font-bold">ChatOn</span>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-white transition-colors p-1.5 -mr-1.5 rounded-lg hover:bg-white/5 cursor-pointer"
              aria-label="Close tutorial"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Screenshot — responsive height */}
          <div className="px-6 pt-5">
            <div className="bg-[#0a1020] rounded-xl border border-white/[0.04] overflow-hidden flex items-center justify-center p-3 sm:p-5">
              <img
                src={slide!.image}
                alt={slide!.alt}
                className="max-h-[120px] sm:max-h-[180px] w-auto rounded-lg"
              />
            </div>
          </div>

          {/* Content */}
          <div className="px-6 pt-5 pb-1">
            <div className="text-[10px] font-bold text-[#34F080]/70 tracking-[0.25em] uppercase mb-2.5">
              Step {currentSlide + 1} of {SLIDES.length}
            </div>
            <h3 className="text-xl font-bold text-white mb-2 leading-tight">
              {slide!.title}
            </h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              {slide!.description}
            </p>
          </div>

          {/* Navigation */}
          <div className="px-6 pt-5 pb-6">
            {/* Dots */}
            <div
              className="flex items-center justify-center gap-2 mb-5"
              role="tablist"
              aria-label="Tutorial steps"
            >
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  role="tab"
                  aria-selected={i === currentSlide}
                  onClick={() => setCurrentSlide(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                    i === currentSlide
                      ? "w-7 bg-[#34F080]"
                      : "w-1.5 bg-white/15 hover:bg-white/30"
                  }`}
                  aria-label={`Go to step ${i + 1}`}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              {currentSlide > 0 && (
                <button
                  onClick={() => setCurrentSlide((s) => s - 1)}
                  className="flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-semibold text-gray-300 hover:text-white border border-white/10 hover:border-white/20 rounded-xl transition-all cursor-pointer min-h-[48px]"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              )}
              {isLastSlide ? (
                <button
                  onClick={handleCreateAccount}
                  className="flex-1 landing-btn-vivid flex items-center justify-center gap-2 px-6 py-3 text-white font-bold rounded-xl text-sm cursor-pointer min-h-[48px]"
                >
                  Create Account
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => setCurrentSlide((s) => s + 1)}
                  className="flex-1 landing-btn-vivid flex items-center justify-center gap-2 px-6 py-3 text-white font-bold rounded-xl text-sm cursor-pointer min-h-[48px]"
                >
                  Next
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Login link */}
            <p className="text-center mt-4 text-xs text-gray-500">
              Already have an account?{" "}
              <button
                onClick={() => {
                  onClose();
                  identity.login();
                }}
                className="text-[#34F080] hover:underline font-semibold cursor-pointer"
              >
                Log in
              </button>
            </p>
          </div>
        </div>
      </div>
    </>
  );
};
