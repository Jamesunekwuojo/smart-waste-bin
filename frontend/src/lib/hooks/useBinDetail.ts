import useSWR from "swr";
import { apiClient } from "../api-client";
import { BinDetail } from "../types";

export function useBinDetail(binId: string, range: "24h" | "7d" | "30d" = "24h") {
  const { data, error, isLoading, mutate } = useSWR<BinDetail>(
    binId ? `/api/bins/${binId}?range=${range}` : null,
    () => apiClient.getBinDetail(binId, range),
    {
      refreshInterval: 12000, // Poll details every 12 seconds
      revalidateOnFocus: true,
    }
  );

  return {
    binDetail: data,
    error,
    isLoading,
    mutate,
  };
}

export default useBinDetail;
