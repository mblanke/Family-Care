import SwiftUI

struct TodayView: View {
    @State private var data: TodayData?
    @State private var people: [Person] = []
    @State private var loadFailed = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                ScreenHeading(text: "Today", sub: Format.day(Format.isoDate(Date())))

                if let data {
                    Card(title: "Appointments", icon: "calendar") {
                        if data.appointments.isEmpty {
                            Text("Nothing scheduled today.").fhFont(.big)
                        }
                        ForEach(data.appointments) { occurrence in
                            AppointmentCard(occurrence: occurrence, people: people)
                        }
                    }

                    if !data.openTodos.isEmpty {
                        Card(title: "To do", icon: "checklist") {
                            ForEach(data.openTodos) { todo in
                                HStack(spacing: 14) {
                                    ChromeSurface(radius: 8)
                                        .frame(width: 30, height: 30)
                                        .accessibilityHidden(true)
                                    Text(todo.text).fhFont(.big)
                                }
                            }
                        }
                    }

                    if !data.upcomingBirthdays.isEmpty {
                        Card(title: "Coming up", icon: "birthday.cake.fill") {
                            ForEach(data.upcomingBirthdays) { upcoming in
                                HStack(alignment: .firstTextBaseline, spacing: 14) {
                                    Image(systemName: "birthday.cake.fill")
                                        .font(.system(size: 28))
                                        .foregroundStyle(FH.brand)
                                        .accessibilityHidden(true)
                                    Text(birthdayLine(upcoming)).fhFont(.big)
                                }
                            }
                        }
                    }
                } else if loadFailed {
                    Card {
                        InlineError(text: "Couldn't load today's plan.")
                        BigButton(title: "Try again", icon: "arrow.clockwise", variant: .secondary, fullWidth: false) {
                            Task { await load() }
                        }
                    }
                } else {
                    ProgressView().frame(maxWidth: .infinity)
                }
            }
            .padding(16)
        }
        .groundBackground()
        .task { await load() }
        .refreshable { await load() }
    }

    private func birthdayLine(_ upcoming: Upcoming) -> AttributedString {
        var name = AttributedString("\(upcoming.name)'s birthday")
        name.font = FH.font(.big, weight: .bold, display: false, scale: 1)
        let when = upcoming.daysUntil == 0 ? " is today!" : " \(Format.daysUntil(upcoming.daysUntil))"
        let turning = upcoming.turning.map { " (turning \($0))" } ?? ""
        return name + AttributedString(when + turning)
    }

    private func load() async {
        loadFailed = false
        async let todayReq: TodayData? = try? APIClient.shared.get("/api/today")
        async let peopleReq: [Person]? = try? APIClient.shared.get("/api/people")
        if let today = await todayReq {
            data = today
        } else if data == nil {
            loadFailed = true
        }
        if let list = await peopleReq { people = list }
    }
}

/// Appointment row: chrome time chip, title over location, person chip, ride badge (Today + Schedule).
struct AppointmentCard: View {
    var occurrence: Occurrence
    var people: [Person] = []

    private var who: [Person] {
        occurrence.forBoth ? people : people.filter { $0.id == occurrence.personId }
    }

    var body: some View {
        Well {
            HStack(alignment: .center, spacing: 14) {
                Chip(text: Format.time(occurrence.start), display: true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(occurrence.title).fhFont(.big, weight: .bold)
                    if let location = occurrence.location, !location.isEmpty {
                        Text(location).fhFont(.base).foregroundStyle(FH.inkSoft)
                    }
                    if let notes = occurrence.notes, !notes.isEmpty {
                        Text(notes).fhFont(.small).foregroundStyle(FH.inkSoft)
                    }
                }
                Spacer(minLength: 0)
            }
            if !who.isEmpty || occurrence.needsRide {
                HStack(spacing: 8) {
                    ForEach(who) { person in
                        PersonBadge(person: person)
                    }
                    if occurrence.needsRide {
                        RideBadge()
                    }
                }
            }
        }
    }
}
