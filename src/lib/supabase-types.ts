export type AppRole = 'owner' | 'boat_admin' | 'receptionist';

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  language_preference: string;
  created_at: string;
  updated_at: string;
}

export interface Boat {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  max_rooms: number;
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: string;
  boat_id: string;
  room_number: number;
  status: 'available' | 'occupied' | 'maintenance' | 'do_not_disturb';
  qr_code_data: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface UserBoatAssignment {
  id: string;
  user_id: string;
  boat_id: string;
  created_at: string;
}
