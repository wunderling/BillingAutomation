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
                    duration_minutes_normalized: number | null
                    service_code: 'SESSION_50' | 'SESSION_90' | null
                    status: 'pending_review' | 'approved' | 'rejected' | 'needs_review_duration' | 'unmatched_customer' | 'posted_to_qbo' | 'error'
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
                    duration_minutes_normalized?: number | null
                    service_code?: 'SESSION_50' | 'SESSION_90' | null
                    status?: 'pending_review' | 'approved' | 'rejected' | 'needs_review_duration' | 'unmatched_customer' | 'posted_to_qbo' | 'error'
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
        }
    }
}
