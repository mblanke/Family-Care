import SwiftUI

struct TodayView: View {
    @State private var data: TodayData?
    @State private var loadFailed = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                ScreenHeading(text: "Today")

                if let data {
                    if data.appointments.isEmpty {
                        Card { Text("Nothing scheduled today.").fhFont(.base) }
                    } else {
                        ForEach(data.appointments) { occurrence in
                            AppointmentCard(occurrence: occurrence, rideLabel: "Needs a ride")
                        }
                    }

                    if !data.upcomingBirthdays.isEmpty {
                        ScreenHeading(text: "Coming up")
                        ForEach(data.upcomingBirthdays) { upcoming in
                            Card {
                                Text("🎂 \(upcoming.name)'s birthday in \(upcoming.daysUntil) day\(upcoming.daysUntil == 1 ? "" : "s")"
                                     + (upcoming.turning.map { " (turning \($0))" } ?? ""))
                                    .fhFont(.base)
                            }
                        }
                    }
                } else if loadFailed {
                    Card {
                        Label("Couldn't reach the server.", systemImage: "wifi.slash").fhFont(.base)
                    }
                } else {
                    ProgressView().frame(maxWidth: .infinity)
                }
            }
            .padding(16)
        }
        .background(Color(.systemGroupedBackground))
        .task { await load() }
        .refreshable { await load() }
    }

    private func load() async {
        do {
            data = try await APIClient.shared.get("/api/today")
            loadFailed = false
        } catch {
            if data == nil { loadFailed = true }
        }
    }
}

/// Appointment card: time, title · location, ride badge (Today + Schedule).
struct AppointmentCard: View {
    var occurrence: Occurrence
    var rideLabel: String = "Ride"

    var body: some View {
        Card {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                Text(Format.time(occurrence.start))
                    .fhFont(.base, weight: .bold)
                VStack(alignment: .leading, spacing: 4) {
                    Text(occurrence.title + (occurrence.location.map { " · \($0)" } ?? ""))
                        .fhFont(.base)
                    if let notes = occurrence.notes, !notes.isEmpty {
                        Text(notes).fhFont(.small).foregroundStyle(.secondary)
                    }
                }
                Spacer(minLength: 0)
                if occurrence.needsRide {
                    Text("🚗 \(rideLabel)")
                        .fhFont(.small, weight: .bold)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(FH.brand, in: Capsule())
                        .accessibilityLabel("Needs a ride")
                }
            }
        }
    }
}
