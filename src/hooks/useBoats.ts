import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Boat = Tables<"boats">;

export const useBoats = () => {
  return useQuery({
    queryKey: ["boats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("boats")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Boat[];
    },
  });
};

export const useBoatSettings = (boatId: string | undefined) => {
  return useQuery({
    queryKey: ["boat-settings", boatId],
    queryFn: async () => {
      if (!boatId) return null;
      const { data, error } = await supabase
        .from("boat_settings")
        .select("*")
        .eq("boat_id", boatId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!boatId,
  });
};
