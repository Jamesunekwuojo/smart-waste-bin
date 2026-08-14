import { Bin, BinDetail, ForecastRecord, FeedbackPayload } from "./types";
import { MOCK_BINS, getMockBinDetail, MOCK_FORECASTS } from "./mock-data";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

class ApiClient {
  private isSyncing = false;

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const primaryUrl = `${API_BASE_URL}${path}`;
    try {
      const response = await fetch(primaryUrl, {
        ...options,
        // Set a reasonable timeout so local operations don't hang if backend is down
        signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined,
      });
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      const data = (await response.json()) as T;
      
      // Attempt background sync since we have a working connection
      this.triggerSync();
      
      return data;
    } catch (primaryError) {
      console.warn(`Failed to fetch from primary Flask API at ${primaryUrl}. Trying Next.js fallback API...`, primaryError);
      
      // Fallback to Next.js API Route handler (with optional NEXT_PUBLIC_DEMO_API_URL override)
      const fallbackBase = process.env.NEXT_PUBLIC_DEMO_API_URL 
        || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
      const fallbackUrl = `${fallbackBase}${path}`;
        
      try {
        const response = await fetch(fallbackUrl, {
          ...options,
          signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined,
        });
        if (!response.ok) {
          throw new Error(`Fallback API error: ${response.status} ${response.statusText}`);
        }
        const data = (await response.json()) as T;
        
        // Attempt background sync since we have a working connection
        this.triggerSync();
        
        return data;
      } catch (fallbackError) {
        console.error("Both primary Flask API and Next.js fallback API failed. Reverting to static client stubs.", fallbackError);
        throw fallbackError;
      }
    }
  }

  async getBins(): Promise<Bin[]> {
    try {
      return await this.request<Bin[]>("/api/bins");
    } catch {
      // Final fallback to client-side mock bins
      return MOCK_BINS;
    }
  }

  async getBinDetail(id: string, range: "24h" | "7d" | "30d" = "24h"): Promise<BinDetail> {
    try {
      const detail = await this.request<BinDetail>(`/api/bins/${id}?window=${range}`);
      if (!detail.history) {
        detail.history = getMockBinDetail(id, range)?.history || [];
      }
      return detail;
    } catch {
      const mockDetail = getMockBinDetail(id, range);
      if (!mockDetail) throw new Error(`Bin ${id} not found`);
      return mockDetail;
    }
  }

  async getForecast(binId: string): Promise<ForecastRecord> {
    try {
      return await this.request<ForecastRecord>(`/api/forecast/${binId}`);
    } catch {
      const mockForecast = MOCK_FORECASTS[binId];
      if (!mockForecast) {
        throw new Error(`Forecast for bin ${binId} not found`);
      }
      return mockForecast;
    }
  }

  async submitFeedback(payload: FeedbackPayload): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.request<{ success: boolean; message: string }>("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      return result;
    } catch (error) {
      console.warn("Feedback POST failed. Caching correction locally for background synchronization...", error);
      
      if (typeof window !== "undefined") {
        try {
          const pending: FeedbackPayload[] = JSON.parse(
            localStorage.getItem("smart_waste_pending_feedback") || "[]"
          );
          // Deduplicate identical corrections for the same bin
          const exists = pending.some(
            (p) => p.bin_id === payload.bin_id && p.corrected_class === payload.corrected_class
          );
          if (!exists) {
            pending.push(payload);
            localStorage.setItem("smart_waste_pending_feedback", JSON.stringify(pending));
          }
        } catch (e) {
          console.error("Failed to store pending feedback in localStorage", e);
        }
      }
      
      return {
        success: true,
        message: `Saved classification correction to offline sync queue (Offline fallback activated)`,
      };
    }
  }

  private triggerSync() {
    if (typeof window !== "undefined" && !this.isSyncing) {
      this.syncFeedback().catch((err) => console.error("Background feedback sync error:", err));
    }
  }

  async syncFeedback(): Promise<void> {
    if (typeof window === "undefined" || this.isSyncing) return;
    
    try {
      const pending: FeedbackPayload[] = JSON.parse(
        localStorage.getItem("smart_waste_pending_feedback") || "[]"
      );
      if (pending.length === 0) return;
      
      this.isSyncing = true;
      console.log(`Smart Waste Bin Sync: Synchronizing ${pending.length} pending feedback records...`);
      const remaining: FeedbackPayload[] = [];
      
      for (const payload of pending) {
        try {
          // Attempt POST to primary Flask API first
          const primaryUrl = `${API_BASE_URL}/api/feedback`;
          let res = await fetch(primaryUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined,
          });
          
          if (!res.ok) {
            // Try Next.js fallback API
            const fallbackBase = process.env.NEXT_PUBLIC_DEMO_API_URL || window.location.origin;
            const fallbackUrl = `${fallbackBase}/api/feedback`;
            res = await fetch(fallbackUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload),
              signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined,
            });
          }
          
          if (res.ok) {
            console.log(`Successfully synced pending feedback for ${payload.bin_id} corrected to ${payload.corrected_class}`);
          } else {
            remaining.push(payload);
          }
        } catch {
          remaining.push(payload);
        }
      }
      
      if (remaining.length > 0) {
        localStorage.setItem("smart_waste_pending_feedback", JSON.stringify(remaining));
      } else {
        localStorage.removeItem("smart_waste_pending_feedback");
        console.log("Smart Waste Bin Sync: All pending feedback records successfully synchronized.");
      }
    } catch (e) {
      console.error("Failed to run feedback synchronization loop", e);
    } finally {
      this.isSyncing = false;
    }
  }
}

export const apiClient = new ApiClient();
export default apiClient;
