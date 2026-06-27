export type AppointmentStatus = 'booked' | 'completed' | 'cancelled' | 'no_show'

export type AppointmentStatusOption = {
  value: AppointmentStatus
  label: string
}

export type AppointmentSummary = {
  total: number
  booked: number
  completed: number
  cancelled: number
  noShow: number
}

export const APPOINTMENT_STATUS_OPTIONS: AppointmentStatusOption[]
export function normalizeAppointmentStatus(value: unknown): string
export function isValidAppointmentStatus(value: unknown): boolean
export function getAppointmentStatusLabel(value: unknown): string
export function formatAppointmentCustomerName(appointment?: Record<string, unknown>): string
export function formatAppointmentVehicleName(vehicle?: Record<string, unknown> | null, fallbackId?: string): string
export function buildAppointmentSearchText(appointment?: Record<string, unknown>, vehicle?: Record<string, unknown> | null): string
export function vehicleMatchesAppointmentSearch(appointment: Record<string, unknown>, vehicle: Record<string, unknown> | null, query: unknown): boolean
export function groupAppointmentsByDate<T extends Record<string, unknown>>(appointments?: T[], timeZone?: string): Array<{ dateKey: string; appointments: T[] }>
export function buildAppointmentDateRange(range?: string, nowIso?: string): { from: string; to: string }
export function buildAppointmentSummary(appointments?: Array<Record<string, unknown>>): AppointmentSummary
export function buildAdminAppointmentPayload(input?: Record<string, unknown>): Record<string, unknown>
export function buildAdminAppointmentUpdatePayload(input?: Record<string, unknown>): Record<string, unknown>
