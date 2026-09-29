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
        Row: { id: string; owner_id: string; name: string; primary_board_id: string | null; schema_version: number; document: Json; archived: boolean; revision: number; created_at: string; updated_at: string };
        Insert: { id: string; name: string; primary_board_id?: string | null; schema_version: number; document: Json; owner_id?: string; archived?: boolean; created_at?: string; updated_at?: string };
        Update: { name?: string; primary_board_id?: string | null; schema_version?: number; document?: Json; archived?: boolean };
        Relationships: [];
      };
      inventory_items: {
        Row: { owner_id: string; definition_id: string; quantity: number; created_at: string; updated_at: string };
        Insert: { definition_id: string; quantity: number; updated_at?: string };
        Update: { quantity?: number; updated_at?: string };
        Relationships: [];
      };
      project_versions: {
        Row: { id: string; project_id: string; owner_id: string; revision: number; document: Json; reason: string; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { checkpoint_project: { Args: { p_id: string; p_document: Json; p_reason: string; p_expected_revision?: number | null }; Returns: Json } };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
