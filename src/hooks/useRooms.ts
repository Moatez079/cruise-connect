import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Room = Tables<"rooms">;

export const useRooms = (boatId: string | undefined) => {
  return useQuery({
    queryKey: ["rooms", boatId],
    queryFn: async () => {
      if (!boatId) return [];
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("boat_id", boatId)
        .order("room_number", { ascending: true });
      if (error) throw error;
      return data as Room[];
    },
    enabled: !!boatId,
  });
};
