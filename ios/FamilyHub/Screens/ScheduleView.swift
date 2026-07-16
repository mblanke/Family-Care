import SwiftUI

struct ScheduleView: View {
    @Environment(AppSession.self) private var session
    @Environment(BannerCenter.self) private var banners
    @State private var week: WeekData?
    @State private var people: [Person] = []
    @State private var showForm = false
    @State private var editing: Occurrence?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if let week {
                    // Driver roll-up
                    Card {
                        Text("🚗 What I'm driving this week").fhFont(.base, weight: .bold)
                        if week.driverRuns.isEmpty {
                            Text("No rides needed this week.").fhFont(.base).foregroundStyle(.secondary)
                        } else {
                            ForEach(week.driverRuns) { run in
                                Text("\(Format.time(run.start)) — \(run.title)\(run.location.map { " · \($0)" } ?? "")")
                                    .fhFont(.base)
                            }
                        }
                    }

                    if session.canEditSchedule {
                        BigButton(title: "Add appointment", icon: "plus") {
                            editing = nil
                            showForm = true
                        }
                    }

                    ForEach(week.days) { day in
                        Text(Format.day(day.date)).fhFont(.base, weight: .bold)
                        if day.appointments.isEmpty {
                            Text("Nothing scheduled").fhFont(.small).foregroundStyle(.secondary)
                        } else {
                            ForEach(day.appointments) { occurrence in
                                if session.canEditSchedule {
                                    Button {
                                        editing = occurrence
                                        showForm = true
                                    } label: {
                                        AppointmentCard(occurrence: occurrence)
                                    }
                                    .buttonStyle(.plain)
                                } else {
                                    AppointmentCard(occurrence: occurrence)
                                }
                            }
                        }
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
        .sheet(isPresented: $showForm) {
            AppointmentFormSheet(people: people, editing: editing) { await load() }
        }
    }

    private func load() async {
        async let weekReq: WeekData? = try? APIClient.shared.get("/api/week")
        async let peopleReq: [Person]? = try? APIClient.shared.get("/api/people")
        if let data = await weekReq { week = data }
        if let list = await peopleReq { people = list }
    }
}

// MARK: - Add/edit appointment (mirrors AppointmentForm.tsx)

struct AppointmentFormSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(BannerCenter.self) private var banners
    var people: [Person]
    var editing: Occurrence?
    var onSaved: () async -> Void

    @State private var title = ""
    @State private var date = Date()
    @State private var startTime = Date()
    @State private var hasEnd = false
    @State private var endTime = Date()
    @State private var location = ""
    @State private var forBoth = true
    @State private var personId: Int?
    @State private var needsRide = false
    @State private var repeatMonthly = false
    @State private var notes = ""
    @State private var errorText: String?
    @State private var confirmCancel = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Title", text: $title)
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                    DatePicker("Start time", selection: $startTime, displayedComponents: .hourAndMinute)
                    Toggle("Has an end time", isOn: $hasEnd)
                    if hasEnd {
                        DatePicker("End time", selection: $endTime, displayedComponents: .hourAndMinute)
                    }
                    TextField("Location (optional)", text: $location)
                }
                Section("Who") {
                    Toggle("Both", isOn: $forBoth)
                    if !forBoth {
                        Picker("Person", selection: $personId) {
                            Text("Choose…").tag(Int?.none)
                            ForEach(people) { person in
                                Text(person.name).tag(Int?.some(person.id))
                            }
                        }
                    }
                }
                Section {
                    Toggle("🚗 Needs a ride", isOn: $needsRide)
                    Toggle("🔁 Repeat monthly", isOn: $repeatMonthly)
                    TextField("Notes (optional)", text: $notes, axis: .vertical)
                }
                if editing != nil {
                    Section {
                        Button("Cancel this appointment", role: .destructive) { confirmCancel = true }
                    }
                }
                if let errorText { Text(errorText).foregroundStyle(FH.danger) }
            }
            .fhFont(.base)
            .navigationTitle(editing == nil ? "Add appointment" : "Edit appointment")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await save() } }
                        .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .onAppear { populate() }
            .confirmationDialog("Cancel this appointment?", isPresented: $confirmCancel, titleVisibility: .visible) {
                Button("Cancel appointment", role: .destructive) { Task { await cancelAppointment() } }
                Button("Keep it", role: .cancel) {}
            }
        }
    }

    private func populate() {
        guard let occurrence = editing else { return }
        title = occurrence.title
        location = occurrence.location ?? ""
        forBoth = occurrence.forBoth
        personId = occurrence.personId
        needsRide = occurrence.needsRide
        notes = occurrence.notes ?? ""
        // Parse the naive wall-clock string into local pickers (same convention back out).
        if let parsed = parseNaive(occurrence.start) {
            date = parsed
            startTime = parsed
        }
        if let end = occurrence.end, let parsed = parseNaive(end) {
            hasEnd = true
            endTime = parsed
        }
    }

    private func parseNaive(_ iso: String) -> Date? {
        let parts = iso.split(separator: "T")
        guard parts.count == 2 else { return nil }
        let d = parts[0].split(separator: "-").compactMap { Int($0) }
        let t = parts[1].split(separator: ":").compactMap { Int($0) }
        guard d.count == 3, t.count >= 2 else { return nil }
        var comps = DateComponents()
        comps.year = d[0]; comps.month = d[1]; comps.day = d[2]
        comps.hour = t[0]; comps.minute = t[1]
        return Calendar.current.date(from: comps)
    }

    private func combined(_ day: Date, _ time: Date) -> String {
        let calendar = Calendar.current
        let d = calendar.dateComponents([.year, .month, .day], from: day)
        let t = calendar.dateComponents([.hour, .minute], from: time)
        return String(format: "%04d-%02d-%02dT%02d:%02d:00", d.year!, d.month!, d.day!, t.hour!, t.minute!)
    }

    private func save() async {
        do {
            let startISO = combined(date, startTime)
            let recurDay = Calendar.current.component(.day, from: date)
            let body = AppointmentIn(
                title: title,
                start: startISO,
                end: hasEnd ? combined(date, endTime) : nil,
                location: location.isEmpty ? nil : location,
                personId: forBoth ? nil : personId,
                forBoth: forBoth,
                needsRide: needsRide,
                notes: notes.isEmpty ? nil : notes,
                recurrence: repeatMonthly ? "monthly" : "none",
                recurDay: repeatMonthly ? recurDay : nil
            )
            if let editing {
                let _: OkOut = try await APIClient.shared.put("/api/appointments/\(editing.appointmentId)", body)
                banners.confirm("Appointment updated")
            } else {
                let _: Occurrence = try await APIClient.shared.post("/api/appointments", body)
                banners.confirm("Appointment added")
            }
            await onSaved()
            dismiss()
        } catch {
            errorText = error.localizedDescription
        }
    }

    private func cancelAppointment() async {
        guard let editing else { return }
        do {
            let _: OkOut = try await APIClient.shared.post("/api/appointments/\(editing.appointmentId)/cancel")
            banners.confirm("Appointment canceled")
            await onSaved()
            dismiss()
        } catch {
            errorText = error.localizedDescription
        }
    }
}
