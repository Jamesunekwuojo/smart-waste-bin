-- Database Schema for Smart Waste Bin Management System (SQLite)

-- 1. Bins Table
CREATE TABLE IF NOT EXISTS bins (
    bin_id TEXT PRIMARY KEY,
    location_label TEXT NOT NULL,
    power_source TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Waste Events Table
CREATE TABLE IF NOT EXISTS waste_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bin_id TEXT NOT NULL,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    predicted_class TEXT NOT NULL,
    confidence_score REAL NOT NULL,
    fill_percent REAL NOT NULL,
    weight_kg REAL NOT NULL,
    height_cm REAL NOT NULL,
    gradcam_image_path TEXT,
    is_anomalous INTEGER NOT NULL DEFAULT 0 CHECK (is_anomalous IN (0, 1)),
    FOREIGN KEY (bin_id) REFERENCES bins (bin_id) ON DELETE CASCADE
);

-- Composite Index on bin_id and timestamp for rapid history lookups and charting
CREATE INDEX IF NOT EXISTS idx_bin_id_timestamp ON waste_events (bin_id, timestamp);

-- 3. Feedbacks Table
CREATE TABLE IF NOT EXISTS feedbacks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    waste_event_id INTEGER NOT NULL,
    corrected_class TEXT NOT NULL,
    operator_note TEXT,
    submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (waste_event_id) REFERENCES waste_events (id) ON DELETE CASCADE
);

-- 4. Forecast Cache Table
CREATE TABLE IF NOT EXISTS forecast_caches (
    bin_id TEXT PRIMARY KEY,
    predicted_hours_to_full REAL NOT NULL,
    confidence_lower REAL NOT NULL,
    confidence_upper REAL NOT NULL,
    model_used TEXT NOT NULL,
    mc_dropout_std REAL NOT NULL,
    generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bin_id) REFERENCES bins (bin_id) ON DELETE CASCADE
);
