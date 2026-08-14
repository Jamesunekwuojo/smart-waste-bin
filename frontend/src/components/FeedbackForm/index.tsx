import React, { useState } from "react";
import { CheckCircle2, AlertCircle, RefreshCw, Send } from "lucide-react";
import { apiClient } from "../../lib/api-client";

interface FeedbackFormProps {
  binId: string;
  predictedClass: string;
  confidenceScore: number;
  onFeedbackSubmitted?: () => void;
}

const RECYCLABLE_CLASSES = [
  "Plastic Bottle",
  "Glass Bottle",
  "Cardboard Box",
  "Metal Scrap",
  "Paper Cup",
  "Other / Non-recyclable"
];

export function FeedbackForm({ 
  binId, 
  predictedClass, 
  confidenceScore, 
  onFeedbackSubmitted 
}: FeedbackFormProps) {
  const [correctedClass, setCorrectedClass] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctedClass) return;

    setStatus("submitting");
    setErrorMessage("");

    try {
      const response = await apiClient.submitFeedback({
        bin_id: binId,
        corrected_class: correctedClass
      });

      if (response.success) {
        setStatus("success");
        setSuccessMessage(response.message);
        if (onFeedbackSubmitted) {
          onFeedbackSubmitted();
        }
      } else {
        throw new Error(response.message || "Failed to submit correction feedback.");
      }
    } catch (err) {
      setStatus("error");
      const msg = err instanceof Error ? err.message : "A network error occurred while submitting feedback.";
      setErrorMessage(msg);
    }
  };

  const handleReset = () => {
    setCorrectedClass("");
    setStatus("idle");
    setErrorMessage("");
    setSuccessMessage("");
  };

  return (
    <div className="bg-card text-card-foreground border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col h-full space-y-4">
      <div>
        <h3 className="text-sm font-bold text-neutral-850 dark:text-neutral-100">
          Classification Overrides
        </h3>
        <p className="text-xs text-neutral-450 dark:text-neutral-500 mt-1">
          Help train the classification engine by correcting misclassified items.
        </p>
      </div>

      {status === "success" ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4 space-y-3 bg-status-safe-light/10 dark:bg-status-safe/5 rounded-xl border border-status-safe/20">
          <CheckCircle2 className="w-10 h-10 text-status-safe animate-bounce" />
          <div>
            <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-150">
              Correction Submitted
            </h4>
            <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-1 max-w-xs">
              {successMessage}
            </p>
          </div>
          <button
            onClick={handleReset}
            className="px-4 py-1.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-705 dark:text-neutral-300 text-xs font-bold rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-200 cursor-pointer"
          >
            Submit Another
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            {/* Predicted Class Readout */}
            <div className="p-3.5 bg-neutral-50 dark:bg-neutral-900/30 rounded-xl border border-neutral-150 dark:border-neutral-800">
              <span className="text-[10px] text-neutral-400 uppercase font-semibold block">
                Model Classification
              </span>
              <div className="text-xs font-bold text-neutral-700 dark:text-neutral-200 mt-1">
                {predictedClass} ({Math.round(confidenceScore * 100)}% Confidence)
              </div>
            </div>

            {/* Selector Dropdown */}
            <div className="flex flex-col space-y-1.5">
              <label 
                htmlFor="correct-category" 
                className="text-xs font-bold text-neutral-600 dark:text-neutral-300"
              >
                Select Correct Category
              </label>
              <select
                id="correct-category"
                value={correctedClass}
                disabled={status === "submitting"}
                onChange={(e) => setCorrectedClass(e.target.value)}
                required
                className="w-full bg-card border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="" disabled>-- Select accurate label --</option>
                {RECYCLABLE_CLASSES.map((cls) => (
                  <option key={cls} value={cls} disabled={cls === predictedClass}>
                    {cls} {cls === predictedClass ? "(Predicted)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Error Banner */}
            {status === "error" && (
              <div className="p-3 bg-status-critical-light dark:bg-status-critical/10 border border-status-critical/20 rounded-xl flex items-start gap-2 text-left">
                <AlertCircle className="w-4 h-4 text-status-critical shrink-0 mt-0.5" />
                <div className="text-[11px] text-status-critical leading-normal font-semibold">
                  {errorMessage}
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={status === "submitting" || !correctedClass}
            className="w-full bg-primary hover:bg-primary-hover text-neutral-50 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm disabled:opacity-40 disabled:cursor-not-allowed active:translate-y-[1px]"
          >
            {status === "submitting" ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Posting Override...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Submit Classification</span>
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}

export default FeedbackForm;
