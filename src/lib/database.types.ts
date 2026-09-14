// Hand-authored to match supabase/migrations exactly. Once a real Supabase
// project exists, regenerate with:
//   supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
// and diff against this file before overwriting.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type GameStatus = 'lobby' | 'active' | 'complete' | 'abandoned'
export type GameOutcome = 'seat_1' | 'seat_2' | 'draw'
export type SecondaryRole = 'attacker' | 'defender'
export type PlayerRole = 'attacker' | 'defender'

export interface Database {
  public: {
    Tables: {
      rulesets: {
        Row: {
          id: string
          name: string
          edition: number
          is_current: boolean
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['rulesets']['Row']> & { name: string; edition: number }
        Update: Partial<Database['public']['Tables']['rulesets']['Row']>
        Relationships: []
      }
      mission_packs: {
        Row: {
          id: string
          ruleset_id: string
          name: string
          valid_from: string
          valid_to: string | null
          is_current: boolean
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['mission_packs']['Row']> & {
          ruleset_id: string
          name: string
          valid_from: string
        }
        Update: Partial<Database['public']['Tables']['mission_packs']['Row']>
        Relationships: []
      }
      missions: {
        Row: {
          id: string
          mission_pack_id: string
          name: string
          max_primary_vp: number
          force_disposition_id: string | null
          opponent_force_disposition_id: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['missions']['Row']> & {
          mission_pack_id: string
          name: string
        }
        Update: Partial<Database['public']['Tables']['missions']['Row']>
        Relationships: []
      }
      force_dispositions: {
        Row: {
          id: string
          ruleset_id: string
          name: string
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['force_dispositions']['Row']> & {
          ruleset_id: string
          name: string
        }
        Update: Partial<Database['public']['Tables']['force_dispositions']['Row']>
        Relationships: []
      }
      deployments: {
        Row: {
          id: string
          mission_pack_id: string
          name: string
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['deployments']['Row']> & {
          mission_pack_id: string
          name: string
        }
        Update: Partial<Database['public']['Tables']['deployments']['Row']>
        Relationships: []
      }
      secondary_objectives: {
        Row: {
          id: string
          mission_pack_id: string
          name: string
          role: SecondaryRole | null
          max_vp: number
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['secondary_objectives']['Row']> & {
          mission_pack_id: string
          name: string
        }
        Update: Partial<Database['public']['Tables']['secondary_objectives']['Row']>
        Relationships: []
      }
      factions: {
        Row: {
          id: string
          ruleset_id: string
          name: string
          parent_faction_id: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['factions']['Row']> & {
          ruleset_id: string
          name: string
        }
        Update: Partial<Database['public']['Tables']['factions']['Row']>
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          display_name: string
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id: string
          display_name: string
          avatar_url?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['profiles']['Row']>
        Relationships: []
      }
      games: {
        Row: {
          id: string
          join_code: string
          status: GameStatus
          mission_pack_id: string
          deployment_id: string
          points_limit: number
          total_rounds: number
          current_round: number
          created_by: string | null
          created_at: string
          started_at: string | null
          ended_at: string | null
          outcome: GameOutcome | null
        }
        Insert: Partial<Database['public']['Tables']['games']['Row']> & {
          join_code: string
          mission_pack_id: string
          deployment_id: string
          points_limit: number
        }
        Update: Partial<Database['public']['Tables']['games']['Row']>
        Relationships: []
      }
      game_players: {
        Row: {
          id: string
          game_id: string
          user_id: string
          seat: 1 | 2
          faction_id: string | null
          army_name: string | null
          force_disposition_id: string | null
          mission_id: string | null
          role: PlayerRole | null
          is_ready: boolean
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['game_players']['Row']> & {
          game_id: string
          user_id: string
          seat: 1 | 2
        }
        Update: Partial<Database['public']['Tables']['game_players']['Row']>
        Relationships: []
      }
      round_scores: {
        Row: {
          id: string
          game_id: string
          game_player_id: string
          battle_round: number
          primary_vp: number
          updated_by: string | null
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['round_scores']['Row']> & {
          game_id: string
          game_player_id: string
          battle_round: number
        }
        Update: Partial<Database['public']['Tables']['round_scores']['Row']>
        Relationships: []
      }
      secondary_scores: {
        Row: {
          id: string
          game_id: string
          game_player_id: string
          battle_round: number
          secondary_objective_id: string
          vp_scored: number
          updated_by: string | null
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['secondary_scores']['Row']> & {
          game_id: string
          game_player_id: string
          battle_round: number
          secondary_objective_id: string
        }
        Update: Partial<Database['public']['Tables']['secondary_scores']['Row']>
        Relationships: []
      }
      join_attempts: {
        Row: {
          id: string
          user_id: string | null
          code_attempted: string
          success: boolean
          reason: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['join_attempts']['Row']> & {
          code_attempted: string
          success: boolean
        }
        Update: Partial<Database['public']['Tables']['join_attempts']['Row']>
        Relationships: []
      }
    }
    Views: {
      game_totals: {
        Row: {
          game_player_id: string
          game_id: string
          seat: 1 | 2
          primary_total: number
          secondary_total: number
          total_vp: number
        }
        Relationships: []
      }
    }
    Functions: {
      is_game_participant: {
        Args: { p_game_id: string }
        Returns: boolean
      }
      generate_join_code: {
        Args: Record<string, never>
        Returns: string
      }
      create_game: {
        Args: {
          p_deployment_id: string
          p_points_limit: number
          p_force_disposition_id?: string | null
          p_faction_id?: string | null
          p_army_name?: string | null
        }
        Returns: string
      }
      join_game_by_code: {
        Args: {
          p_code: string
          p_force_disposition_id?: string | null
          p_faction_id?: string | null
          p_army_name?: string | null
        }
        Returns: string | null
      }
      resolve_game_mission: {
        Args: { p_game_id: string }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
