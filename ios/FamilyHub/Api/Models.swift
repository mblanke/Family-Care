import Foundation

// DTOs mirror frontend/src/api/types.ts and backend/app/schemas/*.
// All datetimes stay as verbatim strings — the server sends naive ISO and the
// web client renders without re-zoning (frontend/src/lib/format.ts). We do the same.

enum Role: String, Codable {
    case admin, family, parent
}

struct User: Codable, Identifiable {
    var id: Int
    var username: String
    var displayName: String
    var role: Role
    var fontScale: String
    var personId: Int?
}

struct MeOut: Codable {
    var user: User
    var appDisplayName: String
}

struct LoginOut: Codable {
    var user: User
}

struct Person: Codable, Identifiable, Hashable {
    var id: Int
    var name: String
    var slug: String
    var color: String
}

struct Occurrence: Codable, Identifiable, Hashable {
    var appointmentId: Int
    var title: String
    var start: String
    var end: String?
    var location: String?
    var personId: Int?
    var forBoth: Bool
    var needsRide: Bool
    var notes: String?

    // Recurring appointments expand into several occurrences with the same
    // appointment_id, so identity needs the start too.
    var id: String { "\(appointmentId)-\(start)" }
}

struct TodayData: Codable {
    var appointments: [Occurrence]
    var ridesToday: [Occurrence]
    var openTodos: [Todo]
    var upcomingBirthdays: [Upcoming]
}

struct WeekDay: Codable, Identifiable {
    var date: String
    var appointments: [Occurrence]
    var id: String { date }
}

struct WeekData: Codable {
    var weekStart: String
    var days: [WeekDay]
    var driverRuns: [Occurrence]
}

struct AppointmentIn: Codable {
    var title: String
    var start: String
    var end: String?
    var location: String?
    var personId: Int?
    var forBoth: Bool = false
    var needsRide: Bool = false
    var notes: String?
    var recurrence: String = "none"
    var recurDay: Int?
}

struct Todo: Codable, Identifiable {
    var id: Int
    var text: String
    var done: Bool
    var assigneeId: Int?
    var doneAt: String?
}

struct GroceryItem: Codable, Identifiable {
    var id: Int
    var name: String
    var store: String   // costco | grocery | either — distinct from the filter's "all"
    var qty: Int
    var checked: Bool
}

struct Birthday: Codable, Identifiable {
    var id: Int
    var name: String
    var month: Int
    var day: Int
    var year: Int?
}

struct Upcoming: Codable, Identifiable {
    var birthdayId: Int
    var name: String
    var nextDate: String
    var daysUntil: Int
    var turning: Int?
    var id: Int { birthdayId }
}

struct Med: Codable, Identifiable {
    var id: Int
    var name: String
    var dose: String    // free text, never interpreted
    var slot: String    // morning | noon | evening | bedtime
    var purpose: String?
    var prescriber: String?
    var prn: Bool
    var active: Bool
    var packPickup: String?
}

struct MedChange: Codable, Identifiable {
    var id: Int
    var changeType: String  // added | stopped | dose_changed | note
    var summary: String
    var reason: String?
    var recordedAt: String
    var medicationId: Int?
}

struct Regimen: Codable {
    var regimen: [Med]
    var history: [MedChange]
}

struct MedIn: Codable {
    var name: String
    var dose: String
    var slot: String = "morning"
    var purpose: String?
    var prescriber: String?
    var prn: Bool = false
    var reason: String?
    var scanId: String?
    var keepPhoto: Bool = false
}

struct ReadingStatus: Codable, Hashable {
    var systolic: String  // within | above | below
    var diastolic: String
}

struct Reading: Codable, Identifiable {
    var id: Int
    var systolic: Int
    var diastolic: Int
    var pulse: Int?
    var takenAt: String
    var note: String?
    var status: ReadingStatus?
}

struct BpTarget: Codable {
    var sysLow: Int
    var sysHigh: Int
    var diaLow: Int
    var diaHigh: Int
    var doctorLabel: String
}

struct BpView: Codable {
    var readings: [Reading]
    var target: BpTarget?
}

struct BpIn: Codable {
    var systolic: Int
    var diastolic: Int
    var pulse: Int?
    var takenAt: String?
    var note: String?
}

struct Contact: Codable, Identifiable {
    var id: Int
    var name: String
    var role: String    // doctor | paramedics | occupational_therapist | pharmacist | other
    var phone: String
    var address: String?
    var notes: String?
    var personId: Int?
    var isEmergency: Bool
}

struct ContactIn: Codable {
    var name: String
    var role: String
    var phone: String
    var address: String?
    var notes: String?
    var personId: Int?
    var isEmergency: Bool = false
}

struct Account: Codable, Identifiable {
    var id: Int
    var username: String
    var displayName: String
    var role: Role
    var personId: Int?
    var isActive: Bool
}

struct AccountIn: Codable {
    var username: String
    var password: String
    var displayName: String
    var role: String
    var personId: Int?
}

struct ScanCandidate: Codable, Identifiable, Hashable {
    var name: String?
    var dose: String?
    var slot: String?
    var prescriber: String?
    var id: String { "\(name ?? "")|\(dose ?? "")|\(slot ?? "")|\(prescriber ?? "")" }
}

struct ScanResult: Codable {
    var scanId: String
    var candidates: [ScanCandidate]
}

struct OkOut: Codable { var ok: Bool }
struct RemovedOut: Codable { var removed: Int }
