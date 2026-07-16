import XCTest
@testable import FamilyHub

final class FormatTests: XCTestCase {
    func testTimeRendersVerbatimWallClock() {
        XCTAssertEqual(Format.time("2026-07-16T14:05:00"), "2:05 pm")
        XCTAssertEqual(Format.time("2026-07-16T00:30:00"), "12:30 am")
        XCTAssertEqual(Format.time("2026-07-16T12:00:00"), "12:00 pm")
        XCTAssertEqual(Format.time("2026-07-16T09:07:00"), "9:07 am")
    }

    func testDayFormatsCalendarDate() {
        XCTAssertEqual(Format.shortDay("2026-07-16"), "July 16")
        XCTAssertEqual(Format.shortDay("2026-07-16T14:05:00"), "July 16")
    }

    func testIsoDateRoundTrip() {
        var comps = DateComponents()
        comps.year = 2026; comps.month = 7; comps.day = 4; comps.hour = 9; comps.minute = 30
        let date = Calendar.current.date(from: comps)!
        XCTAssertEqual(Format.isoDate(date), "2026-07-04")
        XCTAssertEqual(Format.isoDateTime(date), "2026-07-04T09:30:00")
    }
}

final class DecodingTests: XCTestCase {
    private var decoder: JSONDecoder {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        return d
    }

    func testDecodesTodayPayload() throws {
        let json = """
        {"appointments":[{"appointment_id":3,"title":"Cardiology","start":"2026-07-16T14:00:00",
          "end":null,"location":"Clinic","person_id":1,"for_both":false,"needs_ride":true,"notes":null}],
         "rides_today":[],"open_todos":[{"id":1,"text":"Pick up mail","done":false,"assignee_id":null,"done_at":null}],
         "upcoming_birthdays":[{"birthday_id":2,"name":"Sam","next_date":"2026-07-20","days_until":4,"turning":70}]}
        """
        let today = try decoder.decode(TodayData.self, from: Data(json.utf8))
        XCTAssertEqual(today.appointments.first?.title, "Cardiology")
        XCTAssertTrue(today.appointments.first?.needsRide ?? false)
        XCTAssertEqual(today.upcomingBirthdays.first?.turning, 70)
        // Datetimes stay verbatim strings.
        XCTAssertEqual(today.appointments.first?.start, "2026-07-16T14:00:00")
    }

    func testDecodesRegimenWithHistory() throws {
        let json = """
        {"regimen":[{"id":1,"name":"Amlodipine","dose":"5 mg","slot":"morning","purpose":null,
          "prescriber":"Dr. Lee","prn":false,"active":true,"pack_pickup":null}],
         "history":[{"id":9,"change_type":"dose_changed","summary":"Amlodipine dose changed from 5 mg to 10 mg",
          "reason":null,"recorded_at":"2026-07-01T15:00:00","medication_id":1}]}
        """
        let regimen = try decoder.decode(Regimen.self, from: Data(json.utf8))
        XCTAssertEqual(regimen.regimen.first?.dose, "5 mg")
        XCTAssertEqual(regimen.history.first?.changeType, "dose_changed")
    }

    func testDecodesBpViewWithTargetAndStatus() throws {
        let json = """
        {"readings":[{"id":1,"systolic":128,"diastolic":78,"pulse":66,"taken_at":"2026-07-15T09:00:00",
          "note":null,"status":{"systolic":"within","diastolic":"within"}}],
         "target":{"sys_low":100,"sys_high":130,"dia_low":60,"dia_high":80,"doctor_label":"Dr. Lee"}}
        """
        let view = try decoder.decode(BpView.self, from: Data(json.utf8))
        XCTAssertEqual(view.target?.doctorLabel, "Dr. Lee")
        XCTAssertEqual(view.readings.first?.status?.systolic, "within")
    }

    func testDecodesScanResult() throws {
        let json = """
        {"scan_id":"abc123","candidates":[{"name":"Metformin","dose":"500 mg","slot":"evening","prescriber":null}]}
        """
        let result = try decoder.decode(ScanResult.self, from: Data(json.utf8))
        XCTAssertEqual(result.scanId, "abc123")
        XCTAssertEqual(result.candidates.first?.name, "Metformin")
    }
}
