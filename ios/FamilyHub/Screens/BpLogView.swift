import SwiftUI

struct BpLogView: View {
    @Environment(AppSession.self) private var session
    @Environment(BannerCenter.self) private var banners
    @State private var people = PeopleStore()
    @State private var view: BpView?
    @State private var days = "30"       // 30 | 90 | 0 (all)
    @State private var showPulse = false
    @State private var systolic = 120
    @State private var diastolic = 70
    @State private var pulse = 70
    @State private var showTargetForm = false
    @State private var pdfURL: URL?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("A record to share with a doctor — the app never judges what is normal.")
                    .fhFont(.small, weight: .semibold)
                    .foregroundStyle(.secondary)

                PersonPicker(people: people.people, selected: $people.selected)

                entryCard

                SegControl(options: [("30", "30 days"), ("90", "90 days"), ("0", "All")], selection: $days)
                Toggle(isOn: $showPulse) {
                    Text("Show pulse").fhFont(.base)
                }
                .frame(minHeight: FH.minTouch - 16)

                if let view {
                    Card {
                        BpChartView(readings: view.readings.reversed(), target: view.target, showPulse: showPulse)
                    }

                    exportRow

                    if session.isAdmin {
                        BigButton(title: view.target == nil ? "Set doctor's target" : "Update doctor's target",
                                  icon: "target", background: Color(.systemGray)) {
                            showTargetForm = true
                        }
                    }

                    ForEach(view.readings) { reading in
                        readingCard(reading)
                    }
                    if view.readings.isEmpty {
                        Card { Text("No readings in this period.").fhFont(.base) }
                    }
                } else {
                    ProgressView().frame(maxWidth: .infinity)
                }
            }
            .padding(16)
        }
        .background(Color(.systemGroupedBackground))
        .task { await people.load(); await load() }
        .onChange(of: people.selected?.id) { Task { await load() } }
        .task(id: days) { await load() }
        .refreshable { await load() }
        .sheet(isPresented: $showTargetForm) {
            BpTargetSheet(person: people.selected, existing: view?.target) { await load() }
        }
    }

    private var entryCard: some View {
        Card {
            Text("New reading").fhFont(.base, weight: .bold)
            // Stacked rows — three side-by-side steppers don't fit an iPhone.
            BigStepper(label: "Systolic", value: $systolic, range: 60...260)
                .frame(maxWidth: .infinity)
            BigStepper(label: "Diastolic", value: $diastolic, range: 30...180)
                .frame(maxWidth: .infinity)
            BigStepper(label: "Pulse", value: $pulse, range: 30...220)
                .frame(maxWidth: .infinity)
            BigButton(title: "Save reading", icon: "checkmark") {
                Task { await save() }
            }
        }
    }

    private var exportRow: some View {
        Group {
            if let pdfURL {
                ShareLink(item: pdfURL) {
                    Label("Print / Save PDF", systemImage: "printer")
                        .fhFont(.base, weight: .semibold)
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity, minHeight: FH.minTouch)
                        .background(FH.brand, in: RoundedRectangle(cornerRadius: 14))
                }
            }
        }
    }

    private func readingCard(_ reading: Reading) -> some View {
        Card {
            HStack(alignment: .firstTextBaseline) {
                Text("\(reading.systolic)/\(reading.diastolic)")
                    .fhFont(.big, weight: .bold)
                    .monospacedDigit()
                if let pulse = reading.pulse {
                    Text("pulse \(pulse)").fhFont(.small).foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
                Text(Format.dayAndTime(reading.takenAt))
                    .fhFont(.small)
                    .foregroundStyle(.secondary)
            }
            if let status = reading.status {
                // Neutral wording only — never color, never judgment.
                Text("Systolic \(status.systolic) target · diastolic \(status.diastolic) target")
                    .fhFont(.small)
                    .foregroundStyle(.secondary)
            }
            if let note = reading.note, !note.isEmpty {
                Text(note).fhFont(.small).foregroundStyle(.secondary)
            }
        }
    }

    private func load() async {
        guard let person = people.selected else { return }
        if let data: BpView = try? await APIClient.shared.get("/api/people/\(person.id)/bp",
                                                              query: [URLQueryItem(name: "days", value: days)]) {
            view = data
            pdfURL = BpReport.makePDF(person: person, view: data, days: days)
        }
    }

    private func save() async {
        guard let person = people.selected else { return }
        do {
            let _: Reading = try await APIClient.shared.post("/api/people/\(person.id)/bp",
                                                             BpIn(systolic: systolic, diastolic: diastolic, pulse: pulse))
            banners.confirm("Reading saved ✓")
            await load()
        } catch {
            banners.error(error.localizedDescription)
        }
    }
}

// MARK: - Doctor target (admin)

struct BpTargetSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(BannerCenter.self) private var banners
    var person: Person?
    var existing: BpTarget?
    var onSaved: () async -> Void

    @State private var sysLow = 100
    @State private var sysHigh = 130
    @State private var diaLow = 60
    @State private var diaHigh = 80
    @State private var doctorLabel = ""
    @State private var errorText: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Stepper("Systolic low: \(sysLow)", value: $sysLow, in: 50...250)
                    Stepper("Systolic high: \(sysHigh)", value: $sysHigh, in: 50...260)
                    Stepper("Diastolic low: \(diaLow)", value: $diaLow, in: 30...150)
                    Stepper("Diastolic high: \(diaHigh)", value: $diaHigh, in: 30...180)
                    TextField("Doctor's name (shown next to the target)", text: $doctorLabel)
                } footer: {
                    Text("Enter the range exactly as the doctor gave it. It is displayed as \"the doctor's target\", never as the app's judgment.")
                }
                if let errorText { Text(errorText).foregroundStyle(FH.danger) }
            }
            .fhFont(.base)
            .navigationTitle("Doctor's target")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await save() } }
                        .disabled(doctorLabel.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .onAppear {
                if let existing {
                    sysLow = existing.sysLow; sysHigh = existing.sysHigh
                    diaLow = existing.diaLow; diaHigh = existing.diaHigh
                    doctorLabel = existing.doctorLabel
                }
            }
        }
    }

    private func save() async {
        guard let person else { return }
        do {
            let body = BpTarget(sysLow: sysLow, sysHigh: sysHigh, diaLow: diaLow, diaHigh: diaHigh,
                                doctorLabel: doctorLabel)
            let _: BpTarget = try await APIClient.shared.put("/api/people/\(person.id)/bp/target", body)
            banners.confirm("Target saved")
            await onSaved()
            dismiss()
        } catch {
            errorText = error.localizedDescription
        }
    }
}
