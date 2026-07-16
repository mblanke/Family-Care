import Foundation

/// Mirrors frontend/src/lib/format.ts — the server sends naive ISO strings and
/// the client renders them verbatim, never re-zoning.
enum Format {
    /// "2026-07-16T14:05:00" → "2:05 pm"
    static func time(_ iso: String) -> String {
        guard let tRange = iso.range(of: "T") else { return iso }
        let hms = iso[tRange.upperBound...]
        let parts = hms.split(separator: ":")
        guard parts.count >= 2, let h = Int(parts[0]), let m = Int(parts[1]) else { return iso }
        let ampm = h >= 12 ? "pm" : "am"
        let h12 = ((h + 11) % 12) + 1
        return "\(h12):" + String(format: "%02d", m) + " \(ampm)"
    }

    /// "2026-07-16" or "2026-07-16T…" → "Thursday, July 16"
    static func day(_ iso: String) -> String {
        guard let date = dateComponents(iso) else { return iso }
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, MMMM d"
        return formatter.string(from: date)
    }

    /// "2026-07-16" → "July 16"
    static func shortDay(_ iso: String) -> String {
        guard let date = dateComponents(iso) else { return iso }
        let formatter = DateFormatter()
        formatter.dateFormat = "MMMM d"
        return formatter.string(from: date)
    }

    /// "2026-07-16T14:05:00" → "July 16, 2:05 pm" (for history/reading timestamps)
    static func dayAndTime(_ iso: String) -> String {
        iso.contains("T") ? "\(shortDay(iso)), \(time(iso))" : shortDay(iso)
    }

    /// Builds a Date purely for *formatting* the calendar day named in the string.
    /// The components are interpreted in the current calendar, matching the web's
    /// `new Date(iso)` render-verbatim behavior for date-only strings.
    private static func dateComponents(_ iso: String) -> Date? {
        let dayPart = iso.split(separator: "T").first.map(String.init) ?? iso
        let nums = dayPart.split(separator: "-").compactMap { Int($0) }
        guard nums.count == 3 else { return nil }
        var comps = DateComponents()
        comps.year = nums[0]; comps.month = nums[1]; comps.day = nums[2]
        comps.hour = 12
        return Calendar.current.date(from: comps)
    }

    /// Local date -> "yyyy-MM-dd" (for query params like week start / month bounds).
    static func isoDate(_ date: Date) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
    }

    /// Local date -> naive ISO datetime "yyyy-MM-ddTHH:mm:ss" (appointment wall-clock convention).
    static func isoDateTime(_ date: Date) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
        return String(format: "%04d-%02d-%02dT%02d:%02d:%02d", c.year!, c.month!, c.day!, c.hour!, c.minute!, c.second!)
    }
}
