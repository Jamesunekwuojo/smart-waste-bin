import fs from "fs";
import path from "path";
import { Bin, BinDetail, ForecastRecord, HistoryRecord, FeedbackPayload } from "./types";

const DB_FILE = path.join(process.cwd(), "db.json");

interface DbSchema {
  bins: Bin[];
  forecasts: Record<string, ForecastRecord>;
  history: Record<string, HistoryRecord[]>;
  feedback: FeedbackPayload[];
}

// Default initial state representing the 4 integrated compartments of the physical bin
const getInitialDbState = (): DbSchema => {
  const now = new Date();
  
  const bins: Bin[] = [
    {
      bin_id: "BIN-001",
      location_label: "Integrated Unit - Compartment 1: Paper (Lemon)",
      fill_percent: 45,
      weight_kg: 2.1,
      height_cm: 120,
      last_classified_item: {
        predicted_class: "Paper Cup",
        confidence_score: 0.92,
        gradcam_image_url: "/images/gradcam_paper.png",
        timestamp: new Date(now.getTime() - 1000 * 60 * 12).toISOString(), // 12m ago
      },
      compressibility_index: 0.85,
      is_anomalous: false,
    },
    {
      bin_id: "BIN-002",
      location_label: "Integrated Unit - Compartment 2: Plastic (Purple)",
      fill_percent: 78,
      weight_kg: 5.2,
      height_cm: 120,
      last_classified_item: {
        predicted_class: "Plastic Bottle",
        confidence_score: 0.89,
        gradcam_image_url: "/images/gradcam_plastic.png",
        timestamp: new Date(now.getTime() - 1000 * 60 * 5).toISOString(), // 5m ago
      },
      compressibility_index: 0.74,
      is_anomalous: false,
    },
    {
      bin_id: "BIN-003",
      location_label: "Integrated Unit - Compartment 3: Decomposable (Black 1)",
      fill_percent: 92,
      weight_kg: 26.5,
      height_cm: 120,
      last_classified_item: {
        predicted_class: "Other / Non-recyclable",
        confidence_score: 0.91,
        gradcam_image_url: "/images/gradcam_organic.png",
        timestamp: new Date(now.getTime() - 1000 * 60 * 2).toISOString(), // 2m ago
      },
      compressibility_index: 0.18,
      is_anomalous: false,
    },
    {
      bin_id: "BIN-004",
      location_label: "Integrated Unit - Compartment 4: Metal (Black 2)",
      fill_percent: 15,
      weight_kg: 9.8,
      height_cm: 120,
      last_classified_item: {
        predicted_class: "Metal Scrap",
        confidence_score: 0.96,
        gradcam_image_url: "/images/gradcam_metal.png",
        timestamp: new Date(now.getTime() - 1000 * 60 * 25).toISOString(), // 25m ago
      },
      compressibility_index: 0.05,
      is_anomalous: false,
    },
  ];

  const forecasts: Record<string, ForecastRecord> = {
    "BIN-001": {
      predicted_hours_to_full: 24.5,
      confidence_interval: { lower: 18.2, upper: 30.8 },
      model_used: "lstm",
      mc_dropout_std: 0.14,
    },
    "BIN-002": {
      predicted_hours_to_full: 6.8,
      confidence_interval: { lower: 5.2, upper: 8.4 },
      model_used: "lstm",
      mc_dropout_std: 0.22,
    },
    "BIN-003": {
      predicted_hours_to_full: 1.5,
      confidence_interval: { lower: 0.9, upper: 2.1 },
      model_used: "lstm",
      mc_dropout_std: 0.12, // reliable, critical collection alert
    },
    "BIN-004": {
      predicted_hours_to_full: 58.0,
      confidence_interval: { lower: 48.0, upper: 68.0 },
      model_used: "lstm",
      mc_dropout_std: 0.09,
    },
  };

  const history: Record<string, HistoryRecord[]> = {};

  bins.forEach((bin) => {
    history[bin.bin_id] = generateHistoryPoints(bin.bin_id, bin.fill_percent, bin.weight_kg, "24h");
  });

  return {
    bins,
    forecasts,
    history,
    feedback: [],
  };
};

// Generates logical historical time-series points ending at current levels
const generateHistoryPoints = (
  binId: string,
  targetFill: number,
  targetWeight: number,
  range: "24h" | "7d" | "30d"
): HistoryRecord[] => {
  const points: HistoryRecord[] = [];
  const now = new Date();
  let pointsCount = 24;
  let intervalHours = 1;

  if (range === "7d") {
    pointsCount = 7;
    intervalHours = 24;
  } else if (range === "30d") {
    pointsCount = 30;
    intervalHours = 24;
  }

  for (let i = pointsCount - 1; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * intervalHours * 60 * 60 * 1000);
    const progressRatio = (pointsCount - 1 - i) / (pointsCount - 1);

    // Simulate filling process with slight fluctuations
    let fill = (targetFill * progressRatio) + (Math.sin(i * 0.5) * 4);
    if (fill < 0) fill = 0;
    if (fill > 100) fill = 100;

    let weight = (targetWeight * progressRatio) + (Math.sin(i * 0.5) * 1.2);
    if (weight < 0) weight = 0;

    let formattedTime = timestamp.toISOString();
    if (range === "24h") {
      formattedTime = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      formattedTime = timestamp.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    points.push({
      timestamp: formattedTime,
      fill_percent: Math.round(fill * 10) / 10,
      weight_kg: Math.round(weight * 10) / 10,
    });
  }

  // Force exact end match
  if (points.length > 0) {
    const last = points[points.length - 1];
    last.fill_percent = targetFill;
    last.weight_kg = targetWeight;
  }

  return points;
};

// File-based state helper functions
export const readDb = (): DbSchema => {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const state = getInitialDbState();
      fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), "utf-8");
      return state;
    }
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    console.error("Failed to read database file, returning default initial state", error);
    return getInitialDbState();
  }
};

export const writeDb = (data: DbSchema): void => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to write to database file", error);
  }
};

// High-level Mock API controllers
export const dbGetBins = (): Bin[] => {
  const db = readDb();
  return db.bins;
};

export const dbGetBinDetail = (binId: string, range: "24h" | "7d" | "30d" = "24h"): BinDetail | null => {
  const db = readDb();
  const bin = db.bins.find((b) => b.bin_id === binId);
  if (!bin) return null;

  // Dynamically regenerate history based on requested window range
  const history = generateHistoryPoints(binId, bin.fill_percent, bin.weight_kg, range);
  return {
    ...bin,
    history,
  };
};

export const dbGetForecast = (binId: string): ForecastRecord | null => {
  const db = readDb();
  return db.forecasts[binId] || null;
};

export const dbSubmitFeedback = (payload: FeedbackPayload): boolean => {
  const db = readDb();
  db.feedback.push(payload);

  // Re-adjust last classified item on the bin to match operator correction
  const bin = db.bins.find((b) => b.bin_id === payload.bin_id);
  if (bin && bin.last_classified_item) {
    bin.last_classified_item.predicted_class = payload.corrected_class;
    bin.last_classified_item.confidence_score = 1.0; // human verified
    bin.last_classified_item.timestamp = new Date().toISOString();
  }

  writeDb(db);
  return true;
};

// Replicates the Flask classifier inference
const runInference = (binId: string, fillPercent: number, weightKg: number) => {
  // Map bins to their respective compartment classification
  if (binId === "BIN-001") {
    // Paper compartment
    if (fillPercent < 10) return { predictedClass: "Other / Non-recyclable", confidence: 0.5 };
    if (weightKg / fillPercent > 0.1) return { predictedClass: "Cardboard Box", confidence: 0.88 };
    return { predictedClass: "Paper Cup", confidence: 0.94 };
  } else if (binId === "BIN-002") {
    // Plastic compartment
    return { predictedClass: "Plastic Bottle", confidence: 0.91 };
  } else if (binId === "BIN-003") {
    // Decomposable compartment
    return { predictedClass: "Other / Non-recyclable", confidence: 0.93 };
  } else if (binId === "BIN-004") {
    // Metal compartment
    return { predictedClass: "Metal Scrap", confidence: 0.95 };
  }
  return { predictedClass: "Other / Non-recyclable", confidence: 0.70 };
};

// Replicates backend ESP32 telemetry ingestion flow
export const dbAddWasteEvent = (
  binId: string,
  fillPercent: number,
  weightKg: number,
  heightCm: number,
  sensorFault: boolean = false
) => {
  const db = readDb();
  let bin = db.bins.find((b) => b.bin_id === binId);
  const now = new Date();

  // If bin doesn't exist, create it (upsert pattern like Flask backend)
  if (!bin) {
    let compartmentType = "paper";
    let lidColor = "lemon";
    if (binId.includes("2") || binId.toLowerCase().includes("plastic")) {
      compartmentType = "plastic";
      lidColor = "purple";
    } else if (binId.includes("3") || binId.toLowerCase().includes("decomposable")) {
      compartmentType = "decomposable";
      lidColor = "black";
    } else if (binId.includes("4") || binId.toLowerCase().includes("metal")) {
      compartmentType = "metal";
      lidColor = "black";
    }

    bin = {
      bin_id: binId,
      location_label: `Integrated Unit - Compartment: ${compartmentType} (${lidColor})`,
      fill_percent: fillPercent,
      weight_kg: weightKg,
      height_cm: heightCm,
      last_classified_item: null,
      compressibility_index: 0.5,
      is_anomalous: false,
    };
    db.bins.push(bin);
  }

  // Update telemetry values
  bin.fill_percent = fillPercent;
  bin.weight_kg = weightKg;
  bin.height_cm = heightCm;

  let isAnomalous = false;
  let anomalyReason: "sensor_fault" | "forecast_deviation" | null = null;

  if (sensorFault) {
    isAnomalous = true;
    anomalyReason = "sensor_fault";
    bin.last_classified_item = null;
    bin.compressibility_index = 0.0;
  } else {
    // Sensor fusion validation rules
    // Rule 1: High fill, zero weight
    if (fillPercent > 80.0 && weightKg < 0.05) {
      isAnomalous = true;
      anomalyReason = "forecast_deviation";
    }
    // Rule 2: Low fill, high weight
    if (fillPercent < 5.0 && weightKg > 40.0) {
      isAnomalous = true;
      anomalyReason = "forecast_deviation";
    }
    // Rule 3: High sensor height reading (> 120cm) but high fill (> 90%)
    if (heightCm > 120.0 && fillPercent > 90.0) {
      isAnomalous = true;
      anomalyReason = "forecast_deviation";
    }

    // Determine compressibility index (math estimation)
    // Paper/Plastic is light vs fill (higher index), Decomposable/Metal is heavy vs fill (lower index)
    let compIndex = 0.5;
    if (binId === "BIN-001") compIndex = 0.85; // Paper
    else if (binId === "BIN-002") compIndex = 0.74; // Plastic
    else if (binId === "BIN-003") compIndex = 0.18; // Decomposable
    else if (binId === "BIN-004") compIndex = 0.05; // Metal
    
    // Add light variance to index
    bin.compressibility_index = Math.max(0.01, Math.min(1.0, compIndex + (Math.random() * 0.06 - 0.03)));

    // On-device classification inference
    const inference = runInference(binId, fillPercent, weightKg);
    bin.last_classified_item = {
      predicted_class: inference.predictedClass,
      confidence_score: inference.confidence,
      gradcam_image_url: binId === "BIN-001" ? "/images/gradcam_paper.png"
                       : binId === "BIN-002" ? "/images/gradcam_plastic.png"
                       : binId === "BIN-003" ? "/images/gradcam_organic.png"
                       : "/images/gradcam_metal.png",
      timestamp: now.toISOString(),
    };
  }

  // Check alert threshold logic (fill_percent >= 95.0%)
  if (fillPercent >= 95.0) {
    isAnomalous = true;
    anomalyReason = anomalyReason || "forecast_deviation";
  }

  bin.is_anomalous = isAnomalous;
  bin.anomaly_reason = anomalyReason;

  // Recompute forecast LSTM stub
  // If fill percent goes up, hours to full goes down
  const maxHours = 72; // completely empty
  let predictedHours = ((100 - fillPercent) / 100) * maxHours;
  if (predictedHours < 0.2) predictedHours = 0.0;
  
  // Standard deviation for MC Dropout
  let mcStd = 0.12;
  if (sensorFault) mcStd = 0.95; // very high uncertainty on fault
  else if (fillPercent > 90.5) mcStd = 0.08; // very certain when full
  else if (isAnomalous) mcStd = 0.65; // anomalous triggers high uncertainty

  // Update cached forecast
  db.forecasts[binId] = {
    predicted_hours_to_full: Math.round(predictedHours * 10) / 10,
    confidence_interval: {
      lower: Math.max(0.0, Math.round((predictedHours - mcStd * 10) * 10) / 10),
      upper: Math.round((predictedHours + mcStd * 10) * 10) / 10,
    },
    model_used: "lstm",
    mc_dropout_std: mcStd,
  };

  // Push new reading to history
  if (!db.history[binId]) {
    db.history[binId] = [];
  }
  const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  db.history[binId].push({
    timestamp: formattedTime,
    fill_percent: fillPercent,
    weight_kg: weightKg,
  });

  // Keep history truncated to last 30 points
  if (db.history[binId].length > 30) {
    db.history[binId].shift();
  }

  writeDb(db);

  return {
    success: true,
    message: sensorFault ? "Waste event logged (sensor fault)" : "Waste event logged",
    event_id: Math.floor(Math.random() * 100000) + 1,
    is_anomalous: isAnomalous,
    anomaly_reason: anomalyReason,
  };
};
