import { Bin, BinDetail, ForecastRecord, HistoryRecord } from "./types";

export const MOCK_BINS: Bin[] = [
  {
    bin_id: "BIN-001",
    location_label: "Integrated Unit - Compartment 1: Paper (Lemon)",
    fill_percent: 45,
    weight_kg: 2.1,
    height_cm: 120,
    last_classified_item: {
      predicted_class: "Paper Cup",
      confidence_score: 0.92,
      original_image_url: "/images/paper_cup.png",
      gradcam_image_url: "/images/gradcam_paper.png",
      timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(), // 12m ago
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
      original_image_url: "/images/plastic_bottle.png",
      gradcam_image_url: "/images/gradcam_plastic.png",
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5m ago
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
      original_image_url: "/images/organic_waste.png",
      gradcam_image_url: "/images/gradcam_organic.png",
      timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(), // 2m ago
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
      original_image_url: "/images/metal_scrap.png",
      gradcam_image_url: "/images/gradcam_metal.png",
      timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(), // 25m ago
    },
    compressibility_index: 0.05,
    is_anomalous: false,
  },
];

export const MOCK_FORECASTS: Record<string, ForecastRecord> = {
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
    mc_dropout_std: 0.12,
  },
  "BIN-004": {
    predicted_hours_to_full: 58.0,
    confidence_interval: { lower: 48.0, upper: 68.0 },
    model_used: "lstm",
    mc_dropout_std: 0.09,
  },
};

export const generateMockHistory = (binId: string, range: "24h" | "7d" | "30d"): HistoryRecord[] => {
  const data: HistoryRecord[] = [];
  const now = new Date();
  
  const baseBin = MOCK_BINS.find(b => b.bin_id === binId) || MOCK_BINS[0];
  const targetFill = baseBin.fill_percent;
  const targetWeight = baseBin.weight_kg;
  
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
    
    let fill = (targetFill * progressRatio) + (Math.sin(i * 0.5) * 4);
    if (fill < 0) fill = 2;
    if (fill > 100) fill = 98;
    
    let weight = (targetWeight * progressRatio) + (Math.sin(i * 0.5) * 1.2);
    if (weight < 0) weight = 0.5;
    
    let formattedTime = timestamp.toISOString();
    if (range === "24h") {
      formattedTime = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      formattedTime = timestamp.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    
    data.push({
      timestamp: formattedTime,
      fill_percent: Math.round(fill * 10) / 10,
      weight_kg: Math.round(weight * 10) / 10,
    });
  }
  
  if (data.length > 0) {
    const lastPoint = data[data.length - 1];
    lastPoint.fill_percent = targetFill;
    lastPoint.weight_kg = targetWeight;
  }
  
  return data;
};

export const getMockBinDetail = (binId: string, range: "24h" | "7d" | "30d" = "24h"): BinDetail | null => {
  const bin = MOCK_BINS.find(b => b.bin_id === binId);
  if (!bin) return null;
  return {
    ...bin,
    history: generateMockHistory(binId, range),
  };
};
