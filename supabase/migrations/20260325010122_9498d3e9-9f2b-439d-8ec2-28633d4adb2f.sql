
-- Create enums for room type and bed type
CREATE TYPE public.room_type AS ENUM ('room', 'suite');
CREATE TYPE public.bed_type AS ENUM ('king', 'twin');

-- Add columns to rooms table
ALTER TABLE public.rooms 
  ADD COLUMN room_type public.room_type NOT NULL DEFAULT 'room',
  ADD COLUMN bed_type public.bed_type NOT NULL DEFAULT 'king';
