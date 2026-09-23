// Maintained against the committed Supabase migrations.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; display_name: string | null; primary_board_id: string | null; setup_completed: boolean; created_at: string; updated_at: string };
        Insert: { display_name?: string | null; primary_board_id?: string | null; setup_completed?: boolean };
        Update: { display_name?: string | null; primary_board_id?: string | null; setup_completed?: boolean };
        Relationships: [];
      };
      projects: {
        Row: { id: string; owner_id: string; name: string; primary_board_id: string | null; schema_version: number; document: Json; archived: boolean; created_at: string; updated_at: string };
        Insert: { id: string; name: string; primary_board_id?: string | null; schema_version: number; document: Json; owner_id?: string; archived?: boolean; created_at?: string; updated_at?: string };
        Update: { name?: string; primary_board_id?: string | null; schema_version?: number; document?: Json; archived?: boolean };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
