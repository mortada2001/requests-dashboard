import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      sales_requests: {
        Row: {
          id: string
          created_at: string
          customer_name: string
          email: string
          phone: string
          product: string
          quantity: number
          status: 'pending' | 'approved' | 'rejected'
          notes: string
        }
        Insert: {
          customer_name: string
          email: string
          phone: string
          product: string
          quantity: number
          notes?: string
        }
        Update: {
          status?: 'pending' | 'approved' | 'rejected'
          notes?: string
        }
      }
      users: {
        Row: {
          id: string
          email: string
          role: 'admin' | 'employee'
          created_at: string
        }
        Insert: {
          email: string
          role: 'admin' | 'employee'
        }
        Update: {
          role?: 'admin' | 'employee'
        }
      }
    }
  }
} 