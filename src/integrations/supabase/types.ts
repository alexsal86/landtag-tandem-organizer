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
          call_log_id: string | null
          category: string | null
          contact_id: string | null
          created_at: string
          description: string | null
          end_time: string
          id: string
          is_all_day: boolean
          location: string | null
          meeting_details: string | null
          meeting_id: string | null
          meeting_link: string | null
          poll_id: string | null
          priority: string | null
          reminder_minutes: number | null
          start_time: string
          status: string | null
          tenant_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          call_log_id?: string | null
          category?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          end_time: string
          id?: string
          is_all_day?: boolean
          location?: string | null
          meeting_details?: string | null
          meeting_id?: string | null
          meeting_link?: string | null
          poll_id?: string | null
          priority?: string | null
          reminder_minutes?: number | null
          start_time: string
          status?: string | null
          tenant_id: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          call_log_id?: string | null
          category?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          end_time?: string
          id?: string
          is_all_day?: boolean
          location?: string | null
          meeting_details?: string | null
          meeting_id?: string | null
          meeting_link?: string | null
          poll_id?: string | null
          priority?: string | null
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
            foreignKeyName: "appointments_meeting_fk"
            columns: ["meeting_id"]
            isOneToOne: true
            referencedRelation: "meetings"
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
          tenant_id: string
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id: string
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
          tenant_id: string
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
          tenant_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_tenant_id_fkey"
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
          last_sync: string | null
          name: string
          sync_enabled: boolean
          sync_interval: number
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
          last_sync?: string | null
          name: string
          sync_enabled?: boolean
          sync_interval?: number
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
          last_sync?: string | null
          name?: string
          sync_enabled?: boolean
          sync_interval?: number
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
          title?: string
          updated_at?: string
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
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
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
          category: string | null
          color: string | null
          content: string
          created_at: string
          id: string
          is_pinned: boolean | null
          tags: string[] | null
          task_id: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          color?: string | null
          content: string
          created_at?: string
          id?: string
          is_pinned?: boolean | null
          tags?: string[] | null
          task_id?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          color?: string | null
          content?: string
          created_at?: string
          id?: string
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
      user_notification_settings: {
        Row: {
          created_at: string
          email_enabled: boolean
          id: string
          is_enabled: boolean
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
      _meeting_default_end: {
        Args: { _date: string }
        Returns: string
      }
      _meeting_default_start: {
        Args: { _date: string }
        Returns: string
      }
      auto_archive_completed_preparations: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      can_access_knowledge_document: {
        Args: { _document_id: string; _user_id: string }
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
      create_default_checklist_items: {
        Args:
          | { planning_id: string }
          | { planning_id: string; template_id_param?: string }
        Returns: undefined
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
      generate_decision_participant_token: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_participant_token: {
        Args: Record<PropertyKey, never>
        Returns: string
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
      get_user_primary_tenant_id: {
        Args: { _user_id: string }
        Returns: string
      }
      get_user_role_level: {
        Args: { _user_id: string }
        Returns: number
      }
      get_user_tenant_ids: {
        Args: { _user_id: string }
        Returns: string[]
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
      is_tenant_admin: {
        Args: { _tenant_id: string; _user_id: string }
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
