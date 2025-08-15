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
          category: string | null
          contact_id: string | null
          created_at: string
          description: string | null
          end_time: string
          id: string
          location: string | null
          meeting_id: string | null
          priority: string | null
          reminder_minutes: number | null
          start_time: string
          status: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          end_time: string
          id?: string
          location?: string | null
          meeting_id?: string | null
          priority?: string | null
          reminder_minutes?: number | null
          start_time: string
          status?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          end_time?: string
          id?: string
          location?: string | null
          meeting_id?: string | null
          priority?: string | null
          reminder_minutes?: number | null
          start_time?: string
          status?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_meeting_fk"
            columns: ["meeting_id"]
            isOneToOne: true
            referencedRelation: "meetings"
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
          business_description: string | null
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
          created_at: string
          credit_limit: number | null
          customer_number: string | null
          data_protection_notes: string | null
          diversity_certifications: string[] | null
          email: string | null
          employees_count: number | null
          established_year: number | null
          facebook: string | null
          founding_date: string | null
          gdpr_consent_date: string | null
          iban: string | null
          id: string
          industry: string | null
          instagram: string | null
          key_contacts: string[] | null
          languages_supported: string[] | null
          last_contact: string | null
          legal_form: string | null
          linkedin: string | null
          location: string | null
          main_contact_person: string | null
          marketing_consent: boolean | null
          meeting_preferences: string | null
          name: string
          newsletter_subscription: boolean | null
          notes: string | null
          organization: string | null
          organization_id: string | null
          parent_company: string | null
          partnership_level: string | null
          payment_terms: string | null
          phone: string | null
          preferred_communication_method: string | null
          priority: string | null
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
          time_zone: string | null
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
          business_description?: string | null
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
          created_at?: string
          credit_limit?: number | null
          customer_number?: string | null
          data_protection_notes?: string | null
          diversity_certifications?: string[] | null
          email?: string | null
          employees_count?: number | null
          established_year?: number | null
          facebook?: string | null
          founding_date?: string | null
          gdpr_consent_date?: string | null
          iban?: string | null
          id?: string
          industry?: string | null
          instagram?: string | null
          key_contacts?: string[] | null
          languages_supported?: string[] | null
          last_contact?: string | null
          legal_form?: string | null
          linkedin?: string | null
          location?: string | null
          main_contact_person?: string | null
          marketing_consent?: boolean | null
          meeting_preferences?: string | null
          name: string
          newsletter_subscription?: boolean | null
          notes?: string | null
          organization?: string | null
          organization_id?: string | null
          parent_company?: string | null
          partnership_level?: string | null
          payment_terms?: string | null
          phone?: string | null
          preferred_communication_method?: string | null
          priority?: string | null
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
          time_zone?: string | null
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
          business_description?: string | null
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
          created_at?: string
          credit_limit?: number | null
          customer_number?: string | null
          data_protection_notes?: string | null
          diversity_certifications?: string[] | null
          email?: string | null
          employees_count?: number | null
          established_year?: number | null
          facebook?: string | null
          founding_date?: string | null
          gdpr_consent_date?: string | null
          iban?: string | null
          id?: string
          industry?: string | null
          instagram?: string | null
          key_contacts?: string[] | null
          languages_supported?: string[] | null
          last_contact?: string | null
          legal_form?: string | null
          linkedin?: string | null
          location?: string | null
          main_contact_person?: string | null
          marketing_consent?: boolean | null
          meeting_preferences?: string | null
          name?: string
          newsletter_subscription?: boolean | null
          notes?: string | null
          organization?: string | null
          organization_id?: string | null
          parent_company?: string | null
          partnership_level?: string | null
          payment_terms?: string | null
          phone?: string | null
          preferred_communication_method?: string | null
          priority?: string | null
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
          time_zone?: string | null
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
          topic: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          topic?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          topic?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          timezone?: string
          updated_at?: string
          user_id?: string
          work_location?: string | null
          workdays?: boolean[]
        }
        Relationships: []
      }
      event_planning_checklist_items: {
        Row: {
          created_at: string
          event_planning_id: string
          id: string
          is_completed: boolean
          order_index: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_planning_id: string
          id?: string
          is_completed?: boolean
          order_index?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_planning_id?: string
          id?: string
          is_completed?: boolean
          order_index?: number
          title?: string
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
      event_plannings: {
        Row: {
          background_info: string | null
          confirmed_date: string | null
          contact_person: string | null
          created_at: string
          description: string | null
          id: string
          is_private: boolean
          location: string | null
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
          id?: string
          is_private?: boolean
          location?: string | null
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
          id?: string
          is_private?: boolean
          location?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      knowledge_documents: {
        Row: {
          category: string | null
          content: string | null
          content_html: string | null
          created_at: string
          created_by: string
          id: string
          is_published: boolean | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          content?: string | null
          content_html?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_published?: boolean | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          content?: string | null
          content_html?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_published?: boolean | null
          title?: string
          updated_at?: string
        }
        Relationships: []
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
      meeting_agenda_items: {
        Row: {
          assigned_to: string | null
          carry_over_to_next: boolean | null
          created_at: string
          description: string | null
          file_path: string | null
          id: string
          is_completed: boolean
          is_recurring: boolean
          meeting_id: string
          notes: string | null
          order_index: number
          parent_id: string | null
          result_text: string | null
          task_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          carry_over_to_next?: boolean | null
          created_at?: string
          description?: string | null
          file_path?: string | null
          id?: string
          is_completed?: boolean
          is_recurring?: boolean
          meeting_id: string
          notes?: string | null
          order_index?: number
          parent_id?: string | null
          result_text?: string | null
          task_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          carry_over_to_next?: boolean | null
          created_at?: string
          description?: string | null
          file_path?: string | null
          id?: string
          is_completed?: boolean
          is_recurring?: boolean
          meeting_id?: string
          notes?: string | null
          order_index?: number
          parent_id?: string | null
          result_text?: string | null
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
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          template_items?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          template_items?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sick_days: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          sick_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          sick_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          sick_date?: string
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
          category: string
          created_at: string
          description: string | null
          due_date: string
          id: string
          priority: string
          progress: number | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          description?: string | null
          due_date: string
          id?: string
          priority?: string
          progress?: number | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          priority?: string
          progress?: number | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
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
          started_at: string | null
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
          started_at?: string | null
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
          started_at?: string | null
          updated_at?: string
          user_id?: string
          work_date?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _meeting_default_end: {
        Args: { _date: string }
        Returns: string
      }
      _meeting_default_start: {
        Args: { _date: string }
        Returns: string
      }
      can_access_knowledge_document: {
        Args: { _document_id: string; _user_id: string }
        Returns: boolean
      }
      can_edit_knowledge_document: {
        Args: { _document_id: string; _user_id: string }
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
      create_default_checklist_items: {
        Args: { planning_id: string }
        Returns: undefined
      }
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
      get_daily_hours: {
        Args: { _user_id: string }
        Returns: number
      }
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
      get_user_role_level: {
        Args: { _user_id: string }
        Returns: number
      }
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
      is_admin: {
        Args: { _user_id: string }
        Returns: boolean
      }
      is_admin_of: {
        Args: { employee: string }
        Returns: boolean
      }
      is_message_recipient: {
        Args: { message_id_param: string; user_id_param: string }
        Returns: boolean
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
      sync_birthday_appointments: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      app_role: "abgeordneter" | "bueroleitung" | "mitarbeiter" | "praktikant"
      leave_status: "pending" | "approved" | "rejected"
      leave_type: "vacation" | "sick" | "other"
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
      leave_status: ["pending", "approved", "rejected"],
      leave_type: ["vacation", "sick", "other"],
    },
  },
} as const
