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
      assimilacao_master: {
        Row: {
          campaign_id: string;
          conflicts: Json;
          created_at: string;
          refuges: Json;
          updated_at: string;
        };
        Insert: {
          campaign_id: string;
          conflicts?: Json;
          created_at?: string;
          refuges?: Json;
          updated_at?: string;
        };
        Update: {
          campaign_id?: string;
          conflicts?: Json;
          created_at?: string;
          refuges?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'assimilacao_master_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: true;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
        ];
      };
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
      call_invites: {
        Row: {
          created_at: string;
          invited_by: string;
          room_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          invited_by?: string;
          room_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          invited_by?: string;
          room_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'call_invites_invited_by_fkey';
            columns: ['invited_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'call_invites_room_id_fkey';
            columns: ['room_id'];
            isOneToOne: false;
            referencedRelation: 'call_rooms';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'call_invites_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      call_participants: {
        Row: {
          character_id: string | null;
          joined_at: string;
          left_at: string | null;
          role: string;
          room_id: string;
          speaking_as: string | null;
          status: string;
          user_id: string;
        };
        Insert: {
          character_id?: string | null;
          joined_at?: string;
          left_at?: string | null;
          role?: string;
          room_id: string;
          speaking_as?: string | null;
          status?: string;
          user_id: string;
        };
        Update: {
          character_id?: string | null;
          joined_at?: string;
          left_at?: string | null;
          role?: string;
          room_id?: string;
          speaking_as?: string | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'call_participants_character_id_fkey';
            columns: ['character_id'];
            isOneToOne: false;
            referencedRelation: 'characters';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'call_participants_room_id_fkey';
            columns: ['room_id'];
            isOneToOne: false;
            referencedRelation: 'call_rooms';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'call_participants_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      call_presence: {
        Row: {
          ended_at: string | null;
          id: string;
          last_seen_at: string;
          room_id: string;
          started_at: string;
          user_id: string;
        };
        Insert: {
          ended_at?: string | null;
          id?: string;
          last_seen_at?: string;
          room_id: string;
          started_at?: string;
          user_id?: string;
        };
        Update: {
          ended_at?: string | null;
          id?: string;
          last_seen_at?: string;
          room_id?: string;
          started_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'call_presence_room_id_fkey';
            columns: ['room_id'];
            isOneToOne: false;
            referencedRelation: 'call_rooms';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'call_presence_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      call_rooms: {
        Row: {
          access_mode: string;
          campaign_id: string | null;
          code: string;
          created_at: string;
          ended_at: string | null;
          id: string;
          owner_id: string;
          session_id: string | null;
          slug: string;
          status: string;
          title: string;
          transcription_enabled: boolean;
        };
        Insert: {
          access_mode?: string;
          campaign_id?: string | null;
          code: string;
          created_at?: string;
          ended_at?: string | null;
          id?: string;
          owner_id?: string;
          session_id?: string | null;
          slug: string;
          status?: string;
          title?: string;
          transcription_enabled?: boolean;
        };
        Update: {
          access_mode?: string;
          campaign_id?: string | null;
          code?: string;
          created_at?: string;
          ended_at?: string | null;
          id?: string;
          owner_id?: string;
          session_id?: string | null;
          slug?: string;
          status?: string;
          title?: string;
          transcription_enabled?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'call_rooms_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'call_rooms_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'call_rooms_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      campaign_boards: {
        Row: {
          campaign_id: string;
          created_at: string;
          id: string;
          items: Json;
          session_id: string | null;
          title: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          campaign_id: string;
          created_at?: string;
          id?: string;
          items?: Json;
          session_id?: string | null;
          title: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          campaign_id?: string;
          created_at?: string;
          id?: string;
          items?: Json;
          session_id?: string | null;
          title?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'campaign_boards_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'campaign_boards_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      campaign_handouts: {
        Row: {
          audience: string;
          body: string;
          campaign_id: string;
          character_ids: string[];
          created_at: string;
          created_by: string | null;
          id: string;
          image_path: string | null;
          is_revealed: boolean;
          revealed_at: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          audience?: string;
          body?: string;
          campaign_id: string;
          character_ids?: string[];
          created_at?: string;
          created_by?: string | null;
          id?: string;
          image_path?: string | null;
          is_revealed?: boolean;
          revealed_at?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          audience?: string;
          body?: string;
          campaign_id?: string;
          character_ids?: string[];
          created_at?: string;
          created_by?: string | null;
          id?: string;
          image_path?: string | null;
          is_revealed?: boolean;
          revealed_at?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'campaign_handouts_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'campaign_handouts_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
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
          invited_user_id: string | null;
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
          invited_user_id?: string | null;
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
          invited_user_id?: string | null;
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
          {
            foreignKeyName: 'campaign_invites_invited_user_id_fkey';
            columns: ['invited_user_id'];
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
          creation_questions: string[];
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
          creation_questions?: string[];
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
          creation_questions?: string[];
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
      card_decks: {
        Row: {
          campaign_id: string;
          deck: string;
          drawn: string[];
          pile: string[];
          shown: Json | null;
          updated_at: string;
        };
        Insert: {
          campaign_id: string;
          deck: string;
          drawn?: string[];
          pile?: string[];
          shown?: Json | null;
          updated_at?: string;
        };
        Update: {
          campaign_id?: string;
          deck?: string;
          drawn?: string[];
          pile?: string[];
          shown?: Json | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'card_decks_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
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
      character_answers: {
        Row: {
          answers: Json;
          campaign_id: string;
          character_id: string;
          updated_at: string;
        };
        Insert: {
          answers?: Json;
          campaign_id: string;
          character_id: string;
          updated_at?: string;
        };
        Update: {
          answers?: Json;
          campaign_id?: string;
          character_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'character_answers_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'character_answers_character_id_fkey';
            columns: ['character_id'];
            isOneToOne: true;
            referencedRelation: 'characters';
            referencedColumns: ['id'];
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
      character_money_log: {
        Row: {
          amount: number;
          author_id: string | null;
          balance: number;
          character_id: string;
          created_at: string;
          description: string;
          id: string;
          resource_key: string;
        };
        Insert: {
          amount: number;
          author_id?: string | null;
          balance: number;
          character_id: string;
          created_at?: string;
          description: string;
          id?: string;
          resource_key: string;
        };
        Update: {
          amount?: number;
          author_id?: string | null;
          balance?: number;
          character_id?: string;
          created_at?: string;
          description?: string;
          id?: string;
          resource_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'character_money_log_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'character_money_log_character_id_fkey';
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
      character_shares: {
        Row: {
          character_id: string;
          created_at: string;
          user_id: string;
        };
        Insert: {
          character_id: string;
          created_at?: string;
          user_id: string;
        };
        Update: {
          character_id?: string;
          created_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'character_shares_character_id_fkey';
            columns: ['character_id'];
            isOneToOne: false;
            referencedRelation: 'characters';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'character_shares_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
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
          dice_id: string | null;
          granted_level: number;
          id: string;
          live_updated_at: string;
          name: string;
          npc_campaign_id: string | null;
          npc_listed: boolean;
          owner_id: string;
          portrait_path: string | null;
          share_portrait: boolean;
          sheet: Json;
          system_id: string;
          token_path: string | null;
          updated_at: string;
          version: number;
        };
        Insert: {
          campaign_id?: string | null;
          created_at?: string;
          dice_id?: string | null;
          granted_level?: number;
          id?: string;
          live_updated_at?: string;
          name: string;
          npc_campaign_id?: string | null;
          npc_listed?: boolean;
          owner_id?: string;
          portrait_path?: string | null;
          share_portrait?: boolean;
          sheet?: Json;
          system_id: string;
          token_path?: string | null;
          updated_at?: string;
          version?: number;
        };
        Update: {
          campaign_id?: string | null;
          created_at?: string;
          dice_id?: string | null;
          granted_level?: number;
          id?: string;
          live_updated_at?: string;
          name?: string;
          npc_campaign_id?: string | null;
          npc_listed?: boolean;
          owner_id?: string;
          portrait_path?: string | null;
          share_portrait?: boolean;
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
            foreignKeyName: 'characters_dice_id_fkey';
            columns: ['dice_id'];
            isOneToOne: false;
            referencedRelation: 'user_dice';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'characters_npc_campaign_id_fkey';
            columns: ['npc_campaign_id'];
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
      conflict_objectives: {
        Row: {
          campaign_id: string;
          created_at: string;
          id: string;
          kind: string;
          name: string;
          needed: number;
          progress: number;
          sort_order: number;
          updated_at: string;
          visible: boolean;
        };
        Insert: {
          campaign_id: string;
          created_at?: string;
          id?: string;
          kind?: string;
          name: string;
          needed?: number;
          progress?: number;
          sort_order?: number;
          updated_at?: string;
          visible?: boolean;
        };
        Update: {
          campaign_id?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          name?: string;
          needed?: number;
          progress?: number;
          sort_order?: number;
          updated_at?: string;
          visible?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'conflict_objectives_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
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
          revealed_stats: string[];
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
          revealed_stats?: string[];
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
          revealed_stats?: string[];
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
      friendships: {
        Row: {
          accepted_at: string | null;
          addressee_id: string;
          created_at: string;
          id: string;
          requester_id: string;
          status: Database['public']['Enums']['friendship_status'];
        };
        Insert: {
          accepted_at?: string | null;
          addressee_id: string;
          created_at?: string;
          id?: string;
          requester_id: string;
          status?: Database['public']['Enums']['friendship_status'];
        };
        Update: {
          accepted_at?: string | null;
          addressee_id?: string;
          created_at?: string;
          id?: string;
          requester_id?: string;
          status?: Database['public']['Enums']['friendship_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'friendships_addressee_id_fkey';
            columns: ['addressee_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'friendships_requester_id_fkey';
            columns: ['requester_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      highlight_runs: {
        Row: {
          campaign_id: string;
          created_at: string;
          error: string;
          id: string;
          model: string;
          moments: number;
          session_id: string;
          status: string;
          tokens_in: number;
          tokens_out: number;
        };
        Insert: {
          campaign_id: string;
          created_at?: string;
          error?: string;
          id?: string;
          model?: string;
          moments?: number;
          session_id: string;
          status: string;
          tokens_in?: number;
          tokens_out?: number;
        };
        Update: {
          campaign_id?: string;
          created_at?: string;
          error?: string;
          id?: string;
          model?: string;
          moments?: number;
          session_id?: string;
          status?: string;
          tokens_in?: number;
          tokens_out?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'highlight_runs_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'highlight_runs_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      map_tokens: {
        Row: {
          campaign_id: string;
          character_id: string | null;
          conditions: Json;
          created_at: string;
          creature_id: string | null;
          darkvision_radius: number;
          id: string;
          image_path: string | null;
          is_hidden: boolean;
          kind: string;
          label: string;
          light_bright_radius: number;
          light_dim_radius: number;
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
          conditions?: Json;
          created_at?: string;
          creature_id?: string | null;
          darkvision_radius?: number;
          id?: string;
          image_path?: string | null;
          is_hidden?: boolean;
          kind: string;
          label?: string;
          light_bright_radius?: number;
          light_dim_radius?: number;
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
          conditions?: Json;
          created_at?: string;
          creature_id?: string | null;
          darkvision_radius?: number;
          id?: string;
          image_path?: string | null;
          is_hidden?: boolean;
          kind?: string;
          label?: string;
          light_bright_radius?: number;
          light_dim_radius?: number;
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
          friend_code: string;
          id: string;
          preferences: Json;
          updated_at: string;
        };
        Insert: {
          avatar_path?: string | null;
          bio?: string;
          created_at?: string;
          display_name: string;
          friend_code?: string;
          id: string;
          preferences?: Json;
          updated_at?: string;
        };
        Update: {
          avatar_path?: string | null;
          bio?: string;
          created_at?: string;
          display_name?: string;
          friend_code?: string;
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
      schedule_options: {
        Row: {
          id: string;
          poll_id: string;
          starts_at: string;
        };
        Insert: {
          id?: string;
          poll_id: string;
          starts_at: string;
        };
        Update: {
          id?: string;
          poll_id?: string;
          starts_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'schedule_options_poll_id_fkey';
            columns: ['poll_id'];
            isOneToOne: false;
            referencedRelation: 'schedule_polls';
            referencedColumns: ['id'];
          },
        ];
      };
      schedule_polls: {
        Row: {
          campaign_id: string;
          chosen_option_id: string | null;
          created_at: string;
          created_by: string;
          id: string;
          session_id: string | null;
          status: string;
          title: string;
        };
        Insert: {
          campaign_id: string;
          chosen_option_id?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          session_id?: string | null;
          status?: string;
          title?: string;
        };
        Update: {
          campaign_id?: string;
          chosen_option_id?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          session_id?: string | null;
          status?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'schedule_polls_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'schedule_polls_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'schedule_polls_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      schedule_votes: {
        Row: {
          answer: string;
          option_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          answer: string;
          option_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          answer?: string;
          option_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'schedule_votes_option_id_fkey';
            columns: ['option_id'];
            isOneToOne: false;
            referencedRelation: 'schedule_options';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'schedule_votes_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
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
      session_cast: {
        Row: {
          campaign_id: string;
          character_id: string | null;
          created_at: string;
          creature_id: string | null;
          id: string;
          session_id: string;
        };
        Insert: {
          campaign_id: string;
          character_id?: string | null;
          created_at?: string;
          creature_id?: string | null;
          id?: string;
          session_id: string;
        };
        Update: {
          campaign_id?: string;
          character_id?: string | null;
          created_at?: string;
          creature_id?: string | null;
          id?: string;
          session_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'session_cast_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'session_cast_character_id_fkey';
            columns: ['character_id'];
            isOneToOne: false;
            referencedRelation: 'characters';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'session_cast_creature_id_fkey';
            columns: ['creature_id'];
            isOneToOne: false;
            referencedRelation: 'creatures';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'session_cast_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
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
      session_highlights: {
        Row: {
          campaign_id: string;
          character_ids: string[];
          created_at: string;
          id: string;
          image_path: string | null;
          image_prompt: string;
          location: string;
          mood: string;
          quotes: Json;
          session_id: string;
          source: string;
          status: string;
          summary: string;
          title: string;
          transcript_segment_ids: string[];
          updated_at: string;
        };
        Insert: {
          campaign_id: string;
          character_ids?: string[];
          created_at?: string;
          id?: string;
          image_path?: string | null;
          image_prompt?: string;
          location?: string;
          mood?: string;
          quotes?: Json;
          session_id: string;
          source?: string;
          status?: string;
          summary?: string;
          title: string;
          transcript_segment_ids?: string[];
          updated_at?: string;
        };
        Update: {
          campaign_id?: string;
          character_ids?: string[];
          created_at?: string;
          id?: string;
          image_path?: string | null;
          image_prompt?: string;
          location?: string;
          mood?: string;
          quotes?: Json;
          session_id?: string;
          source?: string;
          status?: string;
          summary?: string;
          title?: string;
          transcript_segment_ids?: string[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'session_highlights_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'session_highlights_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
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
          illumination: string;
          image_offset_x: number;
          image_offset_y: number;
          image_path: string | null;
          image_scale: number;
          images: Json;
          is_active: boolean;
          lights: Json;
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
          illumination?: string;
          image_offset_x?: number;
          image_offset_y?: number;
          image_path?: string | null;
          image_scale?: number;
          images?: Json;
          is_active?: boolean;
          lights?: Json;
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
          illumination?: string;
          image_offset_x?: number;
          image_offset_y?: number;
          image_path?: string | null;
          image_scale?: number;
          images?: Json;
          is_active?: boolean;
          lights?: Json;
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
      t20_attribute_rolls: {
        Row: {
          created_at: string;
          dice: Json;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          dice: Json;
          user_id: string;
        };
        Update: {
          created_at?: string;
          dice?: Json;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 't20_attribute_rolls_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      tavern_messages: {
        Row: {
          body: string;
          campaign_id: string | null;
          created_at: string;
          from_tomo: boolean;
          id: string;
          image_path: string | null;
          recipient_id: string | null;
          sender_id: string;
        };
        Insert: {
          body: string;
          campaign_id?: string | null;
          created_at?: string;
          from_tomo?: boolean;
          id?: string;
          image_path?: string | null;
          recipient_id?: string | null;
          sender_id?: string;
        };
        Update: {
          body?: string;
          campaign_id?: string | null;
          created_at?: string;
          from_tomo?: boolean;
          id?: string;
          image_path?: string | null;
          recipient_id?: string | null;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tavern_messages_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tavern_messages_recipient_id_fkey';
            columns: ['recipient_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tavern_messages_sender_id_fkey';
            columns: ['sender_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      transcript_segments: {
        Row: {
          character_id: string | null;
          created_at: string;
          ended_at: string;
          id: string;
          room_id: string;
          session_id: string | null;
          speaker_label: string;
          speaker_type: string;
          started_at: string;
          text: string;
          user_id: string;
        };
        Insert: {
          character_id?: string | null;
          created_at?: string;
          ended_at: string;
          id?: string;
          room_id: string;
          session_id?: string | null;
          speaker_label: string;
          speaker_type: string;
          started_at: string;
          text: string;
          user_id?: string;
        };
        Update: {
          character_id?: string | null;
          created_at?: string;
          ended_at?: string;
          id?: string;
          room_id?: string;
          session_id?: string | null;
          speaker_label?: string;
          speaker_type?: string;
          started_at?: string;
          text?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'transcript_segments_character_id_fkey';
            columns: ['character_id'];
            isOneToOne: false;
            referencedRelation: 'characters';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'transcript_segments_room_id_fkey';
            columns: ['room_id'];
            isOneToOne: false;
            referencedRelation: 'call_rooms';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'transcript_segments_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'transcript_segments_user_id_fkey';
            columns: ['user_id'];
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
      user_dice: {
        Row: {
          color: string | null;
          created_at: string;
          font: string | null;
          id: string;
          image_path: string | null;
          name: string;
          number_color: string | null;
          owner_id: string;
          updated_at: string;
        };
        Insert: {
          color?: string | null;
          created_at?: string;
          font?: string | null;
          id?: string;
          image_path?: string | null;
          name: string;
          number_color?: string | null;
          owner_id?: string;
          updated_at?: string;
        };
        Update: {
          color?: string | null;
          created_at?: string;
          font?: string | null;
          id?: string;
          image_path?: string | null;
          name?: string;
          number_color?: string | null;
          owner_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_dice_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
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
      accept_friend: {
        Args: {
          p_friendship_id: string;
        };
        Returns: undefined;
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
      call_usage_month: {
        Args: never;
        Returns: unknown[];
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
      campaign_shown_cards: {
        Args: {
          p_campaign_id: string;
        };
        Returns: unknown[];
      };
      clear_my_map_areas: {
        Args: {
          p_map_id: string;
        };
        Returns: undefined;
      };
      close_idle_call_rooms: {
        Args: never;
        Returns: undefined;
      };
      confirm_schedule: {
        Args: {
          p_poll_id: string;
          p_option_id: string;
        };
        Returns: undefined;
      };
      consume_assistant_question: {
        Args: never;
        Returns: number;
      };
      consume_t20_attribute_dice: {
        Args: never;
        Returns: undefined;
      };
      create_call_room: {
        Args: {
          p_title?: string;
          p_access_mode?: string;
          p_campaign_id?: string;
          p_session_id?: string;
        };
        Returns: unknown[];
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
          p_answers?: Json;
        };
        Returns: string;
      };
      create_schedule_poll: {
        Args: {
          p_campaign_id: string;
          p_session_id: string;
          p_title: string;
          p_starts: string[];
        };
        Returns: string;
      };
      creature_revealed_stats: {
        Args: {
          p_creature_id: string;
        };
        Returns: Json;
      };
      decide_call_participant: {
        Args: {
          p_room_id: string;
          p_user_id: string;
          p_approve: boolean;
        };
        Returns: undefined;
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
      end_call_presence: {
        Args: {
          p_presence_id: string;
        };
        Returns: undefined;
      };
      end_turn: {
        Args: {
          p_encounter_id: string;
        };
        Returns: unknown[];
      };
      find_call_room: {
        Args: {
          p_ref: string;
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
      finish_highlight_run: {
        Args: {
          p_run_id: string;
          p_status: string;
          p_model?: string;
          p_tokens_in?: number;
          p_tokens_out?: number;
          p_moments?: number;
          p_error?: string;
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
      heartbeat_call_presence: {
        Args: {
          p_presence_id: string;
        };
        Returns: undefined;
      };
      invite_friend_to_campaign: {
        Args: {
          p_campaign_id: string;
          p_friend_id: string;
        };
        Returns: undefined;
      };
      invite_to_call: {
        Args: {
          p_room_id: string;
          p_user_id: string;
        };
        Returns: undefined;
      };
      join_call_room: {
        Args: {
          p_room_id: string;
        };
        Returns: string;
      };
      leave_call_room: {
        Args: {
          p_room_id: string;
        };
        Returns: undefined;
      };
      leave_campaign: {
        Args: {
          p_campaign_id: string;
        };
        Returns: undefined;
      };
      list_character_token_images: {
        Args: {
          p_character_ids: string[];
        };
        Returns: unknown[];
      };
      list_orphan_media: {
        Args: {
          p_min_age_hours?: number;
          p_limit?: number;
        };
        Returns: string[];
      };
      list_party_faces: {
        Args: {
          p_campaign_id: string;
        };
        Returns: unknown[];
      };
      list_recent_ended_calls: {
        Args: never;
        Returns: unknown[];
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
      purge_expired_call_transcripts: {
        Args: never;
        Returns: undefined;
      };
      record_money: {
        Args: {
          p_character_id: string;
          p_resource_key: string;
          p_amount: number;
          p_description: string;
        };
        Returns: Database['public']['Tables']['character_resources']['Row'];
        SetofOptions: {
          from: '*';
          to: 'character_resources';
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
      request_friend: {
        Args: {
          p_code?: string;
          p_user_id?: string;
        };
        Returns: Json;
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
      session_transcript_expired: {
        Args: {
          p_session_id: string;
        };
        Returns: boolean;
      };
      set_call_speaker: {
        Args: {
          p_room_id: string;
          p_label: string;
        };
        Returns: undefined;
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
      set_character_campaign_with_answers: {
        Args: {
          p_character_id: string;
          p_campaign_id: string;
          p_answers: Json;
        };
        Returns: undefined;
      };
      set_character_dice: {
        Args: {
          p_character_id: string;
          p_dice_id: string;
        };
        Returns: undefined;
      };
      set_character_npc_campaign: {
        Args: {
          p_character_id: string;
          p_campaign_id: string;
        };
        Returns: undefined;
      };
      set_character_npc_listed: {
        Args: {
          p_character_id: string;
          p_listed: boolean;
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
      start_call_presence: {
        Args: {
          p_room_id: string;
        };
        Returns: string;
      };
      start_highlight_run: {
        Args: {
          p_session_id: string;
        };
        Returns: string;
      };
      t20_attribute_dice: {
        Args: never;
        Returns: Json;
      };
      take_character_rest: {
        Args: {
          p_character_id: string;
          p_rest: Database['public']['Enums']['resource_recovery'];
        };
        Returns: number;
      };
      tavern_tomo_reply: {
        Args: {
          p_campaign_id: string;
          p_recipient_id: string;
          p_body: string;
        };
        Returns: undefined;
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
      vote_schedule: {
        Args: {
          p_option_id: string;
          p_answer: string;
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
      friendship_status: 'pending' | 'accepted';
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
      friendship_status: ['pending', 'accepted'],
      item_category: ['weapon', 'armor', 'gear', 'consumable', 'tool', 'treasure', 'other'],
      resource_recovery: ['manual', 'short_rest', 'long_rest'],
      session_block_type: ['paragraph', 'heading', 'subheading', 'callout', 'gm_note', 'image', 'divider', 'list', 'checklist', 'npc_ref', 'monster_ref', 'character_ref', 'content_ref'],
      session_status: ['planned', 'in_progress', 'completed'],
    },
  },
} as const;
