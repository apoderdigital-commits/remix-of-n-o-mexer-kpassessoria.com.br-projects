-- Add new lead status values for different sale types
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'sale_consortium';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'sale_financing';