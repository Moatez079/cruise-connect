import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Request = Tables<"requests">;

export const useRequests = (boatId: string, statusFilter: string) => {
  return useQuery({
    queryKey: ["requests", boatId, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (boatId !== "all") {
        query = query.eq("boat_id", boatId);
      }
      if (statusFilter === "active") {
        query = query.in("status", ["pending", "in_progress"]);
      } else if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as any);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Request[];
    },
  });
};
