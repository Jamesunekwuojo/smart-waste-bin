"""
classifier_stub.py

STAND-IN for the on-device MobileNetV3-Small classifier described in
Chapter 3 (Section 3.4.4.1) and evaluated in Chapter 4 (Section 4.3).

WHY THIS EXISTS:
The thesis document reports the results of training/evaluating a
quantized MobileNetV3-Small model (Table 4.1, Table 4.2), but no actual
trained model artifact (.tflite / .h5) was exported alongside it. This
module simulates classification behaviour that is statistically
consistent with those reported results, so the rest of the system
(backend routes, dashboard, forecasting) can be built and demoed
end-to-end without waiting on real model training.

REPLACE THIS MODULE, don't build around it, once a real quantized
model is trained and exported. The function signature below
(`classify_waste_event`) is what the rest of the backend depends on —
keep that signature stable when you swap in the real model.

Authoritative Thesis Metrics:
- Model Architecture: MobileNetV3-Small (approx. 2.5 million parameters)
- Test Samples (Support): 297
- Test Accuracy: 78.45%
- Macro precision/recall/F1: 0.8354 / 0.6362 / 0.6478
- Weighted precision/recall/F1: 0.7980 / 0.7845 / 0.7700
- Overfitting note: Training accuracy reached 97.57% at epoch 15, but validation 
  accuracy was 77.55% (a 19.02 percentage-point generalization gap). Real-world
  deployment expects 78.45% test accuracy.

Class-wise performance:
- Decomposable: precision = 1.0000 | recall = 0.1176 | F1 = 0.2105 | support = 17
- Metal:        precision = 0.7500 | recall = 0.7241 | F1 = 0.7368 | support = 58
- Paper:        precision = 0.8649 | recall = 0.8727 | F1 = 0.8688 | support = 110
- Plastic:      precision = 0.7266 | recall = 0.8304 | F1 = 0.7750 | support = 112
"""

import random
import time
from dataclasses import dataclass, field

# The four output classes in thesis order
CLASSES = ["Decomposable", "Metal", "Paper", "Plastic"]

# Exact empirical confusion matrix from thesis Section 11 (N=297):
# Rows = True class, Columns = Predicted class
# Format: [Decomposable, Metal, Paper, Plastic]
# Row 0 (Decomposable): [2, 2, 4, 9] (Sum = 17)
# Row 1 (Metal): [0, 42, 2, 14] (Sum = 58)
# Row 2 (Paper): [0, 2, 96, 12] (Sum = 110)
# Row 3 (Plastic): [0, 10, 9, 93] (Sum = 112)
CONFUSION_PROBS = {
    "Decomposable": {"Decomposable": 2/17, "Metal": 2/17, "Paper": 4/17, "Plastic": 9/17},
    "Metal":        {"Decomposable": 0/58, "Metal": 42/58, "Paper": 2/58, "Plastic": 14/58},
    "Paper":        {"Decomposable": 0/110, "Metal": 2/110, "Paper": 96/110, "Plastic": 12/110},
    "Plastic":      {"Decomposable": 0/112, "Metal": 10/112, "Paper": 9/112, "Plastic": 93/112},
}

# Prior probabilities based strictly on independent test support counts
CLASS_PRIORS = {
    "Decomposable": 17 / 297,
    "Metal": 58 / 297,
    "Paper": 110 / 297,
    "Plastic": 112 / 297,
}

# Model and training parameters as metadata for future reference
MODEL_METADATA = {
    "model_name": "MobileNetV3-Small",
    "parameters": "~2.5 million",
    "test_accuracy": 0.7845,
    "macro_precision": 0.8354,
    "macro_recall": 0.6362,
    "macro_f1": 0.6478,
    "weighted_precision": 0.7980,
    "weighted_recall": 0.7845,
    "weighted_f1": 0.7700,
    "generalization_gap": 0.1902, # 97.57% training accuracy vs 77.55% validation at epoch 15
    "preprocessing": {
        "input_dimensions": "224x224",
        "padding": "aspect-ratio-preserving",
        "imagenet_normalization": {
            "mean": [0.485, 0.456, 0.406],
            "std": [0.229, 0.224, 0.225]
        }
    },
    "training": {
        "stage_1": {
            "frozen_backbone": True,
            "optimizer": "Adam",
            "learning_rate": 0.001,
            "batch_size": 32,
            "epochs": 20
        },
        "stage_2": {
            "unfrozen_layers": "last 30 backbone layers",
            "optimizer": "Adam",
            "learning_rate": 0.0001,
            "label_smoothing": 0.1,
            "batch_size": 32,
            "epochs": 15,
            "early_stopping_patience": 5
        }
    },
    "gradcam_status": "Unvalidated (Grad-CAM faithfulness was not quantitatively evaluated in the thesis)."
}

# Deployed quantized model ESP32 latency (Table 4.1)
SIMULATED_LATENCY_MS = 245


@dataclass
class ClassificationResult:
    predicted_class: str
    confidence_score: float
    latency_ms: int
    gradcam_note: str
    is_stub: bool = field(default=True)


def _weighted_choice(prob_dict: dict) -> str:
    labels = list(prob_dict.keys())
    weights = list(prob_dict.values())
    return random.choices(labels, weights=weights, k=1)[0]


def _confidence_for(true_class: str, predicted_class: str) -> float:
    """
    Produces a simulated confidence score.
    NOTE: These confidence values are simulated and approximate for runtime integration, 
    and do not represent the original calibrated probabilities of the model.
    """
    if predicted_class == true_class:
        return round(random.uniform(0.75, 0.98), 3)
    return round(random.uniform(0.40, 0.70), 3)


# Explanations conforming to the Grad-CAM limitations (thesis does not validate Grad-CAM quantitatively)
GRADCAM_NOTES = {
    "Decomposable": "Grad-CAM visual explanation: Activation localized around organic textures. (Planned explainability feature: not empirically validated).",
    "Metal": "Grad-CAM visual explanation: Concentration of edge-detection gradients along reflective boundaries. (Planned explainability feature: not empirically validated).",
    "Paper": "Grad-CAM visual explanation: Diffuse activations on matte surfaces and flat paper contours. (Planned explainability feature: not empirically validated).",
    "Plastic": "Grad-CAM visual explanation: Jittered activations near specular highlight points and plastic neck contour. (Planned explainability feature: not empirically validated)."
}


def preprocess_image_spec(image_path_or_bytes) -> dict:
    """
    Documented preprocessing specs as requested in Section 6.
    Ensures future physical integration aligns with this pipeline.
    """
    return {
        "resized_dimensions": (224, 224),
        "padding_applied": "aspect-ratio-preserving",
        "normalization": {
            "mean": [0.485, 0.456, 0.406],
            "std": [0.229, 0.224, 0.225]
        }
    }


def classify_waste_event(hint_class: str | None = None) -> ClassificationResult:
    """
    Simulates classification behaviour mimicking the empirical error profile 
    and class imbalances of the thesis's MobileNetV3-Small model.

    Args:
        hint_class: Optional class string to force the 'true' label distribution.
                    Defaults to sampling from test-set class priors.
    """
    start = time.time()

    true_class = hint_class if hint_class in CLASSES else _weighted_choice(CLASS_PRIORS)
    predicted_class = _weighted_choice(CONFUSION_PROBS[true_class])
    confidence = _confidence_for(true_class, predicted_class)

    elapsed_ms = int((time.time() - start) * 1000) + SIMULATED_LATENCY_MS

    return ClassificationResult(
        predicted_class=predicted_class,
        confidence_score=confidence,
        latency_ms=elapsed_ms,
        gradcam_note=GRADCAM_NOTES[predicted_class],
    )


if __name__ == "__main__":
    # Sanity check: run simulations to verify accuracy matches 78.45%
    correct = 0
    n = 10000
    for _ in range(n):
        true_c = _weighted_choice(CLASS_PRIORS)
        result = classify_waste_event(hint_class=true_c)
        if result.predicted_class == true_c:
            correct += 1
    print(f"Simulated accuracy over {n} runs: {correct/n:.4f} (thesis reports 0.7845)")
