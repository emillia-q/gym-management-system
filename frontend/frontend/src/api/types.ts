// frontend/src/api/types.ts

export type Role =
  | "CLIENT"
  | "RECEPTIONIST"
  | "MANAGER"
  | "PERSONAL_TRAINER"
  | "INSTRUCTOR"
  | string;

// ---- Auth ----
export type LoginRequestDto = {
  email: string;
  password: string;
};

export type LoginResponseDto = {
  user_id: number;
  role: Role;
  first_name?: string;
};

// ---- Schedule ----
export type GroupClassDto = {
  id_c?: number;
  id?: number;
  name?: string;
  class_name?: string;

  start_time?: string;
  start_date?: string;
  end_date?: string;

  room?: string;
  max_capacity?: number;
};

export type BookClassRequestDto = {
  client_id: number;
  group_class_id: number;
};

export type BookClassResponseDto = {
  status: string;
  message: string;
  booking_id: number;
};

export type MyBookingDto = {
  booking_id: number;
  class_name: string;
  start_time?: string;
  start_date?: string;
  room?: string;
};
