import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dgcksmxrtasivctygowk.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnY2tzbXhydGFzaXZjdHlnb3drIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMzUxOTYsImV4cCI6MjA5NjgxMTE5Nn0.QE2oOi3hCgSkJ-fA2vozsuXw2IeBAJ_6MoyHa1S4gYs'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
