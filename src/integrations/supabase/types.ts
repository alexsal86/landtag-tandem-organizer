export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      admin_status_options: {
        Row: {
          color: string
          created_at: string
          emoji: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color: string
          created_at?: string
          emoji?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          emoji?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          id: string
          setting_key: string
          setting_value: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          setting_key: string
          setting_value?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      appointment_categories: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          label: string
          name: string
          order_index: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          name: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          name?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: []
      }
      appointment_contacts: {
        Row: {
          appointment_id: string
          contact_id: string
          created_at: string
          id: string
          role: string | null
        }
        Insert: {
          appointment_id: string
          contact_id: string
          created_at?: string
          id?: string
          role?: string | null
        }
        Update: {
          appointment_id?: string
          contact_id?: string
          created_at?: string
          id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_contacts_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_appointment_contacts_contact_id"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_documents: {
        Row: {
          appointment_id: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_documents_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_feedback: {
        Row: {
          appointment_id: string | null
          completed_at: string | null
          created_at: string | null
          event_type: string
          external_event_id: string | null
          feedback_status: string
          has_documents: boolean | null
          has_tasks: boolean | null
          id: string
          notes: string | null
          priority_score: number | null
          reminder_dismissed: boolean | null
          reminder_dismissed_at: string | null
          tenant_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          appointment_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          event_type?: string
          external_event_id?: string | null
          feedback_status?: string
          has_documents?: boolean | null
          has_tasks?: boolean | null
          id?: string
          notes?: string | null
          priority_score?: number | null
          reminder_dismissed?: boolean | null
          reminder_dismissed_at?: string | null
          tenant_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          appointment_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          event_type?: string
          external_event_id?: string | null
          feedback_status?: string
          has_documents?: boolean | null
          has_tasks?: boolean | null
          id?: string
          notes?: string | null
          priority_score?: number | null
          reminder_dismissed?: boolean | null
          reminder_dismissed_at?: string | null
          tenant_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_feedback_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_feedback_external_event_id_fkey"
            columns: ["external_event_id"]
            isOneToOne: true
            referencedRelation: "external_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_feedback_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_feedback_settings: {
        Row: {
          auto_skip_internal: boolean | null
          created_at: string | null
          id: string
          priority_categories: string[] | null
          reminder_start_time: string | null
          show_all_appointments: boolean | null
          tenant_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_skip_internal?: boolean | null
          created_at?: string | null
          id?: string
          priority_categories?: string[] | null
          reminder_start_time?: string | null
          show_all_appointments?: boolean | null
          tenant_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_skip_internal?: boolean | null
          created_at?: string | null
          id?: string
          priority_categories?: string[] | null
          reminder_start_time?: string | null
          show_all_appointments?: boolean | null
          tenant_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_feedback_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_guests: {
        Row: {
          appointment_id: string
          created_at: string
          email: string
          id: string
          invitation_token: string | null
          invited_at: string | null
          name: string
          responded_at: string | null
          response_note: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          email: string
          id?: string
          invitation_token?: string | null
          invited_at?: string | null
          name: string
          responded_at?: string | null
          response_note?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          email?: string
          id?: string
          invitation_token?: string | null
          invited_at?: string | null
          name?: string
          responded_at?: string | null
          response_note?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      appointment_locations: {
        Row: {
          address: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          order_index: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: []
      }
      appointment_polls: {
        Row: {
          created_at: string
          current_version: number | null
          deadline: string | null
          description: string | null
          id: string
          status: string
          tenant_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_version?: number | null
          deadline?: string | null
          description?: string | null
          id?: string
          status?: string
          tenant_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_version?: number | null
          deadline?: string | null
          description?: string | null
          id?: string
          status?: string
          tenant_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_polls_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_preparation_documents: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          preparation_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          preparation_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          preparation_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_appointment_preparation_documents_preparation"
            columns: ["preparation_id"]
            isOneToOne: false
            referencedRelation: "appointment_preparations"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_preparation_templates: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          template_data: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          template_data?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          template_data?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_appointment_preparation_templates_tenant"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_preparations: {
        Row: {
          appointment_id: string
          archived_at: string | null
          checklist_items: Json
          created_at: string
          created_by: string
          id: string
          is_archived: boolean
          notes: string | null
          preparation_data: Json
          status: string
          template_id: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          appointment_id: string
          archived_at?: string | null
          checklist_items?: Json
          created_at?: string
          created_by: string
          id?: string
          is_archived?: boolean
          notes?: string | null
          preparation_data?: Json
          status?: string
          template_id?: string | null
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          archived_at?: string | null
          checklist_items?: Json
          created_at?: string
          created_by?: string
          id?: string
          is_archived?: boolean
          notes?: string | null
          preparation_data?: Json
          status?: string
          template_id?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_appointment_preparations_appointment"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_appointment_preparations_template"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "appointment_preparation_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_appointment_preparations_tenant"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_statuses: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          name: string
          order_index: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          name: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          name?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          calendar_uid: string | null
          call_log_id: string | null
          category: string | null
          contact_id: string | null
          coordinates: Json | null
          created_at: string
          description: string | null
          district_id: string | null
          end_time: string
          has_external_guests: boolean | null
          id: string
          is_all_day: boolean
          last_invitation_sent_at: string | null
          location: string | null
          meeting_details: string | null
          meeting_id: string | null
          meeting_link: string | null
          party_association_id: string | null
          poll_id: string | null
          priority: string | null
          recurrence_end_date: string | null
          recurrence_rule: string | null
          reminder_minutes: number | null
          start_time: string
          status: string | null
          tenant_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          calendar_uid?: string | null
          call_log_id?: string | null
          category?: string | null
          contact_id?: string | null
          coordinates?: Json | null
          created_at?: string
          description?: string | null
          district_id?: string | null
          end_time: string
          has_external_guests?: boolean | null
          id?: string
          is_all_day?: boolean
          last_invitation_sent_at?: string | null
          location?: string | null
          meeting_details?: string | null
          meeting_id?: string | null
          meeting_link?: string | null
          party_association_id?: string | null
          poll_id?: string | null
          priority?: string | null
          recurrence_end_date?: string | null
          recurrence_rule?: string | null
          reminder_minutes?: number | null
          start_time: string
          status?: string | null
          tenant_id: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          calendar_uid?: string | null
          call_log_id?: string | null
          category?: string | null
          contact_id?: string | null
          coordinates?: Json | null
          created_at?: string
          description?: string | null
          district_id?: string | null
          end_time?: string
          has_external_guests?: boolean | null
          id?: string
          is_all_day?: boolean
          last_invitation_sent_at?: string | null
          location?: string | null
          meeting_details?: string | null
          meeting_id?: string | null
          meeting_link?: string | null
          party_association_id?: string | null
          poll_id?: string | null
          priority?: string | null
          recurrence_end_date?: string | null
          recurrence_rule?: string | null
          reminder_minutes?: number | null
          start_time?: string
          status?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_call_log_id_fkey"
            columns: ["call_log_id"]
            isOneToOne: false
            referencedRelation: "call_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "election_districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_meeting_fk"
            columns: ["meeting_id"]
            isOneToOne: true
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_party_association_id_fkey"
            columns: ["party_association_id"]
            isOneToOne: false
            referencedRelation: "party_associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "appointment_polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      archived_tasks: {
        Row: {
          archived_at: string
          assigned_to: string | null
          auto_delete_after_days: number | null
          category: string
          completed_at: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          priority: string
          progress: number | null
          task_id: string
          title: string
          user_id: string
        }
        Insert: {
          archived_at?: string
          assigned_to?: string | null
          auto_delete_after_days?: number | null
          category: string
          completed_at?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority: string
          progress?: number | null
          task_id: string
          title: string
          user_id: string
        }
        Update: {
          archived_at?: string
          assigned_to?: string | null
          auto_delete_after_days?: number | null
          category?: string
          completed_at?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          progress?: number | null
          task_id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_log_entries: {
        Row: {
          created_at: string
          id: string
          ip_address: string | null
          payload: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: string | null
          payload?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string | null
          payload?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      calendar_sync_settings: {
        Row: {
          created_at: string | null
          id: string
          is_enabled: boolean
          sync_interval_hours: number
          sync_time: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_enabled?: boolean
          sync_interval_hours?: number
          sync_time?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_enabled?: boolean
          sync_interval_hours?: number
          sync_time?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_sync_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      call_logs: {
        Row: {
          call_date: string
          call_type: string | null
          caller_name: string | null
          caller_phone: string | null
          completion_notes: string | null
          contact_id: string | null
          created_at: string
          created_by_name: string | null
          duration_minutes: number | null
          follow_up_completed: boolean | null
          follow_up_date: string | null
          follow_up_required: boolean | null
          id: string
          notes: string | null
          priority: string | null
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          call_date?: string
          call_type?: string | null
          caller_name?: string | null
          caller_phone?: string | null
          completion_notes?: string | null
          contact_id?: string | null
          created_at?: string
          created_by_name?: string | null
          duration_minutes?: number | null
          follow_up_completed?: boolean | null
          follow_up_date?: string | null
          follow_up_required?: boolean | null
          id?: string
          notes?: string | null
          priority?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          call_date?: string
          call_type?: string | null
          caller_name?: string | null
          caller_phone?: string | null
          completion_notes?: string | null
          contact_id?: string | null
          created_at?: string
          created_by_name?: string | null
          duration_minutes?: number | null
          follow_up_completed?: boolean | null
          follow_up_date?: string | null
          follow_up_required?: boolean | null
          id?: string
          notes?: string | null
          priority?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      carryover_items: {
        Row: {
          assigned_to: string[] | null
          created_at: string
          description: string | null
          id: string
          notes: string | null
          order_index: number
          original_meeting_date: string | null
          original_meeting_id: string | null
          original_meeting_title: string | null
          result_text: string | null
          sub_items: Json | null
          template_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          assigned_to?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          order_index?: number
          original_meeting_date?: string | null
          original_meeting_id?: string | null
          original_meeting_title?: string | null
          result_text?: string | null
          sub_items?: Json | null
          template_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          assigned_to?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          order_index?: number
          original_meeting_date?: string | null
          original_meeting_id?: string | null
          original_meeting_title?: string | null
          result_text?: string | null
          sub_items?: Json | null
          template_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      case_file_appointments: {
        Row: {
          appointment_id: string
          case_file_id: string
          created_at: string
          id: string
          notes: string | null
        }
        Insert: {
          appointment_id: string
          case_file_id: string
          created_at?: string
          id?: string
          notes?: string | null
        }
        Update: {
          appointment_id?: string
          case_file_id?: string
          created_at?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_file_appointments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_file_appointments_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "case_files"
            referencedColumns: ["id"]
          },
        ]
      }
      case_file_contacts: {
        Row: {
          case_file_id: string
          contact_id: string
          created_at: string
          id: string
          notes: string | null
          role: string | null
        }
        Insert: {
          case_file_id: string
          contact_id: string
          created_at?: string
          id?: string
          notes?: string | null
          role?: string | null
        }
        Update: {
          case_file_id?: string
          contact_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_file_contacts_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "case_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_file_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      case_file_documents: {
        Row: {
          case_file_id: string
          created_at: string
          document_id: string
          id: string
          notes: string | null
          relevance: string | null
        }
        Insert: {
          case_file_id: string
          created_at?: string
          document_id: string
          id?: string
          notes?: string | null
          relevance?: string | null
        }
        Update: {
          case_file_id?: string
          created_at?: string
          document_id?: string
          id?: string
          notes?: string | null
          relevance?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_file_documents_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "case_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_file_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      case_file_letters: {
        Row: {
          case_file_id: string
          created_at: string
          id: string
          letter_id: string
          notes: string | null
        }
        Insert: {
          case_file_id: string
          created_at?: string
          id?: string
          letter_id: string
          notes?: string | null
        }
        Update: {
          case_file_id?: string
          created_at?: string
          id?: string
          letter_id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_file_letters_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "case_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_file_letters_letter_id_fkey"
            columns: ["letter_id"]
            isOneToOne: false
            referencedRelation: "letters"
            referencedColumns: ["id"]
          },
        ]
      }
      case_file_notes: {
        Row: {
          case_file_id: string
          content: string
          created_at: string
          id: string
          is_pinned: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          case_file_id: string
          content: string
          created_at?: string
          id?: string
          is_pinned?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          case_file_id?: string
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_file_notes_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "case_files"
            referencedColumns: ["id"]
          },
        ]
      }
      case_file_tasks: {
        Row: {
          case_file_id: string
          created_at: string
          id: string
          notes: string | null
          task_id: string
        }
        Insert: {
          case_file_id: string
          created_at?: string
          id?: string
          notes?: string | null
          task_id: string
        }
        Update: {
          case_file_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_file_tasks_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "case_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_file_tasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      case_file_timeline: {
        Row: {
          case_file_id: string
          created_at: string
          created_by: string | null
          description: string | null
          event_date: string
          event_type: string | null
          id: string
          source_id: string | null
          source_type: string | null
          title: string
        }
        Insert: {
          case_file_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date: string
          event_type?: string | null
          id?: string
          source_id?: string | null
          source_type?: string | null
          title: string
        }
        Update: {
          case_file_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date?: string
          event_type?: string | null
          id?: string
          source_id?: string | null
          source_type?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_file_timeline_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "case_files"
            referencedColumns: ["id"]
          },
        ]
      }
      case_files: {
        Row: {
          case_type: string
          created_at: string
          description: string | null
          id: string
          is_private: boolean | null
          priority: string | null
          reference_number: string | null
          start_date: string | null
          status: string
          tags: string[] | null
          target_date: string | null
          tenant_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          case_type?: string
          created_at?: string
          description?: string | null
          id?: string
          is_private?: boolean | null
          priority?: string | null
          reference_number?: string | null
          start_date?: string | null
          status?: string
          tags?: string[] | null
          target_date?: string | null
          tenant_id: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          case_type?: string
          created_at?: string
          description?: string | null
          id?: string
          is_private?: boolean | null
          priority?: string | null
          reference_number?: string | null
          start_date?: string | null
          status?: string
          tags?: string[] | null
          target_date?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_files_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_activities: {
        Row: {
          activity_type: string
          contact_id: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          metadata: Json | null
          tenant_id: string
          title: string
        }
        Insert: {
          activity_type: string
          contact_id: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          metadata?: Json | null
          tenant_id: string
          title: string
        }
        Update: {
          activity_type?: string
          contact_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_usage_stats: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          last_used_at: string
          tenant_id: string
          updated_at: string
          usage_count: number
          user_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          last_used_at?: string
          tenant_id: string
          updated_at?: string
          usage_count?: number
          user_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          last_used_at?: string
          tenant_id?: string
          updated_at?: string
          usage_count?: number
          user_id?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          accessibility_features: string[] | null
          additional_info: string | null
          address: string | null
          annual_revenue: string | null
          avatar_url: string | null
          awards_recognitions: string[] | null
          bank_account_number: string | null
          bank_name: string | null
          bank_routing_number: string | null
          bic_swift: string | null
          billing_address: string | null
          birthday: string | null
          business_city: string | null
          business_country: string | null
          business_description: string | null
          business_house_number: string | null
          business_phone: string | null
          business_phone_2: string | null
          business_postal_code: string | null
          business_street: string | null
          category: string | null
          certifications: string[] | null
          commercial_register_number: string | null
          company: string | null
          company_size: string | null
          compliance_notes: string | null
          contact_type: string | null
          contract_end_date: string | null
          contract_start_date: string | null
          contract_type: string | null
          coordinates: Json | null
          created_at: string
          credit_limit: number | null
          customer_number: string | null
          data_protection_notes: string | null
          department: string | null
          diversity_certifications: string[] | null
          email: string | null
          email_2: string | null
          email_3: string | null
          employees_count: number | null
          established_year: number | null
          facebook: string | null
          first_name: string | null
          founding_date: string | null
          gdpr_consent_date: string | null
          geocoded_at: string | null
          geocoding_source: string | null
          iban: string | null
          id: string
          industry: string | null
          instagram: string | null
          is_favorite: boolean | null
          key_contacts: string[] | null
          languages_supported: string[] | null
          last_contact: string | null
          last_name: string | null
          legal_form: string | null
          linkedin: string | null
          location: string | null
          main_contact_person: string | null
          marketing_consent: boolean | null
          meeting_preferences: string | null
          mobile_phone: string | null
          name: string
          newsletter_subscription: boolean | null
          notes: string | null
          organization: string | null
          organization_id: string | null
          parent_company: string | null
          partnership_level: string | null
          payment_terms: string | null
          phone: string | null
          position: string | null
          preferred_communication_method: string | null
          priority: string | null
          private_city: string | null
          private_country: string | null
          private_house_number: string | null
          private_phone: string | null
          private_phone_2: string | null
          private_postal_code: string | null
          private_street: string | null
          rating: string | null
          role: string | null
          service_areas: string[] | null
          shipping_address: string | null
          social_media_accounts: Json | null
          specializations: string[] | null
          subsidiaries: string[] | null
          supplier_number: string | null
          sustainability_practices: string | null
          tags: string[] | null
          tax_number: string | null
          tenant_id: string
          time_zone: string | null
          title: string | null
          trade_associations: string[] | null
          twitter: string | null
          updated_at: string
          user_id: string
          vat_number: string | null
          website: string | null
          xing: string | null
        }
        Insert: {
          accessibility_features?: string[] | null
          additional_info?: string | null
          address?: string | null
          annual_revenue?: string | null
          avatar_url?: string | null
          awards_recognitions?: string[] | null
          bank_account_number?: string | null
          bank_name?: string | null
          bank_routing_number?: string | null
          bic_swift?: string | null
          billing_address?: string | null
          birthday?: string | null
          business_city?: string | null
          business_country?: string | null
          business_description?: string | null
          business_house_number?: string | null
          business_phone?: string | null
          business_phone_2?: string | null
          business_postal_code?: string | null
          business_street?: string | null
          category?: string | null
          certifications?: string[] | null
          commercial_register_number?: string | null
          company?: string | null
          company_size?: string | null
          compliance_notes?: string | null
          contact_type?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          contract_type?: string | null
          coordinates?: Json | null
          created_at?: string
          credit_limit?: number | null
          customer_number?: string | null
          data_protection_notes?: string | null
          department?: string | null
          diversity_certifications?: string[] | null
          email?: string | null
          email_2?: string | null
          email_3?: string | null
          employees_count?: number | null
          established_year?: number | null
          facebook?: string | null
          first_name?: string | null
          founding_date?: string | null
          gdpr_consent_date?: string | null
          geocoded_at?: string | null
          geocoding_source?: string | null
          iban?: string | null
          id?: string
          industry?: string | null
          instagram?: string | null
          is_favorite?: boolean | null
          key_contacts?: string[] | null
          languages_supported?: string[] | null
          last_contact?: string | null
          last_name?: string | null
          legal_form?: string | null
          linkedin?: string | null
          location?: string | null
          main_contact_person?: string | null
          marketing_consent?: boolean | null
          meeting_preferences?: string | null
          mobile_phone?: string | null
          name: string
          newsletter_subscription?: boolean | null
          notes?: string | null
          organization?: string | null
          organization_id?: string | null
          parent_company?: string | null
          partnership_level?: string | null
          payment_terms?: string | null
          phone?: string | null
          position?: string | null
          preferred_communication_method?: string | null
          priority?: string | null
          private_city?: string | null
          private_country?: string | null
          private_house_number?: string | null
          private_phone?: string | null
          private_phone_2?: string | null
          private_postal_code?: string | null
          private_street?: string | null
          rating?: string | null
          role?: string | null
          service_areas?: string[] | null
          shipping_address?: string | null
          social_media_accounts?: Json | null
          specializations?: string[] | null
          subsidiaries?: string[] | null
          supplier_number?: string | null
          sustainability_practices?: string | null
          tags?: string[] | null
          tax_number?: string | null
          tenant_id: string
          time_zone?: string | null
          title?: string | null
          trade_associations?: string[] | null
          twitter?: string | null
          updated_at?: string
          user_id: string
          vat_number?: string | null
          website?: string | null
          xing?: string | null
        }
        Update: {
          accessibility_features?: string[] | null
          additional_info?: string | null
          address?: string | null
          annual_revenue?: string | null
          avatar_url?: string | null
          awards_recognitions?: string[] | null
          bank_account_number?: string | null
          bank_name?: string | null
          bank_routing_number?: string | null
          bic_swift?: string | null
          billing_address?: string | null
          birthday?: string | null
          business_city?: string | null
          business_country?: string | null
          business_description?: string | null
          business_house_number?: string | null
          business_phone?: string | null
          business_phone_2?: string | null
          business_postal_code?: string | null
          business_street?: string | null
          category?: string | null
          certifications?: string[] | null
          commercial_register_number?: string | null
          company?: string | null
          company_size?: string | null
          compliance_notes?: string | null
          contact_type?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          contract_type?: string | null
          coordinates?: Json | null
          created_at?: string
          credit_limit?: number | null
          customer_number?: string | null
          data_protection_notes?: string | null
          department?: string | null
          diversity_certifications?: string[] | null
          email?: string | null
          email_2?: string | null
          email_3?: string | null
          employees_count?: number | null
          established_year?: number | null
          facebook?: string | null
          first_name?: string | null
          founding_date?: string | null
          gdpr_consent_date?: string | null
          geocoded_at?: string | null
          geocoding_source?: string | null
          iban?: string | null
          id?: string
          industry?: string | null
          instagram?: string | null
          is_favorite?: boolean | null
          key_contacts?: string[] | null
          languages_supported?: string[] | null
          last_contact?: string | null
          last_name?: string | null
          legal_form?: string | null
          linkedin?: string | null
          location?: string | null
          main_contact_person?: string | null
          marketing_consent?: boolean | null
          meeting_preferences?: string | null
          mobile_phone?: string | null
          name?: string
          newsletter_subscription?: boolean | null
          notes?: string | null
          organization?: string | null
          organization_id?: string | null
          parent_company?: string | null
          partnership_level?: string | null
          payment_terms?: string | null
          phone?: string | null
          position?: string | null
          preferred_communication_method?: string | null
          priority?: string | null
          private_city?: string | null
          private_country?: string | null
          private_house_number?: string | null
          private_phone?: string | null
          private_phone_2?: string | null
          private_postal_code?: string | null
          private_street?: string | null
          rating?: string | null
          role?: string | null
          service_areas?: string[] | null
          shipping_address?: string | null
          social_media_accounts?: Json | null
          specializations?: string[] | null
          subsidiaries?: string[] | null
          supplier_number?: string | null
          sustainability_practices?: string | null
          tags?: string[] | null
          tax_number?: string | null
          tenant_id?: string
          time_zone?: string | null
          title?: string | null
          trade_associations?: string[] | null
          twitter?: string | null
          updated_at?: string
          user_id?: string
          vat_number?: string | null
          website?: string | null
          xing?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_layouts: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          layout_data: Json
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          layout_data: Json
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          layout_data?: Json
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      decision_email_templates: {
        Row: {
          closing: string
          created_at: string
          greeting: string
          id: string
          instruction: string
          introduction: string
          question_prompt: string
          signature: string
          subject: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          closing?: string
          created_at?: string
          greeting?: string
          id?: string
          instruction?: string
          introduction?: string
          question_prompt?: string
          signature?: string
          subject?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          closing?: string
          created_at?: string
          greeting?: string
          id?: string
          instruction?: string
          introduction?: string
          question_prompt?: string
          signature?: string
          subject?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      decision_matrix_messages: {
        Row: {
          created_at: string | null
          decision_id: string | null
          id: string
          matrix_event_id: string
          matrix_room_id: string
          participant_id: string | null
          responded_via_matrix: boolean | null
          sent_at: string | null
        }
        Insert: {
          created_at?: string | null
          decision_id?: string | null
          id?: string
          matrix_event_id: string
          matrix_room_id: string
          participant_id?: string | null
          responded_via_matrix?: boolean | null
          sent_at?: string | null
        }
        Update: {
          created_at?: string | null
          decision_id?: string | null
          id?: string
          matrix_event_id?: string
          matrix_room_id?: string
          participant_id?: string | null
          responded_via_matrix?: boolean | null
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decision_matrix_messages_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "task_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_matrix_messages_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "task_decision_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      default_appointment_guests: {
        Row: {
          created_at: string
          created_by: string
          email: string
          id: string
          is_active: boolean
          name: string
          order_index: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          email: string
          id?: string
          is_active?: boolean
          name: string
          order_index?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          order_index?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      distribution_list_members: {
        Row: {
          added_at: string
          contact_id: string
          distribution_list_id: string
          id: string
        }
        Insert: {
          added_at?: string
          contact_id: string
          distribution_list_id: string
          id?: string
        }
        Update: {
          added_at?: string
          contact_id?: string
          distribution_list_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "distribution_list_members_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribution_list_members_distribution_list_id_fkey"
            columns: ["distribution_list_id"]
            isOneToOne: false
            referencedRelation: "distribution_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_lists: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          tenant_id: string | null
          topic: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          tenant_id?: string | null
          topic?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          tenant_id?: string | null
          topic?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "distribution_lists_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      district_support_assignments: {
        Row: {
          created_at: string | null
          created_by: string | null
          district_id: string
          id: string
          is_active: boolean | null
          notes: string | null
          priority: number | null
          supporting_representative_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          district_id: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          priority?: number | null
          supporting_representative_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          district_id?: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          priority?: number | null
          supporting_representative_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "district_support_assignments_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "election_districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "district_support_assignments_supporting_representative_id_fkey"
            columns: ["supporting_representative_id"]
            isOneToOne: false
            referencedRelation: "election_representatives"
            referencedColumns: ["id"]
          },
        ]
      }
      document_categories: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          label: string
          name: string
          order_index: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          label: string
          name: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          label?: string
          name?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: []
      }
      document_contacts: {
        Row: {
          contact_id: string
          created_at: string
          created_by: string
          document_id: string
          id: string
          notes: string | null
          relationship_type: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          created_by: string
          document_id: string
          id?: string
          notes?: string | null
          relationship_type?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          created_by?: string
          document_id?: string
          id?: string
          notes?: string | null
          relationship_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_contacts_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_folders: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          order_index: number | null
          parent_folder_id: string | null
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          order_index?: number | null
          parent_folder_id?: string | null
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          order_index?: number | null
          parent_folder_id?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_folders_parent_folder_id_fkey"
            columns: ["parent_folder_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          archived_attachments: Json | null
          category: string | null
          created_at: string
          description: string | null
          document_type: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          folder_id: string | null
          id: string
          source_letter_id: string | null
          status: string | null
          tags: string[] | null
          tenant_id: string
          title: string
          updated_at: string
          user_id: string
          workflow_history: Json | null
        }
        Insert: {
          archived_attachments?: Json | null
          category?: string | null
          created_at?: string
          description?: string | null
          document_type?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          folder_id?: string | null
          id?: string
          source_letter_id?: string | null
          status?: string | null
          tags?: string[] | null
          tenant_id: string
          title: string
          updated_at?: string
          user_id: string
          workflow_history?: Json | null
        }
        Update: {
          archived_attachments?: Json | null
          category?: string | null
          created_at?: string
          description?: string | null
          document_type?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          folder_id?: string | null
          id?: string
          source_letter_id?: string | null
          status?: string | null
          tags?: string[] | null
          tenant_id?: string
          title?: string
          updated_at?: string
          user_id?: string
          workflow_history?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      election_district_municipalities: {
        Row: {
          county: string | null
          created_at: string
          district_id: string
          id: string
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          county?: string | null
          created_at?: string
          district_id: string
          id?: string
          name: string
          type: string
          updated_at?: string
        }
        Update: {
          county?: string | null
          created_at?: string
          district_id?: string
          id?: string
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "election_district_municipalities_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "election_districts"
            referencedColumns: ["id"]
          },
        ]
      }
      election_district_notes: {
        Row: {
          category: string | null
          content: string | null
          created_at: string
          district_id: string
          due_date: string | null
          id: string
          is_completed: boolean
          priority: string
          tags: string[] | null
          tenant_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          content?: string | null
          created_at?: string
          district_id: string
          due_date?: string | null
          id?: string
          is_completed?: boolean
          priority?: string
          tags?: string[] | null
          tenant_id: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          content?: string | null
          created_at?: string
          district_id?: string
          due_date?: string | null
          id?: string
          is_completed?: boolean
          priority?: string
          tags?: string[] | null
          tenant_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "election_district_notes_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "election_districts"
            referencedColumns: ["id"]
          },
        ]
      }
      election_districts: {
        Row: {
          administrative_level: string | null
          area_km2: number | null
          boundaries: Json | null
          center_coordinates: Json | null
          contact_info: Json | null
          created_at: string
          district_name: string
          district_number: number
          district_type: string | null
          id: string
          major_cities: string[] | null
          population: number | null
          region: string
          rural_percentage: number | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          administrative_level?: string | null
          area_km2?: number | null
          boundaries?: Json | null
          center_coordinates?: Json | null
          contact_info?: Json | null
          created_at?: string
          district_name: string
          district_number: number
          district_type?: string | null
          id?: string
          major_cities?: string[] | null
          population?: number | null
          region?: string
          rural_percentage?: number | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          administrative_level?: string | null
          area_km2?: number | null
          boundaries?: Json | null
          center_coordinates?: Json | null
          contact_info?: Json | null
          created_at?: string
          district_name?: string
          district_number?: number
          district_type?: string | null
          id?: string
          major_cities?: string[] | null
          population?: number | null
          region?: string
          rural_percentage?: number | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      election_representatives: {
        Row: {
          bio: string | null
          created_at: string
          district_id: string | null
          email: string | null
          id: string
          mandate_type: string
          name: string
          office_address: string | null
          order_index: number
          party: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          district_id?: string | null
          email?: string | null
          id?: string
          mandate_type: string
          name: string
          office_address?: string | null
          order_index?: number
          party: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          district_id?: string | null
          email?: string | null
          id?: string
          mandate_type?: string
          name?: string
          office_address?: string | null
          order_index?: number
          party?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "election_representatives_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "election_districts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          bcc: Json | null
          body_html: string
          cc: Json | null
          created_at: string | null
          document_ids: Json | null
          error_message: string | null
          failed_recipients: Json | null
          id: string
          personalization_data: Json | null
          recipients: Json
          reply_to: string | null
          scheduled_at: string | null
          scheduled_for: string | null
          sent_at: string | null
          status: string
          subject: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          bcc?: Json | null
          body_html: string
          cc?: Json | null
          created_at?: string | null
          document_ids?: Json | null
          error_message?: string | null
          failed_recipients?: Json | null
          id?: string
          personalization_data?: Json | null
          recipients: Json
          reply_to?: string | null
          scheduled_at?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          tenant_id: string
          user_id: string
        }
        Update: {
          bcc?: Json | null
          body_html?: string
          cc?: Json | null
          created_at?: string | null
          document_ids?: Json | null
          error_message?: string | null
          failed_recipients?: Json | null
          id?: string
          personalization_data?: Json | null
          recipients?: Json
          reply_to?: string | null
          scheduled_at?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_html: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          name: string
          subject: string
          tenant_id: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          body_html: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          subject: string
          tenant_id: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          body_html?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          subject?: string
          tenant_id?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_meeting_action_items: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          description: string
          due_date: string | null
          id: string
          meeting_id: string
          notes: string | null
          owner: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          description: string
          due_date?: string | null
          id?: string
          meeting_id: string
          notes?: string | null
          owner: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          meeting_id?: string
          notes?: string | null
          owner?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_meeting_action_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "employee_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_meeting_requests: {
        Row: {
          created_at: string
          declined_at: string | null
          declined_by: string | null
          declined_reason: string | null
          employee_id: string
          id: string
          reason: string
          requested_at: string
          scheduled_meeting_id: string | null
          status: string
          tenant_id: string
          updated_at: string
          urgency: string
        }
        Insert: {
          created_at?: string
          declined_at?: string | null
          declined_by?: string | null
          declined_reason?: string | null
          employee_id: string
          id?: string
          reason: string
          requested_at?: string
          scheduled_meeting_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          urgency?: string
        }
        Update: {
          created_at?: string
          declined_at?: string | null
          declined_by?: string | null
          declined_reason?: string | null
          employee_id?: string
          id?: string
          reason?: string
          requested_at?: string
          scheduled_meeting_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_meeting_requests_scheduled_meeting_id_fkey"
            columns: ["scheduled_meeting_id"]
            isOneToOne: false
            referencedRelation: "employee_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_meeting_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_meetings: {
        Row: {
          action_items: Json | null
          conducted_by: string
          created_at: string
          employee_id: string
          employee_notes: string | null
          employee_preparation: Json | null
          id: string
          meeting_date: string
          meeting_type: string
          next_meeting_due: string | null
          protocol: Json | null
          protocol_data: Json | null
          shared_during_meeting: boolean | null
          status: string
          supervisor_notes: string | null
          supervisor_preparation: Json | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          action_items?: Json | null
          conducted_by: string
          created_at?: string
          employee_id: string
          employee_notes?: string | null
          employee_preparation?: Json | null
          id?: string
          meeting_date: string
          meeting_type?: string
          next_meeting_due?: string | null
          protocol?: Json | null
          protocol_data?: Json | null
          shared_during_meeting?: boolean | null
          status?: string
          supervisor_notes?: string | null
          supervisor_preparation?: Json | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          action_items?: Json | null
          conducted_by?: string
          created_at?: string
          employee_id?: string
          employee_notes?: string | null
          employee_preparation?: Json | null
          id?: string
          meeting_date?: string
          meeting_type?: string
          next_meeting_due?: string | null
          protocol?: Json | null
          protocol_data?: Json | null
          shared_during_meeting?: boolean | null
          status?: string
          supervisor_notes?: string | null
          supervisor_preparation?: Json | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_meetings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_settings: {
        Row: {
          admin_id: string | null
          annual_vacation_days: number
          carry_over_days: number
          contract_file_path: string | null
          created_at: string
          days_per_month: number
          days_per_week: number
          employment_start_date: string | null
          hours_per_month: number
          hours_per_week: number
          id: string
          last_meeting_date: string | null
          meeting_interval_months: number | null
          next_meeting_reminder_days: number | null
          timezone: string
          updated_at: string
          user_id: string
          work_location: string | null
          workdays: boolean[]
        }
        Insert: {
          admin_id?: string | null
          annual_vacation_days?: number
          carry_over_days?: number
          contract_file_path?: string | null
          created_at?: string
          days_per_month?: number
          days_per_week?: number
          employment_start_date?: string | null
          hours_per_month?: number
          hours_per_week?: number
          id?: string
          last_meeting_date?: string | null
          meeting_interval_months?: number | null
          next_meeting_reminder_days?: number | null
          timezone?: string
          updated_at?: string
          user_id: string
          work_location?: string | null
          workdays?: boolean[]
        }
        Update: {
          admin_id?: string | null
          annual_vacation_days?: number
          carry_over_days?: number
          contract_file_path?: string | null
          created_at?: string
          days_per_month?: number
          days_per_week?: number
          employment_start_date?: string | null
          hours_per_month?: number
          hours_per_week?: number
          id?: string
          last_meeting_date?: string | null
          meeting_interval_months?: number | null
          next_meeting_reminder_days?: number | null
          timezone?: string
          updated_at?: string
          user_id?: string
          work_location?: string | null
          workdays?: boolean[]
        }
        Relationships: []
      }
      employee_settings_history: {
        Row: {
          annual_vacation_days: number
          change_reason: string | null
          changed_by: string | null
          created_at: string | null
          days_per_month: number
          days_per_week: number
          hours_per_month: number
          hours_per_week: number
          id: string
          user_id: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          annual_vacation_days: number
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string | null
          days_per_month: number
          days_per_week: number
          hours_per_month: number
          hours_per_week: number
          id?: string
          user_id: string
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          annual_vacation_days?: number
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string | null
          days_per_month?: number
          days_per_week?: number
          hours_per_month?: number
          hours_per_week?: number
          id?: string
          user_id?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      event_planning_action_logs: {
        Row: {
          action_id: string
          checklist_item_id: string
          executed_at: string
          executed_by: string | null
          execution_details: Json | null
          execution_status: string
          id: string
        }
        Insert: {
          action_id: string
          checklist_item_id: string
          executed_at?: string
          executed_by?: string | null
          execution_details?: Json | null
          execution_status: string
          id?: string
        }
        Update: {
          action_id?: string
          checklist_item_id?: string
          executed_at?: string
          executed_by?: string | null
          execution_details?: Json | null
          execution_status?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_planning_action_logs_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "event_planning_item_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_planning_action_logs_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "event_planning_checklist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      event_planning_checklist_items: {
        Row: {
          created_at: string
          event_planning_id: string
          id: string
          is_completed: boolean
          order_index: number
          sub_items: Json | null
          title: string
          type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_planning_id: string
          id?: string
          is_completed?: boolean
          order_index?: number
          sub_items?: Json | null
          title: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_planning_id?: string
          id?: string
          is_completed?: boolean
          order_index?: number
          sub_items?: Json | null
          title?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_planning_checklist_items_event_planning_id_fkey"
            columns: ["event_planning_id"]
            isOneToOne: false
            referencedRelation: "event_plannings"
            referencedColumns: ["id"]
          },
        ]
      }
      event_planning_collaborators: {
        Row: {
          can_edit: boolean
          created_at: string
          event_planning_id: string
          id: string
          user_id: string
        }
        Insert: {
          can_edit?: boolean
          created_at?: string
          event_planning_id: string
          id?: string
          user_id: string
        }
        Update: {
          can_edit?: boolean
          created_at?: string
          event_planning_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_planning_collaborators_event_planning_id_fkey"
            columns: ["event_planning_id"]
            isOneToOne: false
            referencedRelation: "event_plannings"
            referencedColumns: ["id"]
          },
        ]
      }
      event_planning_contacts: {
        Row: {
          created_at: string
          email: string | null
          event_planning_id: string
          id: string
          name: string
          phone: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          event_planning_id: string
          id?: string
          name: string
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          event_planning_id?: string
          id?: string
          name?: string
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_planning_contacts_event_planning_id_fkey"
            columns: ["event_planning_id"]
            isOneToOne: false
            referencedRelation: "event_plannings"
            referencedColumns: ["id"]
          },
        ]
      }
      event_planning_dates: {
        Row: {
          appointment_id: string | null
          created_at: string
          date_time: string
          event_planning_id: string
          id: string
          is_confirmed: boolean
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          date_time: string
          event_planning_id: string
          id?: string
          is_confirmed?: boolean
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          date_time?: string
          event_planning_id?: string
          id?: string
          is_confirmed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "event_planning_dates_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_planning_dates_event_planning_id_fkey"
            columns: ["event_planning_id"]
            isOneToOne: false
            referencedRelation: "event_plannings"
            referencedColumns: ["id"]
          },
        ]
      }
      event_planning_documents: {
        Row: {
          created_at: string
          event_planning_id: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          tenant_id: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          event_planning_id: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          tenant_id: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          event_planning_id?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          tenant_id?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_planning_documents_event_planning_id_fkey"
            columns: ["event_planning_id"]
            isOneToOne: false
            referencedRelation: "event_plannings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_planning_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_planning_item_actions: {
        Row: {
          action_config: Json
          action_type: string
          checklist_item_id: string
          created_at: string
          id: string
          is_enabled: boolean
          updated_at: string
        }
        Insert: {
          action_config?: Json
          action_type: string
          checklist_item_id: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Update: {
          action_config?: Json
          action_type?: string
          checklist_item_id?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_planning_item_actions_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "event_planning_checklist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      event_planning_speakers: {
        Row: {
          bio: string | null
          created_at: string
          email: string | null
          event_planning_id: string
          id: string
          name: string
          order_index: number | null
          phone: string | null
          topic: string | null
          updated_at: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          email?: string | null
          event_planning_id: string
          id?: string
          name: string
          order_index?: number | null
          phone?: string | null
          topic?: string | null
          updated_at?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          email?: string | null
          event_planning_id?: string
          id?: string
          name?: string
          order_index?: number | null
          phone?: string | null
          topic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_planning_speakers_event_planning_id_fkey"
            columns: ["event_planning_id"]
            isOneToOne: false
            referencedRelation: "event_plannings"
            referencedColumns: ["id"]
          },
        ]
      }
      event_plannings: {
        Row: {
          background_info: string | null
          confirmed_date: string | null
          contact_person: string | null
          created_at: string
          description: string | null
          digital_access_info: string | null
          digital_link: string | null
          digital_platform: string | null
          id: string
          is_digital: boolean | null
          is_private: boolean
          location: string | null
          template_id: string | null
          tenant_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          background_info?: string | null
          confirmed_date?: string | null
          contact_person?: string | null
          created_at?: string
          description?: string | null
          digital_access_info?: string | null
          digital_link?: string | null
          digital_platform?: string | null
          id?: string
          is_digital?: boolean | null
          is_private?: boolean
          location?: string | null
          template_id?: string | null
          tenant_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          background_info?: string | null
          confirmed_date?: string | null
          contact_person?: string | null
          created_at?: string
          description?: string | null
          digital_access_info?: string | null
          digital_link?: string | null
          digital_platform?: string | null
          id?: string
          is_digital?: boolean | null
          is_private?: boolean
          location?: string | null
          template_id?: string | null
          tenant_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_plannings_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "planning_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_plannings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_budgets: {
        Row: {
          budget_amount: number
          created_at: string
          id: string
          month: number
          tenant_id: string
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          budget_amount?: number
          created_at?: string
          id?: string
          month: number
          tenant_id: string
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          budget_amount?: number
          created_at?: string
          id?: string
          month?: number
          tenant_id?: string
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "expense_budgets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          order_index: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          order_index?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          order_index?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          created_from_recurring: string | null
          description: string | null
          expense_date: string
          id: string
          notes: string | null
          receipt_file_path: string | null
          recurring_type: string | null
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id: string
          created_at?: string
          created_from_recurring?: string | null
          description?: string | null
          expense_date: string
          id?: string
          notes?: string | null
          receipt_file_path?: string | null
          recurring_type?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          created_from_recurring?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          receipt_file_path?: string | null
          recurring_type?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_created_from_recurring_fkey"
            columns: ["created_from_recurring"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      external_calendars: {
        Row: {
          calendar_type: string
          color: string | null
          created_at: string
          ics_url: string
          id: string
          is_active: boolean
          last_etag: string | null
          last_modified_http: string | null
          last_successful_sync: string | null
          last_sync: string | null
          last_sync_error: string | null
          max_events: number | null
          name: string
          sync_enabled: boolean
          sync_end_date: string | null
          sync_errors_count: number | null
          sync_interval: number
          sync_start_date: string | null
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          calendar_type?: string
          color?: string | null
          created_at?: string
          ics_url: string
          id?: string
          is_active?: boolean
          last_etag?: string | null
          last_modified_http?: string | null
          last_successful_sync?: string | null
          last_sync?: string | null
          last_sync_error?: string | null
          max_events?: number | null
          name: string
          sync_enabled?: boolean
          sync_end_date?: string | null
          sync_errors_count?: number | null
          sync_interval?: number
          sync_start_date?: string | null
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          calendar_type?: string
          color?: string | null
          created_at?: string
          ics_url?: string
          id?: string
          is_active?: boolean
          last_etag?: string | null
          last_modified_http?: string | null
          last_successful_sync?: string | null
          last_sync?: string | null
          last_sync_error?: string | null
          max_events?: number | null
          name?: string
          sync_enabled?: boolean
          sync_end_date?: string | null
          sync_errors_count?: number | null
          sync_interval?: number
          sync_start_date?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      external_events: {
        Row: {
          all_day: boolean
          created_at: string
          description: string | null
          end_time: string
          external_calendar_id: string
          external_uid: string
          id: string
          last_modified: string | null
          location: string | null
          raw_ics_data: Json | null
          recurrence_rule: string | null
          start_time: string
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          created_at?: string
          description?: string | null
          end_time: string
          external_calendar_id: string
          external_uid: string
          id?: string
          last_modified?: string | null
          location?: string | null
          raw_ics_data?: Json | null
          recurrence_rule?: string | null
          start_time: string
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          created_at?: string
          description?: string | null
          end_time?: string
          external_calendar_id?: string
          external_uid?: string
          id?: string
          last_modified?: string | null
          location?: string | null
          raw_ics_data?: Json | null
          recurrence_rule?: string | null
          start_time?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_events_external_calendar_id_fkey"
            columns: ["external_calendar_id"]
            isOneToOne: false
            referencedRelation: "external_calendars"
            referencedColumns: ["id"]
          },
        ]
      }
      funding_participants: {
        Row: {
          allocated_amount: number | null
          contact_id: string
          created_at: string
          funding_id: string
          id: string
          notes: string | null
          role: string | null
        }
        Insert: {
          allocated_amount?: number | null
          contact_id: string
          created_at?: string
          funding_id: string
          id?: string
          notes?: string | null
          role?: string | null
        }
        Update: {
          allocated_amount?: number | null
          contact_id?: string
          created_at?: string
          funding_id?: string
          id?: string
          notes?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funding_participants_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_participants_funding_id_fkey"
            columns: ["funding_id"]
            isOneToOne: false
            referencedRelation: "fundings"
            referencedColumns: ["id"]
          },
        ]
      }
      fundings: {
        Row: {
          category: string | null
          created_at: string
          created_by: string
          description: string | null
          end_date: string | null
          funding_source: string | null
          id: string
          start_date: string | null
          status: string | null
          tenant_id: string
          title: string
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          end_date?: string | null
          funding_source?: string | null
          id?: string
          start_date?: string | null
          status?: string | null
          tenant_id: string
          title: string
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          funding_source?: string | null
          id?: string
          start_date?: string | null
          status?: string | null
          tenant_id?: string
          title?: string
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fundings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_completions: {
        Row: {
          completion_date: string
          count: number | null
          created_at: string
          habit_id: string
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          completion_date: string
          count?: number | null
          created_at?: string
          habit_id: string
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          completion_date?: string
          count?: number | null
          created_at?: string
          habit_id?: string
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      habits: {
        Row: {
          category: string | null
          color: string | null
          created_at: string
          description: string | null
          frequency: string | null
          id: string
          is_active: boolean | null
          name: string
          target_count: number | null
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          target_count?: number | null
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          target_count?: number | null
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      information_blocks: {
        Row: {
          block_data: Json
          block_type: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean | null
          is_default: boolean | null
          label: string
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          block_data?: Json
          block_type?: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          label: string
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          block_data?: Json
          block_type?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          label?: string
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      karlsruhe_districts: {
        Row: {
          area_km2: number | null
          boundaries: Json
          center_coordinates: Json | null
          color: string
          created_at: string | null
          id: string
          is_city_boundary: boolean | null
          name: string
          population: number | null
          updated_at: string | null
        }
        Insert: {
          area_km2?: number | null
          boundaries: Json
          center_coordinates?: Json | null
          color: string
          created_at?: string | null
          id?: string
          is_city_boundary?: boolean | null
          name: string
          population?: number | null
          updated_at?: string | null
        }
        Update: {
          area_km2?: number | null
          boundaries?: Json
          center_coordinates?: Json | null
          color?: string
          created_at?: string | null
          id?: string
          is_city_boundary?: boolean | null
          name?: string
          population?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      knowledge_document_collaborators: {
        Row: {
          cursor_position: Json | null
          document_id: string
          id: string
          is_active: boolean
          joined_at: string
          last_seen_at: string
          selection_state: Json | null
          user_color: string | null
          user_id: string
        }
        Insert: {
          cursor_position?: Json | null
          document_id: string
          id?: string
          is_active?: boolean
          joined_at?: string
          last_seen_at?: string
          selection_state?: Json | null
          user_color?: string | null
          user_id: string
        }
        Update: {
          cursor_position?: Json | null
          document_id?: string
          id?: string
          is_active?: boolean
          joined_at?: string
          last_seen_at?: string
          selection_state?: Json | null
          user_color?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_document_collaborators_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_document_permissions: {
        Row: {
          created_at: string
          document_id: string
          granted_by: string
          id: string
          permission_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          granted_by: string
          id?: string
          permission_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          granted_by?: string
          id?: string
          permission_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_document_permissions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_document_snapshots: {
        Row: {
          created_at: string
          created_by: string
          document_id: string
          document_version: number
          id: string
          metadata: Json | null
          snapshot_type: string
          yjs_state: string
        }
        Insert: {
          created_at?: string
          created_by: string
          document_id: string
          document_version: number
          id?: string
          metadata?: Json | null
          snapshot_type?: string
          yjs_state: string
        }
        Update: {
          created_at?: string
          created_by?: string
          document_id?: string
          document_version?: number
          id?: string
          metadata?: Json | null
          snapshot_type?: string
          yjs_state?: string
        }
        Relationships: []
      }
      knowledge_documents: {
        Row: {
          category: string | null
          content: string | null
          content_html: string | null
          created_at: string
          created_by: string
          document_version: number | null
          editing_started_at: string | null
          id: string
          is_being_edited: boolean | null
          is_published: boolean | null
          last_editor_id: string | null
          tenant_id: string
          title: string
          updated_at: string
          yjs_state: string | null
        }
        Insert: {
          category?: string | null
          content?: string | null
          content_html?: string | null
          created_at?: string
          created_by: string
          document_version?: number | null
          editing_started_at?: string | null
          id?: string
          is_being_edited?: boolean | null
          is_published?: boolean | null
          last_editor_id?: string | null
          tenant_id: string
          title: string
          updated_at?: string
          yjs_state?: string | null
        }
        Update: {
          category?: string | null
          content?: string | null
          content_html?: string | null
          created_at?: string
          created_by?: string
          document_version?: number | null
          editing_started_at?: string | null
          id?: string
          is_being_edited?: boolean | null
          is_published?: boolean | null
          last_editor_id?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
          yjs_state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          created_at: string
          end_date: string
          id: string
          reason: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          type: Database["public"]["Enums"]["leave_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          reason?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["leave_status"]
          type: Database["public"]["Enums"]["leave_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          reason?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_status"]
          type?: Database["public"]["Enums"]["leave_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      letter_archive_settings: {
        Row: {
          auto_archive_days: number | null
          created_at: string
          id: string
          show_sent_letters: boolean | null
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_archive_days?: number | null
          created_at?: string
          id?: string
          show_sent_letters?: boolean | null
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_archive_days?: number | null
          created_at?: string
          id?: string
          show_sent_letters?: boolean | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      letter_attachments: {
        Row: {
          created_at: string
          display_name: string | null
          document_id: string | null
          file_name: string
          file_path: string | null
          file_size: number | null
          file_type: string | null
          id: string
          letter_id: string
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          document_id?: string | null
          file_name: string
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          letter_id: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          document_id?: string | null
          file_name?: string
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          letter_id?: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      letter_collaborators: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          letter_id: string
          permission_type: string
          role: string | null
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          letter_id: string
          permission_type?: string
          role?: string | null
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          letter_id?: string
          permission_type?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "letter_collaborators_letter_id_fkey"
            columns: ["letter_id"]
            isOneToOne: false
            referencedRelation: "letters"
            referencedColumns: ["id"]
          },
        ]
      }
      letter_comments: {
        Row: {
          comment_type: string | null
          content: string
          created_at: string
          id: string
          letter_id: string
          parent_comment_id: string | null
          resolved: boolean | null
          text_length: number | null
          text_position: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          comment_type?: string | null
          content: string
          created_at?: string
          id?: string
          letter_id: string
          parent_comment_id?: string | null
          resolved?: boolean | null
          text_length?: number | null
          text_position?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          comment_type?: string | null
          content?: string
          created_at?: string
          id?: string
          letter_id?: string
          parent_comment_id?: string | null
          resolved?: boolean | null
          text_length?: number | null
          text_position?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "letter_comments_letter_id_fkey"
            columns: ["letter_id"]
            isOneToOne: false
            referencedRelation: "letters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "letter_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "letter_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      letter_template_assets: {
        Row: {
          asset_type: string
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          is_active: boolean | null
          position_data: Json | null
          template_id: string | null
          tenant_id: string
          updated_at: string | null
          uploaded_by: string
        }
        Insert: {
          asset_type: string
          created_at?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_active?: boolean | null
          position_data?: Json | null
          template_id?: string | null
          tenant_id: string
          updated_at?: string | null
          uploaded_by: string
        }
        Update: {
          asset_type?: string
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_active?: boolean | null
          position_data?: Json | null
          template_id?: string | null
          tenant_id?: string
          updated_at?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "letter_template_assets_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "letter_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      letter_templates: {
        Row: {
          created_at: string
          created_by: string
          default_info_blocks: string[] | null
          default_sender_id: string | null
          footer_blocks: Json | null
          header_image_position: Json | null
          header_image_url: string | null
          header_layout_type: string | null
          header_text_elements: Json | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          layout_settings: Json | null
          letterhead_css: string
          letterhead_html: string
          name: string
          response_time_days: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          default_info_blocks?: string[] | null
          default_sender_id?: string | null
          footer_blocks?: Json | null
          header_image_position?: Json | null
          header_image_url?: string | null
          header_layout_type?: string | null
          header_text_elements?: Json | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          layout_settings?: Json | null
          letterhead_css?: string
          letterhead_html?: string
          name: string
          response_time_days?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          default_info_blocks?: string[] | null
          default_sender_id?: string | null
          footer_blocks?: Json | null
          header_image_position?: Json | null
          header_image_url?: string | null
          header_layout_type?: string | null
          header_text_elements?: Json | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          layout_settings?: Json | null
          letterhead_css?: string
          letterhead_html?: string
          name?: string
          response_time_days?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_letter_templates_sender"
            columns: ["default_sender_id"]
            isOneToOne: false
            referencedRelation: "sender_information"
            referencedColumns: ["id"]
          },
        ]
      }
      letter_workflow_history: {
        Row: {
          additional_data: Json | null
          changed_at: string
          changed_by: string
          created_at: string
          id: string
          letter_id: string
          notes: string | null
          status_from: string
          status_to: string
        }
        Insert: {
          additional_data?: Json | null
          changed_at?: string
          changed_by: string
          created_at?: string
          id?: string
          letter_id: string
          notes?: string | null
          status_from: string
          status_to: string
        }
        Update: {
          additional_data?: Json | null
          changed_at?: string
          changed_by?: string
          created_at?: string
          id?: string
          letter_id?: string
          notes?: string | null
          status_from?: string
          status_to?: string
        }
        Relationships: []
      }
      letters: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          archived_document_id: string | null
          attachments_list: string[] | null
          contact_id: string | null
          content: string
          content_html: string
          content_nodes: Json | null
          created_at: string
          created_by: string
          expected_response_date: string | null
          id: string
          information_block_id: string | null
          information_block_ids: string[] | null
          letter_date: string | null
          recipient_address: string | null
          recipient_name: string | null
          reference_number: string | null
          sender_info_id: string | null
          sender_information_id: string | null
          sent_at: string | null
          sent_by: string | null
          sent_date: string | null
          sent_method: string | null
          show_pagination: boolean | null
          status: string
          subject: string | null
          subject_line: string | null
          submitted_for_review_at: string | null
          submitted_for_review_by: string | null
          submitted_to_user: string | null
          template_id: string | null
          tenant_id: string
          title: string
          updated_at: string
          workflow_locked: boolean | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          archived_document_id?: string | null
          attachments_list?: string[] | null
          contact_id?: string | null
          content?: string
          content_html?: string
          content_nodes?: Json | null
          created_at?: string
          created_by: string
          expected_response_date?: string | null
          id?: string
          information_block_id?: string | null
          information_block_ids?: string[] | null
          letter_date?: string | null
          recipient_address?: string | null
          recipient_name?: string | null
          reference_number?: string | null
          sender_info_id?: string | null
          sender_information_id?: string | null
          sent_at?: string | null
          sent_by?: string | null
          sent_date?: string | null
          sent_method?: string | null
          show_pagination?: boolean | null
          status?: string
          subject?: string | null
          subject_line?: string | null
          submitted_for_review_at?: string | null
          submitted_for_review_by?: string | null
          submitted_to_user?: string | null
          template_id?: string | null
          tenant_id: string
          title: string
          updated_at?: string
          workflow_locked?: boolean | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          archived_document_id?: string | null
          attachments_list?: string[] | null
          contact_id?: string | null
          content?: string
          content_html?: string
          content_nodes?: Json | null
          created_at?: string
          created_by?: string
          expected_response_date?: string | null
          id?: string
          information_block_id?: string | null
          information_block_ids?: string[] | null
          letter_date?: string | null
          recipient_address?: string | null
          recipient_name?: string | null
          reference_number?: string | null
          sender_info_id?: string | null
          sender_information_id?: string | null
          sent_at?: string | null
          sent_by?: string | null
          sent_date?: string | null
          sent_method?: string | null
          show_pagination?: boolean | null
          status?: string
          subject?: string | null
          subject_line?: string | null
          submitted_for_review_at?: string | null
          submitted_for_review_by?: string | null
          submitted_to_user?: string | null
          template_id?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
          workflow_locked?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "letters_information_block_id_fkey"
            columns: ["information_block_id"]
            isOneToOne: false
            referencedRelation: "information_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "letters_sender_information_id_fkey"
            columns: ["sender_information_id"]
            isOneToOne: false
            referencedRelation: "sender_information"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "letters_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "letter_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      login_customization: {
        Row: {
          accent_color: string | null
          background_attribution: Json | null
          background_image_url: string | null
          background_position: string | null
          created_at: string | null
          footer_text: string | null
          id: string
          logo_url: string | null
          password_reset_enabled: boolean | null
          primary_color: string | null
          registration_enabled: boolean | null
          social_login_enabled: boolean | null
          tagline: string | null
          tenant_id: string
          updated_at: string | null
          welcome_text: string | null
        }
        Insert: {
          accent_color?: string | null
          background_attribution?: Json | null
          background_image_url?: string | null
          background_position?: string | null
          created_at?: string | null
          footer_text?: string | null
          id?: string
          logo_url?: string | null
          password_reset_enabled?: boolean | null
          primary_color?: string | null
          registration_enabled?: boolean | null
          social_login_enabled?: boolean | null
          tagline?: string | null
          tenant_id: string
          updated_at?: string | null
          welcome_text?: string | null
        }
        Update: {
          accent_color?: string | null
          background_attribution?: Json | null
          background_image_url?: string | null
          background_position?: string | null
          created_at?: string | null
          footer_text?: string | null
          id?: string
          logo_url?: string | null
          password_reset_enabled?: boolean | null
          primary_color?: string | null
          registration_enabled?: boolean | null
          social_login_enabled?: boolean | null
          tagline?: string | null
          tenant_id?: string
          updated_at?: string | null
          welcome_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "login_customization_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      map_flag_types: {
        Row: {
          color: string
          created_at: string
          created_by: string
          description: string | null
          icon: string
          id: string
          is_active: boolean
          name: string
          order_index: number
          tag_filter: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by: string
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          order_index?: number
          tag_filter?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          order_index?: number
          tag_filter?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_tenant"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      map_flags: {
        Row: {
          coordinates: Json
          created_at: string
          created_by: string
          description: string | null
          flag_type_id: string
          id: string
          metadata: Json | null
          tags: string[] | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          coordinates: Json
          created_at?: string
          created_by: string
          description?: string | null
          flag_type_id: string
          id?: string
          metadata?: Json | null
          tags?: string[] | null
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          coordinates?: Json
          created_at?: string
          created_by?: string
          description?: string | null
          flag_type_id?: string
          id?: string
          metadata?: Json | null
          tags?: string[] | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_flag_type"
            columns: ["flag_type_id"]
            isOneToOne: false
            referencedRelation: "map_flag_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tenant"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      matrix_bot_logs: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          message_content: string | null
          message_type: string | null
          metadata: Json | null
          response_content: string | null
          room_id: string | null
          sent_date: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          message_content?: string | null
          message_type?: string | null
          metadata?: Json | null
          response_content?: string | null
          room_id?: string | null
          sent_date?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          message_content?: string | null
          message_type?: string | null
          metadata?: Json | null
          response_content?: string | null
          room_id?: string | null
          sent_date?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      matrix_morning_settings: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          include_appointments: boolean
          include_greeting: boolean
          include_weather: boolean
          send_time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          include_appointments?: boolean
          include_greeting?: boolean
          include_weather?: boolean
          send_time?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          include_appointments?: boolean
          include_greeting?: boolean
          include_weather?: boolean
          send_time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      matrix_subscriptions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          matrix_username: string
          notification_types: string[] | null
          room_id: string
          room_name: string | null
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          matrix_username: string
          notification_types?: string[] | null
          room_id: string
          room_name?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          matrix_username?: string
          notification_types?: string[] | null
          room_id?: string
          room_name?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matrix_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_agenda_documents: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          meeting_agenda_item_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          meeting_agenda_item_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          meeting_agenda_item_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meeting_agenda_items: {
        Row: {
          assigned_to: string[] | null
          carried_over_from: string | null
          carry_over_to_next: boolean | null
          carryover_notes: string | null
          created_at: string
          description: string | null
          file_path: string | null
          id: string
          is_completed: boolean
          is_recurring: boolean
          meeting_id: string
          notes: string | null
          order_index: number
          original_meeting_date: string | null
          original_meeting_title: string | null
          parent_id: string | null
          result_text: string | null
          source_meeting_id: string | null
          task_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string[] | null
          carried_over_from?: string | null
          carry_over_to_next?: boolean | null
          carryover_notes?: string | null
          created_at?: string
          description?: string | null
          file_path?: string | null
          id?: string
          is_completed?: boolean
          is_recurring?: boolean
          meeting_id: string
          notes?: string | null
          order_index?: number
          original_meeting_date?: string | null
          original_meeting_title?: string | null
          parent_id?: string | null
          result_text?: string | null
          source_meeting_id?: string | null
          task_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string[] | null
          carried_over_from?: string | null
          carry_over_to_next?: boolean | null
          carryover_notes?: string | null
          created_at?: string
          description?: string | null
          file_path?: string | null
          id?: string
          is_completed?: boolean
          is_recurring?: boolean
          meeting_id?: string
          notes?: string | null
          order_index?: number
          original_meeting_date?: string | null
          original_meeting_title?: string | null
          parent_id?: string | null
          result_text?: string | null
          source_meeting_id?: string | null
          task_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_agenda_items_parent_fk"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "meeting_agenda_items"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          template_items: Json
          tenant_id: string | null
          updated_at: string
          user_id: string
          version: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          template_items?: Json
          tenant_id?: string | null
          updated_at?: string
          user_id: string
          version?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          template_items?: Json
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          location: string | null
          meeting_date: string
          status: string
          template_id: string | null
          tenant_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          meeting_date: string
          status?: string
          template_id?: string | null
          tenant_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          meeting_date?: string
          status?: string
          template_id?: string | null
          tenant_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      message_confirmations: {
        Row: {
          confirmed_at: string
          created_at: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          confirmed_at?: string
          created_at?: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          confirmed_at?: string
          created_at?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_confirmations_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_recipients: {
        Row: {
          created_at: string
          has_read: boolean
          id: string
          message_id: string
          read_at: string | null
          recipient_id: string
        }
        Insert: {
          created_at?: string
          has_read?: boolean
          id?: string
          message_id: string
          read_at?: string | null
          recipient_id: string
        }
        Update: {
          created_at?: string
          has_read?: boolean
          id?: string
          message_id?: string
          read_at?: string | null
          recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_recipients_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          is_for_all_users: boolean
          status: string
          tenant_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          is_for_all_users?: boolean
          status?: string
          tenant_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          is_for_all_users?: boolean
          status?: string
          tenant_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      news_email_templates: {
        Row: {
          closing: string
          created_at: string
          greeting: string
          id: string
          introduction: string
          signature: string
          subject: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          closing?: string
          created_at?: string
          greeting?: string
          id?: string
          introduction?: string
          signature?: string
          subject?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          closing?: string
          created_at?: string
          greeting?: string
          id?: string
          introduction?: string
          signature?: string
          subject?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_email_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_navigation_mapping: {
        Row: {
          created_at: string
          id: string
          navigation_context: string
          notification_type_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          navigation_context: string
          notification_type_name: string
        }
        Update: {
          created_at?: string
          id?: string
          navigation_context?: string
          notification_type_name?: string
        }
        Relationships: []
      }
      notification_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          label: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          label: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          label?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          expires_at: string | null
          id: string
          is_pushed: boolean
          is_read: boolean
          message: string
          navigation_context: string | null
          notification_type_id: string
          priority: string
          push_sent_at: string | null
          read_at: string | null
          tenant_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          expires_at?: string | null
          id?: string
          is_pushed?: boolean
          is_read?: boolean
          message: string
          navigation_context?: string | null
          notification_type_id: string
          priority?: string
          push_sent_at?: string | null
          read_at?: string | null
          tenant_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          expires_at?: string | null
          id?: string
          is_pushed?: boolean
          is_read?: boolean
          message?: string
          navigation_context?: string | null
          notification_type_id?: string
          priority?: string
          push_sent_at?: string | null
          read_at?: string | null
          tenant_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_notification_type_id_fkey"
            columns: ["notification_type_id"]
            isOneToOne: false
            referencedRelation: "notification_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      parliament_protocols: {
        Row: {
          created_at: string
          file_path: string
          file_size: number | null
          id: string
          legislature_period: string
          original_filename: string
          processing_error_message: string | null
          processing_status: string
          protocol_date: string
          raw_text: string | null
          session_number: string
          structured_data: Json | null
          tenant_id: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_path: string
          file_size?: number | null
          id?: string
          legislature_period: string
          original_filename: string
          processing_error_message?: string | null
          processing_status?: string
          protocol_date: string
          raw_text?: string | null
          session_number: string
          structured_data?: Json | null
          tenant_id: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_path?: string
          file_size?: number | null
          id?: string
          legislature_period?: string
          original_filename?: string
          processing_error_message?: string | null
          processing_status?: string
          protocol_date?: string
          raw_text?: string | null
          session_number?: string
          structured_data?: Json | null
          tenant_id?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      party_associations: {
        Row: {
          address_city: string | null
          address_number: string | null
          address_postal_code: string | null
          address_street: string | null
          administrative_boundaries: Json | null
          contact_info: Json | null
          coverage_areas: Json | null
          created_at: string
          email: string | null
          full_address: string | null
          id: string
          name: string
          party_name: string
          party_type: string
          phone: string | null
          social_media: Json | null
          tenant_id: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address_city?: string | null
          address_number?: string | null
          address_postal_code?: string | null
          address_street?: string | null
          administrative_boundaries?: Json | null
          contact_info?: Json | null
          coverage_areas?: Json | null
          created_at?: string
          email?: string | null
          full_address?: string | null
          id?: string
          name: string
          party_name?: string
          party_type?: string
          phone?: string | null
          social_media?: Json | null
          tenant_id: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address_city?: string | null
          address_number?: string | null
          address_postal_code?: string | null
          address_street?: string | null
          administrative_boundaries?: Json | null
          contact_info?: Json | null
          coverage_areas?: Json | null
          created_at?: string
          email?: string | null
          full_address?: string | null
          id?: string
          name?: string
          party_name?: string
          party_type?: string
          phone?: string | null
          social_media?: Json | null
          tenant_id?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      planning_item_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          planning_item_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          planning_item_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          planning_item_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      planning_item_documents: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          planning_item_id: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          planning_item_id: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          planning_item_id?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_item_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_item_subtasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          description: string
          due_date: string | null
          id: string
          is_completed: boolean
          order_index: number
          planning_item_id: string
          result_text: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          description: string
          due_date?: string | null
          id?: string
          is_completed?: boolean
          order_index?: number
          planning_item_id: string
          result_text?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          is_completed?: boolean
          order_index?: number
          planning_item_id?: string
          result_text?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      planning_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          template_items: Json
          tenant_id: string | null
          updated_at: string
          user_id: string
          version: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          template_items?: Json
          tenant_id?: string | null
          updated_at?: string
          user_id: string
          version?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          template_items?: Json
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "planning_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_notifications: {
        Row: {
          created_at: string
          id: string
          is_sent: boolean
          notification_type: string
          participant_id: string
          poll_id: string
          sent_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_sent?: boolean
          notification_type: string
          participant_id: string
          poll_id: string
          sent_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_sent?: boolean
          notification_type?: string
          participant_id?: string
          poll_id?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "poll_notifications_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "poll_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_notifications_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "appointment_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_participants: {
        Row: {
          created_at: string
          email: string
          id: string
          is_external: boolean
          name: string | null
          poll_id: string
          token: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_external?: boolean
          name?: string | null
          poll_id: string
          token?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_external?: boolean
          name?: string | null
          poll_id?: string
          token?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "poll_participants_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "appointment_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_responses: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          participant_id: string
          poll_id: string
          status: string
          time_slot_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          participant_id: string
          poll_id: string
          status: string
          time_slot_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          participant_id?: string
          poll_id?: string
          status?: string
          time_slot_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_responses_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "poll_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_responses_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "appointment_polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_responses_time_slot_id_fkey"
            columns: ["time_slot_id"]
            isOneToOne: false
            referencedRelation: "poll_time_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_time_slots: {
        Row: {
          created_at: string
          end_time: string
          id: string
          order_index: number
          poll_id: string
          start_time: string
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          order_index?: number
          poll_id: string
          start_time: string
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          order_index?: number
          poll_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_time_slots_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "appointment_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_versions: {
        Row: {
          changes_summary: string | null
          created_at: string
          created_by: string
          deadline: string | null
          description: string | null
          id: string
          poll_id: string
          title: string
          version_number: number
        }
        Insert: {
          changes_summary?: string | null
          created_at?: string
          created_by: string
          deadline?: string | null
          description?: string | null
          id?: string
          poll_id: string
          title: string
          version_number?: number
        }
        Update: {
          changes_summary?: string | null
          created_at?: string
          created_by?: string
          deadline?: string | null
          description?: string | null
          id?: string
          poll_id?: string
          title?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "poll_versions_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "appointment_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      pomodoro_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_minutes: number
          id: string
          is_completed: boolean | null
          notes: string | null
          session_type: string | null
          started_at: string
          task_id: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          is_completed?: boolean | null
          notes?: string | null
          session_type?: string | null
          started_at?: string
          task_id?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          is_completed?: boolean | null
          notes?: string | null
          session_type?: string | null
          started_at?: string
          task_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          badge_color: string | null
          bio: string | null
          created_at: string
          dashboard_cover_image_attribution: Json | null
          dashboard_cover_image_position: string | null
          dashboard_cover_image_url: string | null
          display_name: string | null
          id: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          badge_color?: string | null
          bio?: string | null
          created_at?: string
          dashboard_cover_image_attribution?: Json | null
          dashboard_cover_image_position?: string | null
          dashboard_cover_image_url?: string | null
          display_name?: string | null
          id?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          badge_color?: string | null
          bio?: string | null
          created_at?: string
          dashboard_cover_image_attribution?: Json | null
          dashboard_cover_image_position?: string | null
          dashboard_cover_image_url?: string | null
          display_name?: string | null
          id?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      protocol_agenda_items: {
        Row: {
          agenda_number: string
          created_at: string
          description: string | null
          drucksachen: Json | null
          end_time: string | null
          id: string
          item_type: string | null
          page_number: number | null
          protocol_id: string
          speakers: Json | null
          start_time: string | null
          subentries: Json | null
          title: string
        }
        Insert: {
          agenda_number: string
          created_at?: string
          description?: string | null
          drucksachen?: Json | null
          end_time?: string | null
          id?: string
          item_type?: string | null
          page_number?: number | null
          protocol_id: string
          speakers?: Json | null
          start_time?: string | null
          subentries?: Json | null
          title: string
        }
        Update: {
          agenda_number?: string
          created_at?: string
          description?: string | null
          drucksachen?: Json | null
          end_time?: string | null
          id?: string
          item_type?: string | null
          page_number?: number | null
          protocol_id?: string
          speakers?: Json | null
          start_time?: string | null
          subentries?: Json | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "protocol_agenda_items_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "parliament_protocols"
            referencedColumns: ["id"]
          },
        ]
      }
      protocol_sessions: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          page_number: number | null
          protocol_id: string
          session_type: string
          timestamp: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          page_number?: number | null
          protocol_id: string
          session_type: string
          timestamp: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          page_number?: number | null
          protocol_id?: string
          session_type?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "protocol_sessions_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "parliament_protocols"
            referencedColumns: ["id"]
          },
        ]
      }
      protocol_speeches: {
        Row: {
          agenda_item_id: string | null
          created_at: string
          end_time: string | null
          events: Json | null
          events_flat: Json | null
          id: string
          index: number | null
          page_number: number | null
          protocol_id: string
          speaker_name: string
          speaker_party: string | null
          speaker_role: string | null
          speech_content: string
          speech_type: string | null
          start_time: string | null
        }
        Insert: {
          agenda_item_id?: string | null
          created_at?: string
          end_time?: string | null
          events?: Json | null
          events_flat?: Json | null
          id?: string
          index?: number | null
          page_number?: number | null
          protocol_id: string
          speaker_name: string
          speaker_party?: string | null
          speaker_role?: string | null
          speech_content: string
          speech_type?: string | null
          start_time?: string | null
        }
        Update: {
          agenda_item_id?: string | null
          created_at?: string
          end_time?: string | null
          events?: Json | null
          events_flat?: Json | null
          id?: string
          index?: number | null
          page_number?: number | null
          protocol_id?: string
          speaker_name?: string
          speaker_party?: string | null
          speaker_role?: string | null
          speech_content?: string
          speech_type?: string | null
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "protocol_speeches_agenda_item_id_fkey"
            columns: ["agenda_item_id"]
            isOneToOne: false
            referencedRelation: "protocol_agenda_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocol_speeches_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "parliament_protocols"
            referencedColumns: ["id"]
          },
        ]
      }
      public_holidays: {
        Row: {
          created_at: string
          holiday_date: string
          id: string
          is_nationwide: boolean | null
          name: string
          state: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          holiday_date: string
          id?: string
          is_nationwide?: boolean | null
          name: string
          state?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          holiday_date?: string
          id?: string
          is_nationwide?: boolean | null
          name?: string
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          is_active: boolean
          p256dh_key: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          is_active?: boolean
          p256dh_key: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          is_active?: boolean
          p256dh_key?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      quick_notes: {
        Row: {
          archived_at: string | null
          category: string | null
          color: string | null
          content: string
          created_at: string
          id: string
          is_archived: boolean | null
          is_pinned: boolean | null
          tags: string[] | null
          task_id: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          category?: string | null
          color?: string | null
          content: string
          created_at?: string
          id?: string
          is_archived?: boolean | null
          is_pinned?: boolean | null
          tags?: string[] | null
          task_id?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          category?: string | null
          color?: string | null
          content?: string
          created_at?: string
          id?: string
          is_archived?: boolean | null
          is_pinned?: boolean | null
          tags?: string[] | null
          task_id?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_notes_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      rss_cache: {
        Row: {
          cache_key: string
          content: Json
          created_at: string | null
          expires_at: string
        }
        Insert: {
          cache_key: string
          content: Json
          created_at?: string | null
          expires_at: string
        }
        Update: {
          cache_key?: string
          content?: Json
          created_at?: string | null
          expires_at?: string
        }
        Relationships: []
      }
      rss_settings: {
        Row: {
          articles_per_feed: number
          created_at: string
          id: string
          refresh_interval_minutes: number
          tenant_id: string
          timeout_seconds: number
          total_articles_limit: number
          updated_at: string
        }
        Insert: {
          articles_per_feed?: number
          created_at?: string
          id?: string
          refresh_interval_minutes?: number
          tenant_id: string
          timeout_seconds?: number
          total_articles_limit?: number
          updated_at?: string
        }
        Update: {
          articles_per_feed?: number
          created_at?: string
          id?: string
          refresh_interval_minutes?: number
          tenant_id?: string
          timeout_seconds?: number
          total_articles_limit?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rss_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rss_sources: {
        Row: {
          category: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          name: string
          order_index: number
          tenant_id: string
          updated_at: string
          url: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          name: string
          order_index?: number
          tenant_id: string
          updated_at?: string
          url: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          name?: string
          order_index?: number
          tenant_id?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "rss_sources_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_emails: {
        Row: {
          bcc: Json | null
          body_html: string
          cc: Json | null
          contact_ids: Json | null
          created_at: string | null
          distribution_list_ids: Json | null
          document_ids: Json | null
          error_message: string | null
          id: string
          recipients: Json
          reply_to: string | null
          scheduled_for: string
          sender_id: string | null
          sent_at: string | null
          status: string | null
          subject: string
          tenant_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bcc?: Json | null
          body_html: string
          cc?: Json | null
          contact_ids?: Json | null
          created_at?: string | null
          distribution_list_ids?: Json | null
          document_ids?: Json | null
          error_message?: string | null
          id?: string
          recipients?: Json
          reply_to?: string | null
          scheduled_for: string
          sender_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject: string
          tenant_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bcc?: Json | null
          body_html?: string
          cc?: Json | null
          contact_ids?: Json | null
          created_at?: string | null
          distribution_list_ids?: Json | null
          document_ids?: Json | null
          error_message?: string | null
          id?: string
          recipients?: Json
          reply_to?: string | null
          scheduled_for?: string
          sender_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string
          tenant_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_emails_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "sender_information"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_emails_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      search_analytics: {
        Row: {
          created_at: string
          id: string
          result_count: number
          result_types: Json | null
          search_query: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          result_count?: number
          result_types?: Json | null
          search_query: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          result_count?: number
          result_types?: Json | null
          search_query?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_analytics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sender_information: {
        Row: {
          created_at: string
          created_by: string
          facebook_profile: string | null
          fax: string | null
          id: string
          instagram_profile: string | null
          is_active: boolean | null
          is_default: boolean | null
          landtag_city: string | null
          landtag_email: string | null
          landtag_house_number: string | null
          landtag_postal_code: string | null
          landtag_street: string | null
          name: string
          organization: string
          phone: string | null
          return_address_line: string | null
          tenant_id: string
          updated_at: string
          wahlkreis_city: string | null
          wahlkreis_email: string | null
          wahlkreis_house_number: string | null
          wahlkreis_postal_code: string | null
          wahlkreis_street: string | null
          website: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          facebook_profile?: string | null
          fax?: string | null
          id?: string
          instagram_profile?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          landtag_city?: string | null
          landtag_email?: string | null
          landtag_house_number?: string | null
          landtag_postal_code?: string | null
          landtag_street?: string | null
          name: string
          organization: string
          phone?: string | null
          return_address_line?: string | null
          tenant_id: string
          updated_at?: string
          wahlkreis_city?: string | null
          wahlkreis_email?: string | null
          wahlkreis_house_number?: string | null
          wahlkreis_postal_code?: string | null
          wahlkreis_street?: string | null
          website?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          facebook_profile?: string | null
          fax?: string | null
          id?: string
          instagram_profile?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          landtag_city?: string | null
          landtag_email?: string | null
          landtag_house_number?: string | null
          landtag_postal_code?: string | null
          landtag_street?: string | null
          name?: string
          organization?: string
          phone?: string | null
          return_address_line?: string | null
          tenant_id?: string
          updated_at?: string
          wahlkreis_city?: string | null
          wahlkreis_email?: string | null
          wahlkreis_house_number?: string | null
          wahlkreis_postal_code?: string | null
          wahlkreis_street?: string | null
          website?: string | null
        }
        Relationships: []
      }
      sick_days: {
        Row: {
          created_at: string
          end_date: string
          id: string
          notes: string | null
          sick_date: string
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          notes?: string | null
          sick_date: string
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          notes?: string | null
          sick_date?: string
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subtasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          description: string
          due_date: string | null
          id: string
          is_completed: boolean
          order_index: number
          result_text: string | null
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          description: string
          due_date?: string | null
          id?: string
          is_completed?: boolean
          order_index?: number
          result_text?: string | null
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          is_completed?: boolean
          order_index?: number
          result_text?: string | null
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          label: string
          name: string
          order_index: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          label: string
          name: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          label?: string
          name?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: []
      }
      task_archive_settings: {
        Row: {
          auto_delete_after_days: number | null
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_delete_after_days?: number | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_delete_after_days?: number | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      task_categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          name: string
          order_index: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          name: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          name?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: []
      }
      task_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_decision_attachments: {
        Row: {
          created_at: string
          decision_id: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          decision_id: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          decision_id?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_decision_attachments_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "task_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      task_decision_participants: {
        Row: {
          decision_id: string
          id: string
          invited_at: string
          token: string | null
          user_id: string
        }
        Insert: {
          decision_id: string
          id?: string
          invited_at?: string
          token?: string | null
          user_id: string
        }
        Update: {
          decision_id?: string
          id?: string
          invited_at?: string
          token?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_decision_participants_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "task_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      task_decision_response_history: {
        Row: {
          changed_by: string | null
          comment: string | null
          created_at: string
          decision_id: string
          id: string
          participant_id: string
          response_id: string
          response_type: string
        }
        Insert: {
          changed_by?: string | null
          comment?: string | null
          created_at?: string
          decision_id: string
          id?: string
          participant_id: string
          response_id: string
          response_type: string
        }
        Update: {
          changed_by?: string | null
          comment?: string | null
          created_at?: string
          decision_id?: string
          id?: string
          participant_id?: string
          response_id?: string
          response_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_decision_response_history_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "task_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_decision_response_history_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "task_decision_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_decision_response_history_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "task_decision_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      task_decision_responses: {
        Row: {
          comment: string | null
          created_at: string
          creator_response: string | null
          decision_id: string
          id: string
          participant_id: string
          response_type: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          creator_response?: string | null
          decision_id: string
          id?: string
          participant_id: string
          response_type: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          creator_response?: string | null
          decision_id?: string
          id?: string
          participant_id?: string
          response_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_decision_responses_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "task_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_decision_responses_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "task_decision_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      task_decisions: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          status: string
          subtask_id: string | null
          task_id: string | null
          tenant_id: string | null
          title: string
          updated_at: string
          visible_to_all: boolean
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          status?: string
          subtask_id?: string | null
          task_id?: string | null
          tenant_id?: string | null
          title: string
          updated_at?: string
          visible_to_all?: boolean
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          status?: string
          subtask_id?: string | null
          task_id?: string | null
          tenant_id?: string | null
          title?: string
          updated_at?: string
          visible_to_all?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "task_decisions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_decisions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      task_documents: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      task_snoozes: {
        Row: {
          created_at: string
          id: string
          snoozed_until: string
          subtask_id: string | null
          task_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          snoozed_until: string
          subtask_id?: string | null
          task_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          snoozed_until?: string
          subtask_id?: string | null
          task_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      task_statuses: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          name: string
          order_index: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          name: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          name?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          call_log_id: string | null
          category: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          priority: string
          progress: number | null
          status: string
          tenant_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          call_log_id?: string | null
          category?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          progress?: number | null
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          call_log_id?: string | null
          category?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          progress?: number | null
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_call_log_id_fkey"
            columns: ["call_log_id"]
            isOneToOne: false
            referencedRelation: "call_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      team_dashboard_members: {
        Row: {
          added_at: string
          id: string
          role: string | null
          team_dashboard_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          role?: string | null
          team_dashboard_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          id?: string
          role?: string | null
          team_dashboard_id?: string
          user_id?: string
        }
        Relationships: []
      }
      team_dashboards: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_public: boolean | null
          layout_data: Json
          name: string
          owner_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          layout_data?: Json
          name: string
          owner_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          layout_data?: Json
          name?: string
          owner_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_dashboards_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_collaborations: {
        Row: {
          approved_by_a: string | null
          approved_by_b: string | null
          collaboration_type: string
          created_at: string
          id: string
          is_active: boolean
          tenant_a_id: string
          tenant_b_id: string
          updated_at: string
        }
        Insert: {
          approved_by_a?: string | null
          approved_by_b?: string | null
          collaboration_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          tenant_a_id: string
          tenant_b_id: string
          updated_at?: string
        }
        Update: {
          approved_by_a?: string | null
          approved_by_b?: string | null
          collaboration_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          tenant_a_id?: string
          tenant_b_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_collaborations_tenant_a_id_fkey"
            columns: ["tenant_a_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_collaborations_tenant_b_id_fkey"
            columns: ["tenant_b_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          settings: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          settings?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          settings?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          minutes: number
          notes: string | null
          pause_minutes: number | null
          started_at: string | null
          tenant_id: string | null
          updated_at: string
          user_id: string
          work_date: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          minutes: number
          notes?: string | null
          pause_minutes?: number | null
          started_at?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id: string
          work_date: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          minutes?: number
          notes?: string | null
          pause_minutes?: number | null
          started_at?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entry_history: {
        Row: {
          change_type: string
          changed_at: string
          changed_by: string | null
          created_at: string
          ended_at: string | null
          entry_date: string
          id: string
          minutes: number | null
          notes: string | null
          pause_minutes: number | null
          started_at: string | null
          time_entry_id: string
          user_id: string
        }
        Insert: {
          change_type: string
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          ended_at?: string | null
          entry_date: string
          id?: string
          minutes?: number | null
          notes?: string | null
          pause_minutes?: number | null
          started_at?: string | null
          time_entry_id: string
          user_id: string
        }
        Update: {
          change_type?: string
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          ended_at?: string | null
          entry_date?: string
          id?: string
          minutes?: number | null
          notes?: string | null
          pause_minutes?: number | null
          started_at?: string | null
          time_entry_id?: string
          user_id?: string
        }
        Relationships: []
      }
      todo_categories: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          label: string
          name: string
          order_index: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          name: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          name?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: []
      }
      todos: {
        Row: {
          assigned_to: string[] | null
          category_id: string
          completed_at: string | null
          created_at: string
          due_date: string | null
          id: string
          is_completed: boolean
          tenant_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string[] | null
          category_id: string
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          is_completed?: boolean
          tenant_id: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string[] | null
          category_id?: string
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          is_completed?: boolean
          tenant_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "todos_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "todo_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_navigation_visits: {
        Row: {
          created_at: string
          id: string
          last_visited_at: string
          navigation_context: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_visited_at?: string
          navigation_context: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_visited_at?: string
          navigation_context?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_notification_settings: {
        Row: {
          created_at: string
          email_enabled: boolean
          id: string
          is_enabled: boolean
          matrix_enabled: boolean | null
          notification_type_id: string
          push_enabled: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          is_enabled?: boolean
          matrix_enabled?: boolean | null
          notification_type_id: string
          push_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          is_enabled?: boolean
          matrix_enabled?: boolean | null
          notification_type_id?: string
          push_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notification_settings_notification_type_id_fkey"
            columns: ["notification_type_id"]
            isOneToOne: false
            referencedRelation: "notification_types"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_status: {
        Row: {
          auto_away_enabled: boolean
          color: string | null
          created_at: string
          custom_message: string | null
          emoji: string | null
          id: string
          last_activity: string
          notifications_enabled: boolean
          status_type: Database["public"]["Enums"]["user_status_type"]
          status_until: string | null
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_away_enabled?: boolean
          color?: string | null
          created_at?: string
          custom_message?: string | null
          emoji?: string | null
          id?: string
          last_activity?: string
          notifications_enabled?: boolean
          status_type?: Database["public"]["Enums"]["user_status_type"]
          status_until?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_away_enabled?: boolean
          color?: string | null
          created_at?: string
          custom_message?: string | null
          emoji?: string | null
          id?: string
          last_activity?: string
          notifications_enabled?: boolean
          status_type?: Database["public"]["Enums"]["user_status_type"]
          status_until?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_status_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tenant_memberships: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          role: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          role?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          role?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tenant_memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      widget_configurations: {
        Row: {
          configuration: Json
          created_at: string
          id: string
          updated_at: string
          user_id: string
          widget_id: string
          widget_type: string
        }
        Insert: {
          configuration?: Json
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          widget_id: string
          widget_type: string
        }
        Update: {
          configuration?: Json
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          widget_id?: string
          widget_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _meeting_default_end: { Args: { _date: string }; Returns: string }
      _meeting_default_start: { Args: { _date: string }; Returns: string }
      assign_contact_to_organization: {
        Args: { contact_id: string; org_id: string }
        Returns: undefined
      }
      auto_archive_completed_preparations: { Args: never; Returns: undefined }
      auto_update_poll_status: { Args: never; Returns: undefined }
      can_access_knowledge_document: {
        Args: { _document_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_letter_for_collaboration: {
        Args: { _letter_id: string; _user_id: string }
        Returns: boolean
      }
      can_edit_knowledge_document: {
        Args: { _document_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_dashboard: {
        Args: { dashboard_id: string; user_id: string }
        Returns: boolean
      }
      can_view_event_planning: {
        Args: { _planning_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_message_confirmations: {
        Args: { message_id_param: string }
        Returns: boolean
      }
      can_view_message_recipients: {
        Args: { message_id_param: string }
        Returns: boolean
      }
      create_default_checklist_items:
        | {
            Args: { planning_id: string; template_id_param?: string }
            Returns: undefined
          }
        | { Args: { planning_id: string }; Returns: undefined }
      create_knowledge_document_snapshot:
        | {
            Args: {
              _document_id: string
              _snapshot_type?: string
              _yjs_state: string
            }
            Returns: string
          }
        | {
            Args: {
              _document_id: string
              _snapshot_type?: string
              _yjs_state: string
            }
            Returns: string
          }
      create_notification: {
        Args: {
          data_param?: Json
          message_param: string
          priority_param?: string
          title_param: string
          type_name: string
          user_id_param: string
        }
        Returns: string
      }
      create_poll_notification: {
        Args: {
          _notification_type: string
          _participant_id: string
          _poll_id: string
        }
        Returns: string
      }
      generate_decision_participant_token: { Args: never; Returns: string }
      generate_guest_invitation_token: { Args: never; Returns: string }
      generate_participant_token: { Args: never; Returns: string }
      get_authored_messages: {
        Args: { author_id_param: string }
        Returns: {
          author_id: string
          content: string
          created_at: string
          id: string
          is_for_all_users: boolean
          read_count: number
          recipients_count: number
          status: string
          title: string
        }[]
      }
      get_daily_hours: { Args: { _user_id: string }; Returns: number }
      get_user_messages: {
        Args: { user_id_param: string }
        Returns: {
          author_avatar: string
          author_id: string
          author_name: string
          content: string
          created_at: string
          has_read: boolean
          id: string
          is_for_all_users: boolean
          status: string
          title: string
        }[]
      }
      get_user_primary_tenant_id: {
        Args: { _user_id: string }
        Returns: string
      }
      get_user_role_level: { Args: { _user_id: string }; Returns: number }
      get_user_tenant_ids: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      insert_sample_contacts: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_admin_for_audit_logs: { Args: { _user_id: string }; Returns: boolean }
      is_admin_of: { Args: { employee: string }; Returns: boolean }
      is_message_recipient: {
        Args: { message_id_param: string; user_id_param: string }
        Returns: boolean
      }
      is_tenant_admin: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      log_collaboration_event: {
        Args: {
          details?: Json
          document_id: string
          event_type: string
          user_id: string
        }
        Returns: undefined
      }
      mark_message_read: {
        Args: {
          is_for_all_param: boolean
          message_id_param: string
          user_id_param: string
        }
        Returns: undefined
      }
      send_message: {
        Args: {
          author_id_param: string
          content_param: string
          is_for_all_param: boolean
          recipient_ids_param: string[]
          title_param: string
        }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sync_birthday_appointments: { Args: never; Returns: undefined }
      sync_existing_contact_tags: { Args: never; Returns: undefined }
      update_contact_usage: {
        Args: { p_contact_id: string; p_tenant_id?: string; p_user_id?: string }
        Returns: undefined
      }
      user_can_access_task_decision: {
        Args: { _decision_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_tenant_access: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "abgeordneter" | "bueroleitung" | "mitarbeiter" | "praktikant"
      flag_visibility: "public" | "private" | "team"
      leave_status: "pending" | "approved" | "rejected"
      leave_type: "vacation" | "sick" | "other"
      user_status_type:
        | "online"
        | "meeting"
        | "break"
        | "away"
        | "offline"
        | "custom"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["abgeordneter", "bueroleitung", "mitarbeiter", "praktikant"],
      flag_visibility: ["public", "private", "team"],
      leave_status: ["pending", "approved", "rejected"],
      leave_type: ["vacation", "sick", "other"],
      user_status_type: [
        "online",
        "meeting",
        "break",
        "away",
        "offline",
        "custom",
      ],
    },
  },
} as const
