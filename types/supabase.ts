export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            sessions: {
                Row: {
                    id: string
                    google_event_id: string
                    google_calendar_id: string | null
                    title_raw: string
                    description_raw: string | null
                    student_name: string | null
                    start_time: string
                    end_time: string
                    duration_minutes_raw: number
                    billing_units: number | null
                    service_category: string | null
                    confidence: string | null
                    service_code: 'SESSION_50' | 'SESSION_90' | null
                    status: 'pending_review' | 'approved' | 'rejected' | 'needs_review_duration' | 'unmatched_client' | 'posted_to_qbo' | 'error'
                    qbo_customer_id: string | null
                    qbo_customer_name: string | null
                    qbo_item_id: string | null
                    qbo_delayed_charge_id: string | null
                    source: string
                    notes: string | null
                    created_at: string | null
                    updated_at: string | null
                }
                Insert: {
                    id?: string
                    google_event_id: string
                    google_calendar_id?: string | null
                    title_raw: string
                    description_raw?: string | null
                    student_name?: string | null
                    start_time: string
                    end_time: string
                    duration_minutes_raw: number
                    billing_units?: number | null
                    service_category?: string | null
                    confidence?: string | null
                    service_code?: 'SESSION_50' | 'SESSION_90' | null
                    status?: 'pending_review' | 'approved' | 'rejected' | 'needs_review_duration' | 'unmatched_client' | 'posted_to_qbo' | 'error'
                    qbo_customer_id?: string | null
                    qbo_customer_name?: string | null
                    qbo_item_id?: string | null
                    qbo_delayed_charge_id?: string | null
                    source?: string
                    notes?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: Partial<Database['public']['Tables']['sessions']['Insert']>
            }
            customer_aliases: {
                Row: {
                    id: string
                    alias: string
                    qbo_customer_id: string
                    qbo_customer_name: string
                    created_at: string | null
                }
                Insert: {
                    id?: string
                    alias: string
                    qbo_customer_id: string
                    qbo_customer_name: string
                    created_at?: string | null
                }
                Update: Partial<Database['public']['Tables']['customer_aliases']['Insert']>
            }
            settings: {
                Row: {
                    id: number
                    keyword_1: string | null
                    keyword_2: string | null
                    qbo_item_id_50: string
                    qbo_item_id_90: string
                    timezone: string | null
                    weekly_post_day: number | null
                    weekly_post_hour: number | null
                    created_at: string | null
                    updated_at: string | null
                }
                Insert: {
                    id?: number
                    keyword_1?: string | null
                    keyword_2?: string | null
                    qbo_item_id_50: string
                    qbo_item_id_90: string
                    timezone?: string | null
                    weekly_post_day?: number | null
                    weekly_post_hour?: number | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: Partial<Database['public']['Tables']['settings']['Insert']>
            }
            runs: {
                Row: {
                    id: string
                    type: string | null
                    status: string | null
                    started_at: string | null
                    ended_at: string | null
                    message: string | null
                    details: Json | null
                }
                Insert: {
                    id?: string
                    type?: string | null
                    status?: string | null
                    started_at?: string | null
                    ended_at?: string | null
                    message?: string | null
                    details?: Json | null
                }
                Update: Partial<Database['public']['Tables']['runs']['Insert']>
            }
            qbo_tokens: {
                Row: {
                    id: number
                    realm_id: string | null
                    access_token: string | null
                    refresh_token: string | null
                    access_token_expires_at: string | null
                    refresh_token_expires_at: string | null
                    updated_at: string | null
                }
                Insert: {
                    id?: number
                    realm_id?: string | null
                    access_token?: string | null
                    refresh_token?: string | null
                    access_token_expires_at?: string | null
                    refresh_token_expires_at?: string | null
                    updated_at?: string | null
                }
                Update: Partial<Database['public']['Tables']['qbo_tokens']['Insert']>
            }
        }
    }
}
