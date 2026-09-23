// Kept aligned with the Slice 03 cloud_profiles migration.
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; display_name: string | null; primary_board_id: string | null; setup_completed: boolean; created_at: string; updated_at: string };
        Insert: { display_name?: string | null; primary_board_id?: string | null; setup_completed?: boolean };
        Update: { display_name?: string | null; primary_board_id?: string | null; setup_completed?: boolean };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
