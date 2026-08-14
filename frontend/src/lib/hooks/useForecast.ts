import useSWR from "swr";
import { apiClient } from "../api-client";
import { ForecastRecord } from "../types";

export function useForecast(binId: string) {
  const { data, error, isLoading, mutate } = useSWR<ForecastRecord>(
    binId ? `/api/forecast/${binId}` : null,
    () => apiClient.getForecast(binId),
    {
      refreshInterval: 30000, // Forecast changes less frequently, poll every 30 seconds
      revalidateOnFocus: true,
    }
  );

  return {
    forecast: data,
    error,
    isLoading,
    mutate,
  };
}

export default useForecast;
