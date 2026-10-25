// Arquivo gerado por packages/database/scripts/generate-types.ts — não edite manualmente.
// Fonte da verdade: supabase/migrations. Regenerar com `pnpm db:types`.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '13';
  };
  public: {
    Tables: {
      assistant_usage: {
        Row: {
          day: string;
          questions: number;
          user_id: string;
        };
        Insert: {
          day?: string;
          questions?: number;
          user_id: string;
        };
        Update: {
          day?: string;
          questions?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'assistant_usage_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      book_entries: {
        Row: {
          data: Json;
          id: string;
          key: string;
          kind: string;
          name: string;
          pack_id: string;
          sort_order: number;
        };
        Insert: {
          data?: Json;
          id?: string;
          key: string;
          kind: string;
          name: string;
          pack_id: string;
          sort_order?: number;
        };
        Update: {
          data?: Json;
          id?: string;
          key?: string;
          kind?: string;
          name?: string;
          pack_id?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'book_entries_pack_id_fkey';
            columns: ['pack_id'];
            isOneToOne: false;
            referencedRelation: 'book_packs';
            referencedColumns: ['id'];
          },
        ];
      };
      book_packs: {
        Row: {
          book_key: string;
          category: string;
          content_bytes: number;
          content_hash: string | null;
          content_pack_id: string | null;
          created_at: string;
          edition: string;
          entry_counts: Json;
          entry_total: number;
          id: string;
          is_ready: boolean;
          name: string;
          origin: string;
          owner_id: string;
          system_id: string;
          updated_at: string;
        };
        Insert: {
          book_key: string;
          category: string;
          content_bytes?: number;
          content_hash?: string | null;
          content_pack_id?: string | null;
          created_at?: string;
          edition?: string;
          entry_counts?: Json;
          entry_total?: number;
          id?: string;
          is_ready?: boolean;
          name: string;
          origin?: string;
          owner_id?: string;
          system_id?: string;
          updated_at?: string;
        };
        Update: {
          book_key?: string;
          category?: string;
          content_bytes?: number;
          content_hash?: string | null;
          content_pack_id?: string | null;
          created_at?: string;
          edition?: string;
          entry_counts?: Json;
          entry_total?: number;
          id?: string;
          is_ready?: boolean;
          name?: string;
          origin?: string;
          owner_id?: string;
          system_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'book_packs_content_pack_id_fkey';
            columns: ['content_pack_id'];
            isOneToOne: false;
            referencedRelation: 'book_packs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'book_packs_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'book_packs_system_id_fkey';
            columns: ['system_id'];
            isOneToOne: false;
            referencedRelation: 'rpg_systems';
            referencedColumns: ['id'];
          },
        ];
      };
      campaign_invites: {
        Row: {
          campaign_id: string;
          code: string;
          created_at: string;
          created_by: string;
          declined_at: string | null;
          expires_at: string;
          id: string;
          invited_email: string | null;
          max_uses: number | null;
          revoked_at: string | null;
          role: Database['public']['Enums']['campaign_role'];
          uses_count: number;
        };
        Insert: {
          campaign_id: string;
          code?: string;
          created_at?: string;
          created_by?: string;
          declined_at?: string | null;
          expires_at: string;
          id?: string;
          invited_email?: string | null;
          max_uses?: number | null;
          revoked_at?: string | null;
          role?: Database['public']['Enums']['campaign_role'];
          uses_count?: number;
        };
        Update: {
          campaign_id?: string;
          code?: string;
          created_at?: string;
          created_by?: string;
          declined_at?: string | null;
          expires_at?: string;
          id?: string;
          invited_email?: string | null;
          max_uses?: number | null;
          revoked_at?: string | null;
          role?: Database['public']['Enums']['campaign_role'];
          uses_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'campaign_invites_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'campaign_invites_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      campaign_items: {
        Row: {
          campaign_id: string;
          category: Database['public']['Enums']['item_category'];
          created_at: string;
          created_by: string | null;
          data: Json;
          description: string;
          id: string;
          name: string;
          rarity: string;
          requires_attunement: boolean;
          srd_name: string | null;
          updated_at: string;
          value: string;
          visibility: Database['public']['Enums']['content_visibility'];
          weight: number | null;
        };
        Insert: {
          campaign_id: string;
          category?: Database['public']['Enums']['item_category'];
          created_at?: string;
          created_by?: string | null;
          data?: Json;
          description?: string;
          id?: string;
          name: string;
          rarity?: string;
          requires_attunement?: boolean;
          srd_name?: string | null;
          updated_at?: string;
          value?: string;
          visibility?: Database['public']['Enums']['content_visibility'];
          weight?: number | null;
        };
        Update: {
          campaign_id?: string;
          category?: Database['public']['Enums']['item_category'];
          created_at?: string;
          created_by?: string | null;
          data?: Json;
          description?: string;
          id?: string;
          name?: string;
          rarity?: string;
          requires_attunement?: boolean;
          srd_name?: string | null;
          updated_at?: string;
          value?: string;
          visibility?: Database['public']['Enums']['content_visibility'];
          weight?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'campaign_items_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'campaign_items_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      campaign_members: {
        Row: {
          campaign_id: string;
          dice_color: string | null;
          joined_at: string;
          role: Database['public']['Enums']['campaign_role'];
          user_id: string;
        };
        Insert: {
          campaign_id: string;
          dice_color?: string | null;
          joined_at?: string;
          role?: Database['public']['Enums']['campaign_role'];
          user_id: string;
        };
        Update: {
          campaign_id?: string;
          dice_color?: string | null;
          joined_at?: string;
          role?: Database['public']['Enums']['campaign_role'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'campaign_members_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'campaign_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      campaign_notes: {
        Row: {
          author_id: string;
          body: string;
          campaign_id: string;
          created_at: string;
          id: string;
          image_path: string | null;
          is_pinned: boolean;
          title: string;
          updated_at: string;
          version: number;
          visibility: Database['public']['Enums']['content_visibility'];
        };
        Insert: {
          author_id?: string;
          body?: string;
          campaign_id: string;
          created_at?: string;
          id?: string;
          image_path?: string | null;
          is_pinned?: boolean;
          title: string;
          updated_at?: string;
          version?: number;
          visibility?: Database['public']['Enums']['content_visibility'];
        };
        Update: {
          author_id?: string;
          body?: string;
          campaign_id?: string;
          created_at?: string;
          id?: string;
          image_path?: string | null;
          is_pinned?: boolean;
          title?: string;
          updated_at?: string;
          version?: number;
          visibility?: Database['public']['Enums']['content_visibility'];
        };
        Relationships: [
          {
            foreignKeyName: 'campaign_notes_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'campaign_notes_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
        ];
      };
      campaign_turns: {
        Row: {
          active_character_id: string | null;
          active_name: string | null;
          campaign_id: string;
          encounter_id: string;
          mode: string;
          name: string;
          round: number;
          session_id: string;
          status: Database['public']['Enums']['encounter_status'];
          turn_order: Json;
          updated_at: string;
        };
        Insert: {
          active_character_id?: string | null;
          active_name?: string | null;
          campaign_id: string;
          encounter_id: string;
          mode: string;
          name: string;
          round: number;
          session_id: string;
          status: Database['public']['Enums']['encounter_status'];
          turn_order?: Json;
          updated_at?: string;
        };
        Update: {
          active_character_id?: string | null;
          active_name?: string | null;
          campaign_id?: string;
          encounter_id?: string;
          mode?: string;
          name?: string;
          round?: number;
          session_id?: string;
          status?: Database['public']['Enums']['encounter_status'];
          turn_order?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'campaign_turns_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: true;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'campaign_turns_encounter_id_fkey';
            columns: ['encounter_id'];
            isOneToOne: false;
            referencedRelation: 'encounters';
            referencedColumns: ['id'];
          },
        ];
      };
      campaigns: {
        Row: {
          archived_at: string | null;
          character_rules: Json;
          cover_path: string | null;
          created_at: string;
          custom_actions: Json;
          default_turn_mode: string;
          default_turn_order: string;
          description: string;
          id: string;
          map_follows_turn: boolean;
          name: string;
          owner_id: string;
          party_sheets_visible: boolean;
          players_can_edit_sheets: boolean;
          players_see_turn_order: boolean;
          status: Database['public']['Enums']['campaign_status'];
          system_id: string;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          character_rules?: Json;
          cover_path?: string | null;
          created_at?: string;
          custom_actions?: Json;
          default_turn_mode?: string;
          default_turn_order?: string;
          description?: string;
          id?: string;
          map_follows_turn?: boolean;
          name: string;
          owner_id?: string;
          party_sheets_visible?: boolean;
          players_can_edit_sheets?: boolean;
          players_see_turn_order?: boolean;
          status?: Database['public']['Enums']['campaign_status'];
          system_id: string;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          character_rules?: Json;
          cover_path?: string | null;
          created_at?: string;
          custom_actions?: Json;
          default_turn_mode?: string;
          default_turn_order?: string;
          description?: string;
          id?: string;
          map_follows_turn?: boolean;
          name?: string;
          owner_id?: string;
          party_sheets_visible?: boolean;
          players_can_edit_sheets?: boolean;
          players_see_turn_order?: boolean;
          status?: Database['public']['Enums']['campaign_status'];
          system_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'campaigns_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'campaigns_system_id_fkey';
            columns: ['system_id'];
            isOneToOne: false;
            referencedRelation: 'rpg_systems';
            referencedColumns: ['id'];
          },
        ];
      };
      character_abilities: {
        Row: {
          character_id: string;
          created_at: string;
          data: Json;
          description: string;
          id: string;
          kind: Database['public']['Enums']['ability_entry_kind'];
          name: string;
          resource_id: string | null;
          sort_order: number;
          source: string;
          updated_at: string;
        };
        Insert: {
          character_id: string;
          created_at?: string;
          data?: Json;
          description?: string;
          id?: string;
          kind: Database['public']['Enums']['ability_entry_kind'];
          name: string;
          resource_id?: string | null;
          sort_order?: number;
          source?: string;
          updated_at?: string;
        };
        Update: {
          character_id?: string;
          created_at?: string;
          data?: Json;
          description?: string;
          id?: string;
          kind?: Database['public']['Enums']['ability_entry_kind'];
          name?: string;
          resource_id?: string | null;
          sort_order?: number;
          source?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'character_abilities_character_id_fkey';
            columns: ['character_id'];
            isOneToOne: false;
            referencedRelation: 'characters';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'character_abilities_resource_fk';
            columns: ['character_id', 'resource_id'];
            isOneToOne: false;
            referencedRelation: 'character_resources';
            referencedColumns: ['character_id', 'id'];
          },
        ];
      };
      character_conditions: {
        Row: {
          character_id: string;
          created_at: string;
          id: string;
          key: string;
          level: number | null;
          note: string;
          rounds_remaining: number | null;
        };
        Insert: {
          character_id: string;
          created_at?: string;
          id?: string;
          key: string;
          level?: number | null;
          note?: string;
          rounds_remaining?: number | null;
        };
        Update: {
          character_id?: string;
          created_at?: string;
          id?: string;
          key?: string;
          level?: number | null;
          note?: string;
          rounds_remaining?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'character_conditions_character_id_fkey';
            columns: ['character_id'];
            isOneToOne: false;
            referencedRelation: 'characters';
            referencedColumns: ['id'];
          },
        ];
      };
      character_drafts: {
        Row: {
          campaign_id: string | null;
          created_at: string;
          id: string;
          name: string;
          owner_id: string;
          payload: Json;
          system_id: string;
          updated_at: string;
        };
        Insert: {
          campaign_id?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          owner_id?: string;
          payload?: Json;
          system_id: string;
          updated_at?: string;
        };
        Update: {
          campaign_id?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          owner_id?: string;
          payload?: Json;
          system_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'character_drafts_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'character_drafts_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'character_drafts_system_id_fkey';
            columns: ['system_id'];
            isOneToOne: false;
            referencedRelation: 'rpg_systems';
            referencedColumns: ['id'];
          },
        ];
      };
      character_events: {
        Row: {
          actor_id: string | null;
          character_id: string;
          data: Json;
          id: string;
          kind: string;
          occurred_at: string;
          summary: string;
        };
        Insert: {
          actor_id?: string | null;
          character_id: string;
          data?: Json;
          id?: string;
          kind: string;
          occurred_at?: string;
          summary: string;
        };
        Update: {
          actor_id?: string | null;
          character_id?: string;
          data?: Json;
          id?: string;
          kind?: string;
          occurred_at?: string;
          summary?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'character_events_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'character_events_character_id_fkey';
            columns: ['character_id'];
            isOneToOne: false;
            referencedRelation: 'characters';
            referencedColumns: ['id'];
          },
        ];
      };
      character_items: {
        Row: {
          category: Database['public']['Enums']['item_category'];
          character_id: string;
          created_at: string;
          data: Json;
          description: string;
          id: string;
          is_equipped: boolean;
          name: string;
          notes: string;
          quantity: number;
          sort_order: number;
          updated_at: string;
          weight: number | null;
        };
        Insert: {
          category?: Database['public']['Enums']['item_category'];
          character_id: string;
          created_at?: string;
          data?: Json;
          description?: string;
          id?: string;
          is_equipped?: boolean;
          name: string;
          notes?: string;
          quantity?: number;
          sort_order?: number;
          updated_at?: string;
          weight?: number | null;
        };
        Update: {
          category?: Database['public']['Enums']['item_category'];
          character_id?: string;
          created_at?: string;
          data?: Json;
          description?: string;
          id?: string;
          is_equipped?: boolean;
          name?: string;
          notes?: string;
          quantity?: number;
          sort_order?: number;
          updated_at?: string;
          weight?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'character_items_character_id_fkey';
            columns: ['character_id'];
            isOneToOne: false;
            referencedRelation: 'characters';
            referencedColumns: ['id'];
          },
        ];
      };
      character_resources: {
        Row: {
          character_id: string;
          created_at: string;
          current: number;
          display: string;
          id: string;
          key: string;
          label: string;
          max: number | null;
          recovery: Database['public']['Enums']['resource_recovery'];
          sort_order: number;
          temp: number;
          updated_at: string;
        };
        Insert: {
          character_id: string;
          created_at?: string;
          current?: number;
          display?: string;
          id?: string;
          key: string;
          label: string;
          max?: number | null;
          recovery?: Database['public']['Enums']['resource_recovery'];
          sort_order?: number;
          temp?: number;
          updated_at?: string;
        };
        Update: {
          character_id?: string;
          created_at?: string;
          current?: number;
          display?: string;
          id?: string;
          key?: string;
          label?: string;
          max?: number | null;
          recovery?: Database['public']['Enums']['resource_recovery'];
          sort_order?: number;
          temp?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'character_resources_character_id_fkey';
            columns: ['character_id'];
            isOneToOne: false;
            referencedRelation: 'characters';
            referencedColumns: ['id'];
          },
        ];
      };
      character_snapshots: {
        Row: {
          character_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          sheet: Json;
          version: number;
        };
        Insert: {
          character_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          sheet: Json;
          version: number;
        };
        Update: {
          character_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          sheet?: Json;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'character_snapshots_character_id_fkey';
            columns: ['character_id'];
            isOneToOne: false;
            referencedRelation: 'characters';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'character_snapshots_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      characters: {
        Row: {
          campaign_id: string | null;
          created_at: string;
          granted_level: number;
          id: string;
          live_updated_at: string;
          name: string;
          owner_id: string;
          portrait_path: string | null;
          sheet: Json;
          system_id: string;
          token_path: string | null;
          updated_at: string;
          version: number;
        };
        Insert: {
          campaign_id?: string | null;
          created_at?: string;
          granted_level?: number;
          id?: string;
          live_updated_at?: string;
          name: string;
          owner_id?: string;
          portrait_path?: string | null;
          sheet?: Json;
          system_id: string;
          token_path?: string | null;
          updated_at?: string;
          version?: number;
        };
        Update: {
          campaign_id?: string | null;
          created_at?: string;
          granted_level?: number;
          id?: string;
          live_updated_at?: string;
          name?: string;
          owner_id?: string;
          portrait_path?: string | null;
          sheet?: Json;
          system_id?: string;
          token_path?: string | null;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'characters_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'characters_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'characters_system_id_fkey';
            columns: ['system_id'];
            isOneToOne: false;
            referencedRelation: 'rpg_systems';
            referencedColumns: ['id'];
          },
        ];
      };
      creature_gm_data: {
        Row: {
          campaign_id: string;
          creature_id: string;
          notes: string;
          secrets: string;
          stats: Json;
          updated_at: string;
        };
        Insert: {
          campaign_id: string;
          creature_id: string;
          notes?: string;
          secrets?: string;
          stats?: Json;
          updated_at?: string;
        };
        Update: {
          campaign_id?: string;
          creature_id?: string;
          notes?: string;
          secrets?: string;
          stats?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'creature_gm_data_creature_fk';
            columns: ['creature_id', 'campaign_id'];
            isOneToOne: false;
            referencedRelation: 'creatures';
            referencedColumns: ['id', 'campaign_id'];
          },
        ];
      };
      creatures: {
        Row: {
          campaign_id: string;
          created_at: string;
          created_by: string | null;
          description: string;
          id: string;
          image_path: string | null;
          kind: Database['public']['Enums']['creature_kind'];
          name: string;
          size: string;
          subtitle: string;
          updated_at: string;
          visibility: Database['public']['Enums']['content_visibility'];
        };
        Insert: {
          campaign_id: string;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          id?: string;
          image_path?: string | null;
          kind: Database['public']['Enums']['creature_kind'];
          name: string;
          size?: string;
          subtitle?: string;
          updated_at?: string;
          visibility?: Database['public']['Enums']['content_visibility'];
        };
        Update: {
          campaign_id?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          id?: string;
          image_path?: string | null;
          kind?: Database['public']['Enums']['creature_kind'];
          name?: string;
          size?: string;
          subtitle?: string;
          updated_at?: string;
          visibility?: Database['public']['Enums']['content_visibility'];
        };
        Relationships: [
          {
            foreignKeyName: 'creatures_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'creatures_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      dice_rolls: {
        Row: {
          campaign_id: string;
          character_id: string | null;
          created_at: string;
          dice: Json;
          expression: string;
          id: string;
          label: string;
          mode: string;
          modifier: number;
          roller_name: string;
          total: number;
          user_id: string;
          visibility: Database['public']['Enums']['content_visibility'];
        };
        Insert: {
          campaign_id: string;
          character_id?: string | null;
          created_at?: string;
          dice: Json;
          expression: string;
          id?: string;
          label?: string;
          mode?: string;
          modifier?: number;
          roller_name: string;
          total: number;
          user_id: string;
          visibility?: Database['public']['Enums']['content_visibility'];
        };
        Update: {
          campaign_id?: string;
          character_id?: string | null;
          created_at?: string;
          dice?: Json;
          expression?: string;
          id?: string;
          label?: string;
          mode?: string;
          modifier?: number;
          roller_name?: string;
          total?: number;
          user_id?: string;
          visibility?: Database['public']['Enums']['content_visibility'];
        };
        Relationships: [
          {
            foreignKeyName: 'dice_rolls_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'dice_rolls_character_id_fkey';
            columns: ['character_id'];
            isOneToOne: false;
            referencedRelation: 'characters';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'dice_rolls_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      encounter_combatants: {
        Row: {
          campaign_id: string;
          character_id: string | null;
          created_at: string;
          encounter_id: string;
          id: string;
          initiative: number | null;
          is_defeated: boolean;
          is_hidden: boolean;
          session_entity_id: string | null;
          sort_order: number;
          tiebreaker: number;
          turn_state: Json;
        };
        Insert: {
          campaign_id: string;
          character_id?: string | null;
          created_at?: string;
          encounter_id: string;
          id?: string;
          initiative?: number | null;
          is_defeated?: boolean;
          is_hidden?: boolean;
          session_entity_id?: string | null;
          sort_order?: number;
          tiebreaker?: number;
          turn_state?: Json;
        };
        Update: {
          campaign_id?: string;
          character_id?: string | null;
          created_at?: string;
          encounter_id?: string;
          id?: string;
          initiative?: number | null;
          is_defeated?: boolean;
          is_hidden?: boolean;
          session_entity_id?: string | null;
          sort_order?: number;
          tiebreaker?: number;
          turn_state?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'encounter_combatants_character_id_fkey';
            columns: ['character_id'];
            isOneToOne: false;
            referencedRelation: 'characters';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'encounter_combatants_encounter_fk';
            columns: ['encounter_id', 'campaign_id'];
            isOneToOne: false;
            referencedRelation: 'encounters';
            referencedColumns: ['id', 'campaign_id'];
          },
          {
            foreignKeyName: 'encounter_combatants_entity_fk';
            columns: ['session_entity_id', 'campaign_id'];
            isOneToOne: false;
            referencedRelation: 'session_entities';
            referencedColumns: ['id', 'campaign_id'];
          },
        ];
      };
      encounters: {
        Row: {
          active_combatant_id: string | null;
          campaign_id: string;
          created_at: string;
          id: string;
          mode: string;
          name: string;
          order_mode: string;
          round: number;
          session_id: string;
          status: Database['public']['Enums']['encounter_status'];
          updated_at: string;
          version: number;
        };
        Insert: {
          active_combatant_id?: string | null;
          campaign_id: string;
          created_at?: string;
          id?: string;
          mode?: string;
          name?: string;
          order_mode?: string;
          round?: number;
          session_id: string;
          status?: Database['public']['Enums']['encounter_status'];
          updated_at?: string;
          version?: number;
        };
        Update: {
          active_combatant_id?: string | null;
          campaign_id?: string;
          created_at?: string;
          id?: string;
          mode?: string;
          name?: string;
          order_mode?: string;
          round?: number;
          session_id?: string;
          status?: Database['public']['Enums']['encounter_status'];
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'encounters_active_combatant_fk';
            columns: ['active_combatant_id'];
            isOneToOne: false;
            referencedRelation: 'encounter_combatants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'encounters_session_fk';
            columns: ['session_id', 'campaign_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id', 'campaign_id'];
          },
        ];
      };
      map_tokens: {
        Row: {
          campaign_id: string;
          character_id: string | null;
          created_at: string;
          creature_id: string | null;
          id: string;
          image_path: string | null;
          is_hidden: boolean;
          kind: string;
          label: string;
          map_id: string;
          size: string;
          updated_at: string;
          vision_radius: number;
          x: number;
          y: number;
        };
        Insert: {
          campaign_id: string;
          character_id?: string | null;
          created_at?: string;
          creature_id?: string | null;
          id?: string;
          image_path?: string | null;
          is_hidden?: boolean;
          kind: string;
          label?: string;
          map_id: string;
          size?: string;
          updated_at?: string;
          vision_radius?: number;
          x?: number;
          y?: number;
        };
        Update: {
          campaign_id?: string;
          character_id?: string | null;
          created_at?: string;
          creature_id?: string | null;
          id?: string;
          image_path?: string | null;
          is_hidden?: boolean;
          kind?: string;
          label?: string;
          map_id?: string;
          size?: string;
          updated_at?: string;
          vision_radius?: number;
          x?: number;
          y?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'map_tokens_character_id_fkey';
            columns: ['character_id'];
            isOneToOne: false;
            referencedRelation: 'characters';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'map_tokens_creature_fk';
            columns: ['creature_id', 'campaign_id'];
            isOneToOne: false;
            referencedRelation: 'creatures';
            referencedColumns: ['id', 'campaign_id'];
          },
          {
            foreignKeyName: 'map_tokens_map_fk';
            columns: ['map_id', 'campaign_id'];
            isOneToOne: false;
            referencedRelation: 'session_maps';
            referencedColumns: ['id', 'campaign_id'];
          },
        ];
      };
      plans: {
        Row: {
          created_at: string;
          id: string;
          max_members_per_campaign: number | null;
          max_owned_campaigns: number | null;
          max_owned_characters: number | null;
          max_storage_mb: number | null;
          name: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          max_members_per_campaign?: number | null;
          max_owned_campaigns?: number | null;
          max_owned_characters?: number | null;
          max_storage_mb?: number | null;
          name: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          max_members_per_campaign?: number | null;
          max_owned_campaigns?: number | null;
          max_owned_characters?: number | null;
          max_storage_mb?: number | null;
          name?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          bio: string;
          created_at: string;
          display_name: string;
          id: string;
          preferences: Json;
          updated_at: string;
        };
        Insert: {
          avatar_path?: string | null;
          bio?: string;
          created_at?: string;
          display_name: string;
          id: string;
          preferences?: Json;
          updated_at?: string;
        };
        Update: {
          avatar_path?: string | null;
          bio?: string;
          created_at?: string;
          display_name?: string;
          id?: string;
          preferences?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      push_tokens: {
        Row: {
          created_at: string;
          platform: string;
          token: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          platform: string;
          token: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          platform?: string;
          token?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'push_tokens_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      rpg_systems: {
        Row: {
          created_at: string;
          id: string;
          is_enabled: boolean;
          name: string;
          short_name: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          is_enabled?: boolean;
          name: string;
          short_name: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_enabled?: boolean;
          name?: string;
          short_name?: string;
        };
        Relationships: [];
      };
      session_attendance: {
        Row: {
          campaign_id: string;
          session_id: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          campaign_id: string;
          session_id: string;
          status: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          campaign_id?: string;
          session_id?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'session_attendance_session_fk';
            columns: ['session_id', 'campaign_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id', 'campaign_id'];
          },
          {
            foreignKeyName: 'session_attendance_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      session_blocks: {
        Row: {
          campaign_id: string;
          created_at: string;
          created_by: string | null;
          data: Json;
          id: string;
          position: number;
          revealable: boolean;
          schema_version: number;
          session_id: string;
          type: Database['public']['Enums']['session_block_type'];
          updated_at: string;
          visibility: Database['public']['Enums']['content_visibility'];
        };
        Insert: {
          campaign_id: string;
          created_at?: string;
          created_by?: string | null;
          data?: Json;
          id?: string;
          position: number;
          revealable?: boolean;
          schema_version?: number;
          session_id: string;
          type: Database['public']['Enums']['session_block_type'];
          updated_at?: string;
          visibility?: Database['public']['Enums']['content_visibility'];
        };
        Update: {
          campaign_id?: string;
          created_at?: string;
          created_by?: string | null;
          data?: Json;
          id?: string;
          position?: number;
          revealable?: boolean;
          schema_version?: number;
          session_id?: string;
          type?: Database['public']['Enums']['session_block_type'];
          updated_at?: string;
          visibility?: Database['public']['Enums']['content_visibility'];
        };
        Relationships: [
          {
            foreignKeyName: 'session_blocks_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'session_blocks_session_fk';
            columns: ['session_id', 'campaign_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id', 'campaign_id'];
          },
        ];
      };
      session_entities: {
        Row: {
          armor_class: number | null;
          campaign_id: string;
          condition_rounds: Json;
          conditions: string[];
          created_at: string;
          creature_id: string | null;
          hp_current: number | null;
          hp_max: number | null;
          hp_temp: number;
          id: string;
          initiative_bonus: number;
          kind: Database['public']['Enums']['creature_kind'];
          name: string;
          notes: string;
          session_id: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          armor_class?: number | null;
          campaign_id: string;
          condition_rounds?: Json;
          conditions?: string[];
          created_at?: string;
          creature_id?: string | null;
          hp_current?: number | null;
          hp_max?: number | null;
          hp_temp?: number;
          id?: string;
          initiative_bonus?: number;
          kind: Database['public']['Enums']['creature_kind'];
          name: string;
          notes?: string;
          session_id: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          armor_class?: number | null;
          campaign_id?: string;
          condition_rounds?: Json;
          conditions?: string[];
          created_at?: string;
          creature_id?: string | null;
          hp_current?: number | null;
          hp_max?: number | null;
          hp_temp?: number;
          id?: string;
          initiative_bonus?: number;
          kind?: Database['public']['Enums']['creature_kind'];
          name?: string;
          notes?: string;
          session_id?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'session_entities_creature_fk';
            columns: ['creature_id', 'campaign_id'];
            isOneToOne: false;
            referencedRelation: 'creatures';
            referencedColumns: ['id', 'campaign_id'];
          },
          {
            foreignKeyName: 'session_entities_session_fk';
            columns: ['session_id', 'campaign_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id', 'campaign_id'];
          },
        ];
      };
      session_map_secrets: {
        Row: {
          campaign_id: string;
          drawings: Json;
          map_id: string;
          updated_at: string;
        };
        Insert: {
          campaign_id: string;
          drawings?: Json;
          map_id: string;
          updated_at?: string;
        };
        Update: {
          campaign_id?: string;
          drawings?: Json;
          map_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'session_map_secrets_map_fk';
            columns: ['map_id', 'campaign_id'];
            isOneToOne: false;
            referencedRelation: 'session_maps';
            referencedColumns: ['id', 'campaign_id'];
          },
        ];
      };
      session_maps: {
        Row: {
          areas: Json;
          campaign_id: string;
          cols: number;
          created_at: string;
          drawings: Json;
          fog_auto_reveal: boolean;
          fog_enabled: boolean;
          fog_revealed: Json;
          id: string;
          image_offset_x: number;
          image_offset_y: number;
          image_path: string | null;
          image_scale: number;
          images: Json;
          is_active: boolean;
          line_of_sight: boolean;
          name: string;
          rows: number;
          session_id: string;
          show_grid: boolean;
          updated_at: string;
          walls: Json;
        };
        Insert: {
          areas?: Json;
          campaign_id: string;
          cols?: number;
          created_at?: string;
          drawings?: Json;
          fog_auto_reveal?: boolean;
          fog_enabled?: boolean;
          fog_revealed?: Json;
          id?: string;
          image_offset_x?: number;
          image_offset_y?: number;
          image_path?: string | null;
          image_scale?: number;
          images?: Json;
          is_active?: boolean;
          line_of_sight?: boolean;
          name: string;
          rows?: number;
          session_id: string;
          show_grid?: boolean;
          updated_at?: string;
          walls?: Json;
        };
        Update: {
          areas?: Json;
          campaign_id?: string;
          cols?: number;
          created_at?: string;
          drawings?: Json;
          fog_auto_reveal?: boolean;
          fog_enabled?: boolean;
          fog_revealed?: Json;
          id?: string;
          image_offset_x?: number;
          image_offset_y?: number;
          image_path?: string | null;
          image_scale?: number;
          images?: Json;
          is_active?: boolean;
          line_of_sight?: boolean;
          name?: string;
          rows?: number;
          session_id?: string;
          show_grid?: boolean;
          updated_at?: string;
          walls?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'session_maps_session_fk';
            columns: ['session_id', 'campaign_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id', 'campaign_id'];
          },
        ];
      };
      session_notifications: {
        Row: {
          recipients: number;
          scheduled_for: string;
          sent_at: string;
          session_id: string;
        };
        Insert: {
          recipients?: number;
          scheduled_for: string;
          sent_at?: string;
          session_id: string;
        };
        Update: {
          recipients?: number;
          scheduled_for?: string;
          sent_at?: string;
          session_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'session_notifications_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: true;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      sessions: {
        Row: {
          campaign_id: string;
          cover_path: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          is_published: boolean;
          mode: string;
          number: number;
          physical_dice: boolean;
          recap: string;
          scheduled_at: string | null;
          status: Database['public']['Enums']['session_status'];
          title: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          campaign_id: string;
          cover_path?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_published?: boolean;
          mode?: string;
          number?: number;
          physical_dice?: boolean;
          recap?: string;
          scheduled_at?: string | null;
          status?: Database['public']['Enums']['session_status'];
          title: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          campaign_id?: string;
          cover_path?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_published?: boolean;
          mode?: string;
          number?: number;
          physical_dice?: boolean;
          recap?: string;
          scheduled_at?: string | null;
          status?: Database['public']['Enums']['session_status'];
          title?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'sessions_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sessions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      turn_actions: {
        Row: {
          actor_name: string;
          campaign_id: string;
          combatant_id: string;
          created_at: string;
          created_by: string;
          encounter_id: string;
          grants_action: boolean;
          hidden: boolean;
          id: string;
          kind: string;
          label: string;
          roll_detail: string | null;
          roll_id: string | null;
          roll_total: number | null;
          round: number;
          target_character_id: string | null;
          target_combatant_id: string | null;
          target_name: string | null;
        };
        Insert: {
          actor_name: string;
          campaign_id: string;
          combatant_id: string;
          created_at?: string;
          created_by?: string;
          encounter_id: string;
          grants_action?: boolean;
          hidden?: boolean;
          id?: string;
          kind: string;
          label: string;
          roll_detail?: string | null;
          roll_id?: string | null;
          roll_total?: number | null;
          round: number;
          target_character_id?: string | null;
          target_combatant_id?: string | null;
          target_name?: string | null;
        };
        Update: {
          actor_name?: string;
          campaign_id?: string;
          combatant_id?: string;
          created_at?: string;
          created_by?: string;
          encounter_id?: string;
          grants_action?: boolean;
          hidden?: boolean;
          id?: string;
          kind?: string;
          label?: string;
          roll_detail?: string | null;
          roll_id?: string | null;
          roll_total?: number | null;
          round?: number;
          target_character_id?: string | null;
          target_combatant_id?: string | null;
          target_name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'turn_actions_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'turn_actions_combatant_id_fkey';
            columns: ['combatant_id'];
            isOneToOne: false;
            referencedRelation: 'encounter_combatants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'turn_actions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'turn_actions_encounter_id_fkey';
            columns: ['encounter_id'];
            isOneToOne: false;
            referencedRelation: 'encounters';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'turn_actions_roll_id_fkey';
            columns: ['roll_id'];
            isOneToOne: false;
            referencedRelation: 'dice_rolls';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'turn_actions_target_character_id_fkey';
            columns: ['target_character_id'];
            isOneToOne: false;
            referencedRelation: 'characters';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'turn_actions_target_combatant_id_fkey';
            columns: ['target_combatant_id'];
            isOneToOne: false;
            referencedRelation: 'encounter_combatants';
            referencedColumns: ['id'];
          },
        ];
      };
      user_plans: {
        Row: {
          plan_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          plan_id?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          plan_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_plans_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'plans';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_campaign_invite: {
        Args: {
          p_code: string;
        };
        Returns: Json;
      };
      add_my_map_area: {
        Args: {
          p_map_id: string;
          p_area: Json;
        };
        Returns: undefined;
      };
      adjust_character_resource: {
        Args: {
          p_resource_id: string;
          p_operation: string;
          p_amount: number;
        };
        Returns: Database['public']['Tables']['character_resources']['Row'];
        SetofOptions: {
          from: '*';
          to: 'character_resources';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      adjust_item_quantity: {
        Args: {
          p_item_id: string;
          p_delta: number;
        };
        Returns: Database['public']['Tables']['character_items']['Row'];
        SetofOptions: {
          from: '*';
          to: 'character_items';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      adjust_session_entity_hp: {
        Args: {
          p_entity_id: string;
          p_operation: string;
          p_amount: number;
        };
        Returns: Database['public']['Tables']['session_entities']['Row'];
        SetofOptions: {
          from: '*';
          to: 'session_entities';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      archive_campaign: {
        Args: {
          p_campaign_id: string;
        };
        Returns: undefined;
      };
      campaign_session_in_progress: {
        Args: {
          p_campaign_id: string;
        };
        Returns: boolean;
      };
      campaign_session_state: {
        Args: {
          p_campaign_id: string;
        };
        Returns: Json;
      };
      clear_my_map_areas: {
        Args: {
          p_map_id: string;
        };
        Returns: undefined;
      };
      consume_assistant_question: {
        Args: never;
        Returns: number;
      };
      create_character: {
        Args: {
          p_name: string;
          p_system_id: string;
          p_campaign_id?: string;
          p_sheet?: Json;
          p_resources?: Json;
          p_items?: Json;
          p_abilities?: Json;
        };
        Returns: string;
      };
      decline_campaign_invite: {
        Args: {
          p_code: string;
        };
        Returns: Json;
      };
      duplicate_session: {
        Args: {
          p_session_id: string;
        };
        Returns: string;
      };
      end_turn: {
        Args: {
          p_encounter_id: string;
        };
        Returns: unknown[];
      };
      finish_book_import: {
        Args: {
          p_pack_id: string;
          p_entry_counts: Json;
        };
        Returns: undefined;
      };
      get_invite_preview: {
        Args: {
          p_code: string;
        };
        Returns: Json;
      };
      get_my_pending_invites: {
        Args: never;
        Returns: Json;
      };
      grant_character_level: {
        Args: {
          p_character_id: string;
          p_level?: number;
        };
        Returns: number;
      };
      leave_campaign: {
        Args: {
          p_campaign_id: string;
        };
        Returns: undefined;
      };
      list_orphan_media: {
        Args: {
          p_min_age_hours?: number;
          p_limit?: number;
        };
        Returns: string[];
      };
      move_my_token: {
        Args: {
          p_token_id: string;
          p_x: number;
          p_y: number;
        };
        Returns: undefined;
      };
      perform_turn_action: {
        Args: {
          p_combatant_id: string;
          p_kind: string;
          p_label: string;
          p_target_combatant_id?: string;
          p_grants_action?: boolean;
          p_roll_expression?: string;
          p_roll_mode?: string;
          p_manual_total?: number;
        };
        Returns: Database['public']['Tables']['turn_actions']['Row'];
        SetofOptions: {
          from: '*';
          to: 'turn_actions';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      register_push_token: {
        Args: {
          p_token: string;
          p_platform: string;
        };
        Returns: undefined;
      };
      remove_campaign_member: {
        Args: {
          p_campaign_id: string;
          p_user_id: string;
        };
        Returns: undefined;
      };
      reorder_session_blocks: {
        Args: {
          p_session_id: string;
          p_block_ids: string[];
        };
        Returns: undefined;
      };
      revoke_campaign_invite: {
        Args: {
          p_invite_id: string;
        };
        Returns: undefined;
      };
      roll_dice: {
        Args: {
          p_campaign_id: string;
          p_expression: string;
          p_label?: string;
          p_mode?: string;
          p_visibility?: string;
          p_character_id?: string;
        };
        Returns: Database['public']['Tables']['dice_rolls']['Row'];
        SetofOptions: {
          from: '*';
          to: 'dice_rolls';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      set_campaign_member_role: {
        Args: {
          p_campaign_id: string;
          p_user_id: string;
          p_role: Database['public']['Enums']['campaign_role'];
        };
        Returns: undefined;
      };
      set_character_campaign: {
        Args: {
          p_character_id: string;
          p_campaign_id: string;
        };
        Returns: undefined;
      };
      set_my_attendance: {
        Args: {
          p_session_id: string;
          p_status: string;
        };
        Returns: undefined;
      };
      set_my_dice_color: {
        Args: {
          p_campaign_id: string;
          p_color: string;
        };
        Returns: undefined;
      };
      take_character_rest: {
        Args: {
          p_character_id: string;
          p_rest: Database['public']['Enums']['resource_recovery'];
        };
        Returns: number;
      };
      tick_character_conditions: {
        Args: {
          p_character_id: string;
          p_rounds?: number;
        };
        Returns: string[];
      };
      tick_session_entity_conditions: {
        Args: {
          p_entity_id: string;
          p_rounds?: number;
        };
        Returns: string[];
      };
      transfer_campaign_ownership: {
        Args: {
          p_campaign_id: string;
          p_new_owner_id: string;
        };
        Returns: undefined;
      };
      unarchive_campaign: {
        Args: {
          p_campaign_id: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      ability_entry_kind: 'class_feature' | 'species_trait' | 'feat' | 'background_feature' | 'spell' | 'attack' | 'other';
      campaign_role: 'gm' | 'player';
      campaign_status: 'active' | 'archived';
      content_visibility: 'members' | 'gm' | 'author';
      creature_kind: 'npc' | 'monster';
      encounter_status: 'preparing' | 'active' | 'ended';
      item_category: 'weapon' | 'armor' | 'gear' | 'consumable' | 'tool' | 'treasure' | 'other';
      resource_recovery: 'manual' | 'short_rest' | 'long_rest';
      session_block_type: 'paragraph' | 'heading' | 'subheading' | 'callout' | 'gm_note' | 'image' | 'divider' | 'list' | 'checklist' | 'npc_ref' | 'monster_ref' | 'character_ref' | 'content_ref';
      session_status: 'planned' | 'in_progress' | 'completed';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database['public'];

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update'];
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T];
export type FunctionArgs<T extends keyof PublicSchema['Functions']> = PublicSchema['Functions'][T]['Args'];
export type FunctionReturns<T extends keyof PublicSchema['Functions']> = PublicSchema['Functions'][T]['Returns'];

export const Constants = {
  public: {
    Enums: {
      ability_entry_kind: ['class_feature', 'species_trait', 'feat', 'background_feature', 'spell', 'attack', 'other'],
      campaign_role: ['gm', 'player'],
      campaign_status: ['active', 'archived'],
      content_visibility: ['members', 'gm', 'author'],
      creature_kind: ['npc', 'monster'],
      encounter_status: ['preparing', 'active', 'ended'],
      item_category: ['weapon', 'armor', 'gear', 'consumable', 'tool', 'treasure', 'other'],
      resource_recovery: ['manual', 'short_rest', 'long_rest'],
      session_block_type: ['paragraph', 'heading', 'subheading', 'callout', 'gm_note', 'image', 'divider', 'list', 'checklist', 'npc_ref', 'monster_ref', 'character_ref', 'content_ref'],
      session_status: ['planned', 'in_progress', 'completed'],
    },
  },
} as const;
