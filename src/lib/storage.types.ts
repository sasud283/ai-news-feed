import type { Database, Json } from "@/integrations/supabase/types";

type Stories = Database["public"]["Tables"]["stories"];
type StorageFields = {
  publication_status: "review" | "published" | "rejected";
  canonical_url: string | null;
  related_to_url: string | null;
  processing_metadata: Json;
};

/** Local additions until the generated Supabase types are refreshed after migration. */
export type StorageDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables" | "Functions"> & {
    Tables: Omit<Database["public"]["Tables"], "stories"> & {
      stories: Omit<Stories, "Row" | "Insert" | "Update"> & {
        Row: Omit<Stories["Row"], "published_at"> & StorageFields & { published_at: string | null };
        Insert: Omit<Stories["Insert"], "published_at"> &
          Partial<StorageFields> & { published_at?: string | null };
        Update: Omit<Stories["Update"], "published_at"> &
          Partial<StorageFields> & { published_at?: string | null };
      };
    };
    Functions: Database["public"]["Functions"] & {
      review_story: {
        Args: { p_queue_id: string; p_action: string; p_correction: Json | null };
        Returns: undefined;
      };
      update_published_story: {
        Args: { p_story_id: string; p_correction: Json };
        Returns: undefined;
      };
      queue_published_story_for_edit: {
        Args: { p_story_id: string };
        Returns: undefined;
      };
    };
  };
};
