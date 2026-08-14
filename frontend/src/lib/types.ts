export interface LastClassifiedItem {
  predicted_class: string | null;
  confidence_score: number | null; // between 0 and 1
  gradcam_image_url: string | null;
  original_image_url?: string | null;
  timestamp: string; // ISO date string
}

export interface Bin {
  bin_id: string;
  location_label: string;
  fill_percent: number; // 0 to 100
  weight_kg: number;
  height_cm: number;
  last_classified_item: LastClassifiedItem | null;
  compressibility_index: number; // index representation, e.g. 0 to 1
  is_anomalous: boolean;
  anomaly_reason?: "sensor_fault" | "forecast_deviation" | null;
}

export interface HistoryRecord {
  timestamp: string; // ISO date string or formatted time
  fill_percent: number;
  weight_kg: number;
}

export interface BinDetail extends Bin {
  history: HistoryRecord[];
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
}

export interface ForecastRecord {
  predicted_hours_to_full: number;
  confidence_interval: ConfidenceInterval;
  model_used: "lstm" | "linear_fallback";
  mc_dropout_std: number; // high value means "flag for human review"
}

export interface FeedbackPayload {
  bin_id: string;
  corrected_class: string;
}
