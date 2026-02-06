// frontend/src/api/mappers/schedule.ts

// To są "luźne" typy z backendu – mogą mieć różne nazwy pól
export type ApiGroupClass = {
    id_c?: number;
    id?: number;
    name?: string;
    class_name?: string;
    room?: string;
    start_date?: string;
    start_time?: string;
    end_date?: string;
    max_capacity?: number;
};

export type UiGroupClass = {
    id: number;
    name: string;
    room: string;
    startDate: string | null;
    endDate: string | null;
    maxCapacity: number | null;
};

export function mapGroupClass(c: ApiGroupClass): UiGroupClass {
    const id = Number(c.id_c ?? c.id ?? 0);

    return {
        id,
        name: c.name ?? c.class_name ?? "-",
        room: c.room ?? "-",
        startDate: c.start_date ?? c.start_time ?? null,
        endDate: c.end_date ?? null,
        maxCapacity: c.max_capacity ?? null,
    };
}

// ---- Bookings (Moje rezerwacje) ----
export type ApiBooking = {
    booking_id?: number;
    id?: number;
    class_name?: string;
    name?: string;
    room?: string;
    start_time?: string;
    start_date?: string;
};

export type UiBooking = {
    id: number;
    className: string;
    room: string;
    startDate: string | null;
};

export function mapBooking(b: ApiBooking): UiBooking {
    const id = Number(b.booking_id ?? b.id ?? 0);
    return {
        id,
        className: b.class_name ?? b.name ?? "-",
        room: b.room ?? "-",
        startDate: b.start_date ?? b.start_time ?? null,
    };
}
