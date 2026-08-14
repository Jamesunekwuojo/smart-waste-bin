import useSWR from "swr";
import { apiClient } from "../api-client";
import { Bin } from "../types";

export function useBins() {
  const { data, error, isLoading, mutate } = useSWR<Bin[]>(
    "/api/bins",
    () => apiClient.getBins(),
    {
      refreshInterval: 10000, // Poll every 10 seconds
      revalidateOnFocus: true,
      dedupingInterval: 2000,
    }
  );

  return {
    bins: data || [],
    error,
    isLoading,
    mutate,
  };
}

export default useBins;
