
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "announcements": {
                  Row: {
                    "body": string,"created_at": string,"created_by": string | null,"expires_at": string | null,"id": string,"pinned": boolean,"published_at": string,"push": boolean,"season_id": string | null,"target_night_ids": (string)[],"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string | null,"id"?: string,"pinned"?: boolean,"published_at"?: string,"push"?: boolean,"season_id"?: string | null,"target_night_ids"?: (string)[],"title": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string | null,"id"?: string,"pinned"?: boolean,"published_at"?: string,"push"?: boolean,"season_id"?: string | null,"target_night_ids"?: (string)[],"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcements_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "player_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "announcements_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "announcements_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"actor_user_id": string | null,"after": Json | null,"before": Json | null,"created_at": string,"entity": string,"entity_id": string | null,"id": number,"note": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"actor_user_id"?: string | null,"after"?: Json | null,"before"?: Json | null,"created_at"?: string,"entity": string,"entity_id"?: string | null,"id"?: never,"note"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"actor_user_id"?: string | null,"after"?: Json | null,"before"?: Json | null,"created_at"?: string,"entity"?: string,"entity_id"?: string | null,"id"?: never,"note"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "player_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"awards": {
                  Row: {
                    "created_at": string,"details": NonNullable<Json>,"id": string,"kind": string,"player_id": string | null,"season_id": string,"team_id": string | null,"value": number | null,"week_number": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"details"?: NonNullable<Json>,"id"?: string,"kind": string,"player_id"?: string | null,"season_id": string,"team_id"?: string | null,"value"?: number | null,"week_number"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"details"?: NonNullable<Json>,"id"?: string,"kind"?: string,"player_id"?: string | null,"season_id"?: string,"team_id"?: string | null,"value"?: number | null,"week_number"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "awards_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "awards_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "awards_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "awards_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_records"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "awards_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"badges": {
                  Row: {
                    "description": string,"icon": string,"name": string,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "description": string,"icon"?: string,"name": string,"slug": string
                  }
                  Update: {
                    "description"?: string,"icon"?: string,"name"?: string,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"bans": {
                  Row: {
                    "created_at": string,"created_by": string | null,"player_id": string,"reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"player_id": string,"reason"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"player_id"?: string,"reason"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "bans_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "player_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bans_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bans_player_id_fkey"
      columns: ["player_id"]
isOneToOne: true
      referencedRelation: "player_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bans_player_id_fkey"
      columns: ["player_id"]
isOneToOne: true
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"blocked_words": {
                  Row: {
                    "created_at": string,"word": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"word": string
                  }
                  Update: {
                    "created_at"?: string,"word"?: string
                  }
                  Relationships: [
                    
                  ]
                },"channel_reads": {
                  Row: {
                    "channel_id": string,"last_read_at": string,"player_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channel_id": string,"last_read_at"?: string,"player_id": string
                  }
                  Update: {
                    "channel_id"?: string,"last_read_at"?: string,"player_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "channel_reads_channel_id_fkey"
      columns: ["channel_id"]
isOneToOne: false
      referencedRelation: "channels"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "channel_reads_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "channel_reads_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"channel_settings": {
                  Row: {
                    "channel_id": string,"mode": string,"player_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channel_id": string,"mode"?: string,"player_id": string
                  }
                  Update: {
                    "channel_id"?: string,"mode"?: string,"player_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "channel_settings_channel_id_fkey"
      columns: ["channel_id"]
isOneToOne: false
      referencedRelation: "channels"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "channel_settings_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "channel_settings_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"channels": {
                  Row: {
                    "created_at": string,"id": string,"kind": string,"match_id": string | null,"name": string,"night_id": string | null,"rules": string | null,"season_id": string | null,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"kind": string,"match_id"?: string | null,"name": string,"night_id"?: string | null,"rules"?: string | null,"season_id"?: string | null,"slug": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"kind"?: string,"match_id"?: string | null,"name"?: string,"night_id"?: string | null,"rules"?: string | null,"season_id"?: string | null,"slug"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "channels_match_id_fkey"
      columns: ["match_id"]
isOneToOne: true
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "channels_night_id_fkey"
      columns: ["night_id"]
isOneToOne: false
      referencedRelation: "league_nights"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "channels_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    }
                  ]
                },"confirmations": {
                  Row: {
                    "created_at": string,"decision": string,"id": string,"match_id": string,"note": string | null,"player_id": string | null,"team_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"decision": string,"id"?: string,"match_id": string,"note"?: string | null,"player_id"?: string | null,"team_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"decision"?: string,"id"?: string,"match_id"?: string,"note"?: string | null,"player_id"?: string | null,"team_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "confirmations_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "confirmations_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "confirmations_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "confirmations_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_records"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "confirmations_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"disputes": {
                  Row: {
                    "created_at": string,"id": string,"match_id": string,"note": string | null,"opened_by": string | null,"resolution": string | null,"resolved_at": string | null,"resolved_by": string | null,"status": string,"team_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"match_id": string,"note"?: string | null,"opened_by"?: string | null,"resolution"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: string,"team_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"match_id"?: string,"note"?: string | null,"opened_by"?: string | null,"resolution"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: string,"team_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "disputes_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "disputes_opened_by_fkey"
      columns: ["opened_by"]
isOneToOne: false
      referencedRelation: "player_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "disputes_opened_by_fkey"
      columns: ["opened_by"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "disputes_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "player_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "disputes_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "disputes_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_records"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "disputes_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"dues": {
                  Row: {
                    "amount_cents": number,"id": string,"note": string | null,"paid": boolean,"paid_at": string | null,"player_id": string,"season_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents"?: number,"id"?: string,"note"?: string | null,"paid"?: boolean,"paid_at"?: string | null,"player_id": string,"season_id": string,"updated_at"?: string
                  }
                  Update: {
                    "amount_cents"?: number,"id"?: string,"note"?: string | null,"paid"?: boolean,"paid_at"?: string | null,"player_id"?: string,"season_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "dues_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dues_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dues_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "cover_url": string | null,"created_at": string,"created_by": string | null,"description": string | null,"ends_at": string | null,"id": string,"kind": string,"location": string | null,"reminder_sent_at": string | null,"rsvp_enabled": boolean,"season_id": string | null,"starts_at": string,"target_night_ids": (string)[],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cover_url"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"ends_at"?: string | null,"id"?: string,"kind"?: string,"location"?: string | null,"reminder_sent_at"?: string | null,"rsvp_enabled"?: boolean,"season_id"?: string | null,"starts_at": string,"target_night_ids"?: (string)[],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "cover_url"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"ends_at"?: string | null,"id"?: string,"kind"?: string,"location"?: string | null,"reminder_sent_at"?: string | null,"rsvp_enabled"?: boolean,"season_id"?: string | null,"starts_at"?: string,"target_night_ids"?: (string)[],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "player_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    }
                  ]
                },"faq_items": {
                  Row: {
                    "answer_md": string,"id": string,"question": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "answer_md": string,"id"?: string,"question": string,"sort_order"?: number
                  }
                  Update: {
                    "answer_md"?: string,"id"?: string,"question"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"frames": {
                  Row: {
                    "game_id": string,"hangers": number,"id": string,"number": number,"points": number,"recorded_at": string,"recorded_by": string | null,"scoring_team_id": string | null,"weights": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "game_id": string,"hangers"?: number,"id": string,"number": number,"points"?: number,"recorded_at"?: string,"recorded_by"?: string | null,"scoring_team_id"?: string | null,"weights"?: NonNullable<Json>
                  }
                  Update: {
                    "game_id"?: string,"hangers"?: number,"id"?: string,"number"?: number,"points"?: number,"recorded_at"?: string,"recorded_by"?: string | null,"scoring_team_id"?: string | null,"weights"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "frames_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "frames_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "player_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "frames_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "frames_scoring_team_id_fkey"
      columns: ["scoring_team_id"]
isOneToOne: false
      referencedRelation: "team_records"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "frames_scoring_team_id_fkey"
      columns: ["scoring_team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"games": {
                  Row: {
                    "away_lineup": NonNullable<Json>,"away_score": number,"ended_at": string | null,"frame_count": number,"home_lineup": NonNullable<Json>,"home_score": number,"id": string,"match_id": string,"number": number,"started_at": string | null,"status": string,"winner_team_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "away_lineup"?: NonNullable<Json>,"away_score"?: number,"ended_at"?: string | null,"frame_count"?: number,"home_lineup"?: NonNullable<Json>,"home_score"?: number,"id"?: string,"match_id": string,"number": number,"started_at"?: string | null,"status"?: string,"winner_team_id"?: string | null
                  }
                  Update: {
                    "away_lineup"?: NonNullable<Json>,"away_score"?: number,"ended_at"?: string | null,"frame_count"?: number,"home_lineup"?: NonNullable<Json>,"home_score"?: number,"id"?: string,"match_id"?: string,"number"?: number,"started_at"?: string | null,"status"?: string,"winner_team_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "games_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "games_winner_team_id_fkey"
      columns: ["winner_team_id"]
isOneToOne: false
      referencedRelation: "team_records"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "games_winner_team_id_fkey"
      columns: ["winner_team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"import_jobs": {
                  Row: {
                    "created_at": string,"created_by": string | null,"dry_run": boolean,"file_name": string | null,"id": string,"kind": string,"mapping": NonNullable<Json>,"summary": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"dry_run"?: boolean,"file_name"?: string | null,"id"?: string,"kind": string,"mapping"?: NonNullable<Json>,"summary"?: NonNullable<Json>
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"dry_run"?: boolean,"file_name"?: string | null,"id"?: string,"kind"?: string,"mapping"?: NonNullable<Json>,"summary"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "import_jobs_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "player_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "import_jobs_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"league_nights": {
                  Row: {
                    "id": string,"name": string,"season_id": string,"slot_times": (string)[],"slug": string,"sort_order": number,"start_time": string,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"name": string,"season_id": string,"slot_times"?: (string)[],"slug": string,"sort_order"?: number,"start_time"?: string,"weekday": number
                  }
                  Update: {
                    "id"?: string,"name"?: string,"season_id"?: string,"slot_times"?: (string)[],"slug"?: string,"sort_order"?: number,"start_time"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "league_nights_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    }
                  ]
                },"matches": {
                  Row: {
                    "auto_confirm_at": string | null,"away_games": number,"away_points": number,"away_team_id": string | null,"bracket_id": string | null,"confirmed_at": string | null,"confirmed_by": string | null,"created_at": string,"current_game": number,"entry_mode": string | null,"forfeit_team_id": string | null,"home_games": number,"home_points": number,"home_team_id": string | null,"id": string,"is_makeup": boolean,"night_id": string,"notes": string | null,"playoff_round": number | null,"postponed_from": string | null,"scheduled_at": string,"scorekeeper_player_id": string | null,"season_id": string,"slot_index": number,"status": string,"submitted_at": string | null,"submitted_by": string | null,"submitting_team_id": string | null,"table_id": string | null,"updated_at": string,"version": number,"week_id": string,"winner_team_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "auto_confirm_at"?: string | null,"away_games"?: number,"away_points"?: number,"away_team_id"?: string | null,"bracket_id"?: string | null,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"current_game"?: number,"entry_mode"?: string | null,"forfeit_team_id"?: string | null,"home_games"?: number,"home_points"?: number,"home_team_id"?: string | null,"id"?: string,"is_makeup"?: boolean,"night_id": string,"notes"?: string | null,"playoff_round"?: number | null,"postponed_from"?: string | null,"scheduled_at": string,"scorekeeper_player_id"?: string | null,"season_id": string,"slot_index"?: number,"status"?: string,"submitted_at"?: string | null,"submitted_by"?: string | null,"submitting_team_id"?: string | null,"table_id"?: string | null,"updated_at"?: string,"version"?: number,"week_id": string,"winner_team_id"?: string | null
                  }
                  Update: {
                    "auto_confirm_at"?: string | null,"away_games"?: number,"away_points"?: number,"away_team_id"?: string | null,"bracket_id"?: string | null,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"current_game"?: number,"entry_mode"?: string | null,"forfeit_team_id"?: string | null,"home_games"?: number,"home_points"?: number,"home_team_id"?: string | null,"id"?: string,"is_makeup"?: boolean,"night_id"?: string,"notes"?: string | null,"playoff_round"?: number | null,"postponed_from"?: string | null,"scheduled_at"?: string,"scorekeeper_player_id"?: string | null,"season_id"?: string,"slot_index"?: number,"status"?: string,"submitted_at"?: string | null,"submitted_by"?: string | null,"submitting_team_id"?: string | null,"table_id"?: string | null,"updated_at"?: string,"version"?: number,"week_id"?: string,"winner_team_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "matches_away_team_id_fkey"
      columns: ["away_team_id"]
isOneToOne: false
      referencedRelation: "team_records"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "matches_away_team_id_fkey"
      columns: ["away_team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_bracket_fk"
      columns: ["bracket_id"]
isOneToOne: false
      referencedRelation: "playoff_brackets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_confirmed_by_fkey"
      columns: ["confirmed_by"]
isOneToOne: false
      referencedRelation: "player_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_confirmed_by_fkey"
      columns: ["confirmed_by"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_forfeit_team_id_fkey"
      columns: ["forfeit_team_id"]
isOneToOne: false
      referencedRelation: "team_records"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "matches_forfeit_team_id_fkey"
      columns: ["forfeit_team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_home_team_id_fkey"
      columns: ["home_team_id"]
isOneToOne: false
      referencedRelation: "team_records"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "matches_home_team_id_fkey"
      columns: ["home_team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_night_id_fkey"
      columns: ["night_id"]
isOneToOne: false
      referencedRelation: "league_nights"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_scorekeeper_player_id_fkey"
      columns: ["scorekeeper_player_id"]
isOneToOne: false
      referencedRelation: "player_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_scorekeeper_player_id_fkey"
      columns: ["scorekeeper_player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_submitted_by_fkey"
      columns: ["submitted_by"]
isOneToOne: false
      referencedRelation: "player_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_submitted_by_fkey"
      columns: ["submitted_by"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_submitting_team_id_fkey"
      columns: ["submitting_team_id"]
isOneToOne: false
      referencedRelation: "team_records"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "matches_submitting_team_id_fkey"
      columns: ["submitting_team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_table_id_fkey"
      columns: ["table_id"]
isOneToOne: false
      referencedRelation: "tables"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_week_id_fkey"
      columns: ["week_id"]
isOneToOne: false
      referencedRelation: "weeks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_winner_team_id_fkey"
      columns: ["winner_team_id"]
isOneToOne: false
      referencedRelation: "team_records"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "matches_winner_team_id_fkey"
      columns: ["winner_team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"message_reports": {
                  Row: {
                    "created_at": string,"id": string,"message_id": string,"reason": string | null,"reporter_id": string,"resolved_by": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"message_id": string,"reason"?: string | null,"reporter_id": string,"resolved_by"?: string | null,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"message_id"?: string,"reason"?: string | null,"reporter_id"?: string,"resolved_by"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "message_reports_message_id_fkey"
      columns: ["message_id"]
isOneToOne: false
      referencedRelation: "messages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "message_reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "player_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "message_reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "message_reports_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "player_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "message_reports_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "author_id": string | null,"body": string,"channel_id": string,"client_id": string | null,"created_at": string,"deleted_at": string | null,"deleted_by": string | null,"edited_at": string | null,"gif_url": string | null,"id": string,"is_bot": boolean,"mentions": (string)[],"photo_url": string | null,"reply_to": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"body"?: string,"channel_id": string,"client_id"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"deleted_by"?: string | null,"edited_at"?: string | null,"gif_url"?: string | null,"id"?: string,"is_bot"?: boolean,"mentions"?: (string)[],"photo_url"?: string | null,"reply_to"?: string | null
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: string,"channel_id"?: string,"client_id"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"deleted_by"?: string | null,"edited_at"?: string | null,"gif_url"?: string | null,"id"?: string,"is_bot"?: boolean,"mentions"?: (string)[],"photo_url"?: string | null,"reply_to"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "player_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_channel_id_fkey"
      columns: ["channel_id"]
isOneToOne: false
      referencedRelation: "channels"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_deleted_by_fkey"
      columns: ["deleted_by"]
isOneToOne: false
      referencedRelation: "player_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_deleted_by_fkey"
      columns: ["deleted_by"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_reply_to_fkey"
      columns: ["reply_to"]
isOneToOne: false
      referencedRelation: "messages"
      referencedColumns: ["id"]
    }
                  ]
                },"mutes": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"player_id": string,"reason": string | null,"until": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"player_id": string,"reason"?: string | null,"until": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"player_id"?: string,"reason"?: string | null,"until"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mutes_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "player_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mutes_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mutes_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mutes_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_prefs": {
                  Row: {
                    "announcements": boolean,"chat": boolean,"events": boolean,"mentions": boolean,"player_id": string,"schedule": boolean,"scores": boolean,"subs": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "announcements"?: boolean,"chat"?: boolean,"events"?: boolean,"mentions"?: boolean,"player_id": string,"schedule"?: boolean,"scores"?: boolean,"subs"?: boolean
                  }
                  Update: {
                    "announcements"?: boolean,"chat"?: boolean,"events"?: boolean,"mentions"?: boolean,"player_id"?: string,"schedule"?: boolean,"scores"?: boolean,"subs"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_prefs_player_id_fkey"
      columns: ["player_id"]
isOneToOne: true
      referencedRelation: "player_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_prefs_player_id_fkey"
      columns: ["player_id"]
isOneToOne: true
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"created_at": string,"data": NonNullable<Json>,"id": string,"player_id": string,"pushed_at": string | null,"read_at": string | null,"title": string,"type": string,"url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: string,"player_id": string,"pushed_at"?: string | null,"read_at"?: string | null,"title": string,"type": string,"url"?: string | null
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: string,"player_id"?: string,"pushed_at"?: string | null,"read_at"?: string | null,"title"?: string,"type"?: string,"url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"player_badges": {
                  Row: {
                    "awarded_at": string,"badge_slug": string,"id": string,"match_id": string | null,"player_id": string,"season_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "awarded_at"?: string,"badge_slug": string,"id"?: string,"match_id"?: string | null,"player_id": string,"season_id"?: string | null
                  }
                  Update: {
                    "awarded_at"?: string,"badge_slug"?: string,"id"?: string,"match_id"?: string | null,"player_id"?: string,"season_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "player_badges_badge_slug_fkey"
      columns: ["badge_slug"]
isOneToOne: false
      referencedRelation: "badges"
      referencedColumns: ["slug"]
    },{
      foreignKeyName: "player_badges_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_badges_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_badges_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_badges_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    }
                  ]
                },"players": {
                  Row: {
                    "avatar_url": string | null,"bio": string | null,"created_at": string,"deleted_at": string | null,"display_name": string,"email": string | null,"id": string,"is_admin": boolean,"nickname": string | null,"onboarded_at": string | null,"phone": string | null,"theme": string,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"bio"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"display_name": string,"email"?: string | null,"id"?: string,"is_admin"?: boolean,"nickname"?: string | null,"onboarded_at"?: string | null,"phone"?: string | null,"theme"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "avatar_url"?: string | null,"bio"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"display_name"?: string,"email"?: string | null,"id"?: string,"is_admin"?: boolean,"nickname"?: string | null,"onboarded_at"?: string | null,"phone"?: string | null,"theme"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"playoff_brackets": {
                  Row: {
                    "champion_team_id": string | null,"created_at": string,"id": string,"kind": string,"name": string,"night_id": string | null,"season_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "champion_team_id"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string,"name": string,"night_id"?: string | null,"season_id": string,"status"?: string
                  }
                  Update: {
                    "champion_team_id"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string,"name"?: string,"night_id"?: string | null,"season_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "playoff_brackets_champion_team_id_fkey"
      columns: ["champion_team_id"]
isOneToOne: false
      referencedRelation: "team_records"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "playoff_brackets_champion_team_id_fkey"
      columns: ["champion_team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "playoff_brackets_night_id_fkey"
      columns: ["night_id"]
isOneToOne: false
      referencedRelation: "league_nights"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "playoff_brackets_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    }
                  ]
                },"playoff_slots": {
                  Row: {
                    "bracket_id": string,"feeds_slot_id": string | null,"id": string,"match_id": string | null,"position": number,"round": number,"seed": number | null,"team_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bracket_id": string,"feeds_slot_id"?: string | null,"id"?: string,"match_id"?: string | null,"position": number,"round": number,"seed"?: number | null,"team_id"?: string | null
                  }
                  Update: {
                    "bracket_id"?: string,"feeds_slot_id"?: string | null,"id"?: string,"match_id"?: string | null,"position"?: number,"round"?: number,"seed"?: number | null,"team_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "playoff_slots_bracket_id_fkey"
      columns: ["bracket_id"]
isOneToOne: false
      referencedRelation: "playoff_brackets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "playoff_slots_feeds_slot_id_fkey"
      columns: ["feeds_slot_id"]
isOneToOne: false
      referencedRelation: "playoff_slots"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "playoff_slots_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "playoff_slots_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_records"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "playoff_slots_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"power_rankings": {
                  Row: {
                    "blurb": string,"created_at": string,"created_by": string | null,"id": string,"season_id": string,"team_id": string,"week_number": number
                  }
                  ComputedFields: never
                  Insert: {
                    "blurb": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"season_id": string,"team_id": string,"week_number": number
                  }
                  Update: {
                    "blurb"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"season_id"?: string,"team_id"?: string,"week_number"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "power_rankings_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "player_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "power_rankings_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "power_rankings_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "power_rankings_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_records"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "power_rankings_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"failures": number,"id": string,"last_used_at": string | null,"p256dh": string,"player_id": string,"user_agent": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"failures"?: number,"id"?: string,"last_used_at"?: string | null,"p256dh": string,"player_id": string,"user_agent"?: string | null
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"failures"?: number,"id"?: string,"last_used_at"?: string | null,"p256dh"?: string,"player_id"?: string,"user_agent"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_subscriptions_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "push_subscriptions_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"reactions": {
                  Row: {
                    "created_at": string,"emoji": string,"message_id": string,"player_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"emoji": string,"message_id": string,"player_id": string
                  }
                  Update: {
                    "created_at"?: string,"emoji"?: string,"message_id"?: string,"player_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reactions_message_id_fkey"
      columns: ["message_id"]
isOneToOne: false
      referencedRelation: "messages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reactions_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reactions_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"rsvps": {
                  Row: {
                    "event_id": string,"player_id": string,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "event_id": string,"player_id": string,"status": string,"updated_at"?: string
                  }
                  Update: {
                    "event_id"?: string,"player_id"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rsvps_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rsvps_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rsvps_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"rules_pages": {
                  Row: {
                    "body_md": string,"slug": string,"sort_order": number,"title": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body_md": string,"slug": string,"sort_order"?: number,"title": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "body_md"?: string,"slug"?: string,"sort_order"?: number,"title"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "rules_pages_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "player_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rules_pages_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"score_submissions": {
                  Row: {
                    "created_at": string,"id": string,"idempotency_key": string,"match_id": string,"payload": NonNullable<Json>,"submitted_by": string | null,"team_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"idempotency_key": string,"match_id": string,"payload": NonNullable<Json>,"submitted_by"?: string | null,"team_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"idempotency_key"?: string,"match_id"?: string,"payload"?: NonNullable<Json>,"submitted_by"?: string | null,"team_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "score_submissions_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "score_submissions_submitted_by_fkey"
      columns: ["submitted_by"]
isOneToOne: false
      referencedRelation: "player_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "score_submissions_submitted_by_fkey"
      columns: ["submitted_by"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "score_submissions_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_records"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "score_submissions_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"seasons": {
                  Row: {
                    "archived_at": string | null,"auto_confirm_hours": number,"created_at": string,"format": NonNullable<Json>,"id": string,"name": string,"notes": string | null,"playoff_config": NonNullable<Json>,"playoff_weeks": number,"regular_weeks": number,"slug": string,"starts_on": string,"status": string,"tiebreakers": (string)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"auto_confirm_hours"?: number,"created_at"?: string,"format"?: NonNullable<Json>,"id"?: string,"name": string,"notes"?: string | null,"playoff_config"?: NonNullable<Json>,"playoff_weeks"?: number,"regular_weeks"?: number,"slug": string,"starts_on": string,"status"?: string,"tiebreakers"?: (string)[]
                  }
                  Update: {
                    "archived_at"?: string | null,"auto_confirm_hours"?: number,"created_at"?: string,"format"?: NonNullable<Json>,"id"?: string,"name"?: string,"notes"?: string | null,"playoff_config"?: NonNullable<Json>,"playoff_weeks"?: number,"regular_weeks"?: number,"slug"?: string,"starts_on"?: string,"status"?: string,"tiebreakers"?: (string)[]
                  }
                  Relationships: [
                    
                  ]
                },"settings": {
                  Row: {
                    "is_public": boolean,"key": string,"updated_at": string,"updated_by": string | null,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "is_public"?: boolean,"key": string,"updated_at"?: string,"updated_by"?: string | null,"value": NonNullable<Json>
                  }
                  Update: {
                    "is_public"?: boolean,"key"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"sub_availability": {
                  Row: {
                    "player_id": string,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "player_id": string,"weekday": number
                  }
                  Update: {
                    "player_id"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "sub_availability_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sub_availability_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"sub_requests": {
                  Row: {
                    "claimed_at": string | null,"claimed_by": string | null,"confirmed_at": string | null,"created_at": string,"created_by": string | null,"id": string,"match_id": string | null,"needed_at": string,"night_id": string,"note": string | null,"status": string,"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "claimed_at"?: string | null,"claimed_by"?: string | null,"confirmed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"match_id"?: string | null,"needed_at": string,"night_id": string,"note"?: string | null,"status"?: string,"team_id": string
                  }
                  Update: {
                    "claimed_at"?: string | null,"claimed_by"?: string | null,"confirmed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"match_id"?: string | null,"needed_at"?: string,"night_id"?: string,"note"?: string | null,"status"?: string,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sub_requests_claimed_by_fkey"
      columns: ["claimed_by"]
isOneToOne: false
      referencedRelation: "player_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sub_requests_claimed_by_fkey"
      columns: ["claimed_by"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sub_requests_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "player_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sub_requests_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sub_requests_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sub_requests_night_id_fkey"
      columns: ["night_id"]
isOneToOne: false
      referencedRelation: "league_nights"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sub_requests_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_records"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "sub_requests_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"tables": {
                  Row: {
                    "active": boolean,"created_at": string,"id": string,"name": string,"qr_token": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"name": string,"qr_token"?: string,"sort_order"?: number
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"name"?: string,"qr_token"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"team_memberships": {
                  Row: {
                    "id": string,"joined_at": string,"player_id": string,"role": string,"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"joined_at"?: string,"player_id": string,"role"?: string,"team_id": string
                  }
                  Update: {
                    "id"?: string,"joined_at"?: string,"player_id"?: string,"role"?: string,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_memberships_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_memberships_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_memberships_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_records"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "team_memberships_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"team_secrets": {
                  Row: {
                    "join_code": string,"rotated_at": string,"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "join_code": string,"rotated_at"?: string,"team_id": string
                  }
                  Update: {
                    "join_code"?: string,"rotated_at"?: string,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_secrets_team_id_fkey"
      columns: ["team_id"]
isOneToOne: true
      referencedRelation: "team_records"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "team_secrets_team_id_fkey"
      columns: ["team_id"]
isOneToOne: true
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"teams": {
                  Row: {
                    "color": string,"created_at": string,"id": string,"name": string,"night_id": string,"season_id": string,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string,"created_at"?: string,"id"?: string,"name": string,"night_id": string,"season_id": string,"slug": string
                  }
                  Update: {
                    "color"?: string,"created_at"?: string,"id"?: string,"name"?: string,"night_id"?: string,"season_id"?: string,"slug"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "teams_night_id_fkey"
      columns: ["night_id"]
isOneToOne: false
      referencedRelation: "league_nights"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teams_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    }
                  ]
                },"weeks": {
                  Row: {
                    "id": string,"kind": string,"label": string | null,"number": number,"season_id": string,"starts_on": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"kind"?: string,"label"?: string | null,"number": number,"season_id": string,"starts_on": string
                  }
                  Update: {
                    "id"?: string,"kind"?: string,"label"?: string | null,"number"?: number,"season_id"?: string,"starts_on"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "weeks_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "player_profiles": {
                  Row: {
                    "avatar_url": string | null,"bio": string | null,"created_at": string | null,"display_name": string | null,"has_account": boolean | null,"id": string | null,"is_admin": boolean | null,"nickname": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "avatar_url"?: string | null,"bio"?: string | null,"created_at"?: string | null,"display_name"?: string | null,"has_account"?: never,"id"?: string | null,"is_admin"?: boolean | null,"nickname"?: string | null
                         }
                        Update: {
                           "avatar_url"?: string | null,"bio"?: string | null,"created_at"?: string | null,"display_name"?: string | null,"has_account"?: never,"id"?: string | null,"is_admin"?: boolean | null,"nickname"?: string | null
                         }
                        Relationships: [
                    
                  ]
                },"team_records": {
                  Row: {
                    "forfeits": number | null,"games_lost": number | null,"games_won": number | null,"losses": number | null,"name": string | null,"night_id": string | null,"points_against": number | null,"points_for": number | null,"season_id": string | null,"team_id": string | null,"wins": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "teams_night_id_fkey"
      columns: ["night_id"]
isOneToOne: false
      referencedRelation: "league_nights"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teams_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "admin_reset_match":
{ Args: { "p_match": string,"p_note"?: string }; Returns: Json
                           },
"assert_valid_game":
{ Args: { "p_away": number,"p_format": Json,"p_home": number,"p_label": string }; Returns: undefined
                           },
"auto_confirm_due":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"can_score_match":
{ Args: { "p_match": string }; Returns: boolean
                           },
"claim_roster_player":
{ Args: { "p_player": string }; Returns: undefined
                           },
"claim_sub_request":
{ Args: { "p_request": string }; Returns: Json
                           },
"confirm_match":
{ Args: { "p_match": string,"p_note"?: string }; Returns: Json
                           },
"confirm_sub_claim":
{ Args: { "p_accept": boolean,"p_request": string }; Returns: Json
                           },
"contains_blocked_word":
{ Args: { "p_text": string }; Returns: boolean
                           },
"current_player_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"delete_message":
{ Args: { "p_message": string }; Returns: undefined
                           },
"delete_my_account":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"dispute_match":
{ Args: { "p_match": string,"p_note": string }; Returns: Json
                           },
"edit_message":
{ Args: { "p_body": string,"p_message": string }; Returns: undefined
                           },
"game_is_over":
{ Args: { "p_away": number,"p_format": Json,"p_home": number }; Returns: boolean
                           },
"generate_join_code":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_banned":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_captain_of":
{ Args: { "p_team": string }; Returns: boolean
                           },
"is_member_of":
{ Args: { "p_team": string }; Returns: boolean
                           },
"is_muted":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"join_team_with_code":
{ Args: { "p_code": string }; Returns: string
                           },
"log_audit":
{ Args: { "p_action": string,"p_after": Json,"p_before": Json,"p_entity": string,"p_entity_id": string,"p_note"?: string }; Returns: undefined
                           },
"mark_channel_read":
{ Args: { "p_channel": string }; Returns: undefined
                           },
"match_format":
{ Args: { "p_match": string }; Returns: Json
                           },
"match_state":
{ Args: { "p_match": string }; Returns: Json
                           },
"post_message":
{ Args: { "p_body": string,"p_channel": string,"p_client_id"?: string,"p_gif_url"?: string,"p_photo_url"?: string,"p_reply_to"?: string }; Returns: Json
                           },
"postpone_match":
{ Args: { "p_match": string,"p_new_at"?: string,"p_note"?: string }; Returns: Json
                           },
"record_frame":
{ Args: { "p_frame_id": string,"p_game_number": number,"p_hangers": number,"p_match": string,"p_points": number,"p_scoring_team": string,"p_weights"?: Json }; Returns: Json
                           },
"resolve_dispute":
{ Args: { "p_action": string,"p_dispute": string,"p_games"?: Json,"p_resolution"?: string }; Returns: Json
                           },
"rotate_join_code":
{ Args: { "p_team": string }; Returns: string
                           },
"set_forfeit":
{ Args: { "p_forfeiting_team": string,"p_match": string,"p_note"?: string }; Returns: Json
                           },
"set_game_lineup":
{ Args: { "p_away": Json,"p_game_number": number,"p_home": Json,"p_match": string }; Returns: undefined
                           },
"set_scorekeeper":
{ Args: { "p_match": string,"p_player": string }; Returns: undefined
                           },
"start_match":
{ Args: { "p_match": string }; Returns: Json
                           },
"submit_match_result":
{ Args: { "p_entry_mode": string,"p_games": Json,"p_idempotency_key": string,"p_match": string,"p_note"?: string }; Returns: Json
                           },
"team_week_conflicts":
{ Args: { "p_team": string,"p_week": string }; Returns: boolean
                           },
"toggle_reaction":
{ Args: { "p_emoji": string,"p_message": string }; Returns: boolean
                           },
"undo_frame":
{ Args: { "p_match": string }; Returns: Json
                           },
"unread_counts":
{ Args: Record<PropertyKey, never>; Returns: {
              "channel_id": string,"unread": number
            }[]
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
