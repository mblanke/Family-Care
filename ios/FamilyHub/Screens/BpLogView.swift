import SwiftUI

struct BpLogView: View {
    @Environment(AppSession.self) private var session
    @Environment(BannerCenter.self) private var banners
    @State private var people = PeopleStore()
    @State private var view: BpView?
    @State private var days = "30"       // 30 | 90 | 0 (all)
    @State private var showPulse = false
    @State private var systolic = 120
    @State private var diastolic = 80
    @State private var pulse = 70
    @State private var showTargetForm = false
    @State private var pdfURL: URL?

    private var trendTitle: String {
        days == "0" ? "Trend, all readings" : "Trend, last \(days) days"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                ScreenHeading(text: "Blood pressure")

                PersonPicker(people: people.people, selected: $people.selected)

                entryCard

                HStack(spacing: 12) {
                    SegControl(options: [("30", "30 days"), ("90", "90 days"), ("0", "All")], selection: $days)
                        .accessibilityLabel("Time range")
                    Toggle(isOn: $showPulse) {
                        Text("Show pulse").fhFont(.base, weight: .bold)
                    }
                    .tint(FH.brand)
                    .fixedSize()
                }

                if let view {
                    Card(title: trendTitle) {
                        BpChartView(readings: view.readings.reversed(), target: view.target, showPulse: showPulse)
                    }

                    exportRow

                    if session.isAdmin {
                        BigButton(title: view.target == nil ? "Set doctor's target" : "Update doctor's target",
                                  icon: "target", variant: .secondary) {
                            showTargetForm = true
                        }
                    }

                    Card(title: "Recent readings") {
                        if view.readings.isEmpty {
                            Text("No readings in this range.").fhFont(.base).foregroundStyle(FH.inkSoft)
                        }
                        ForEach(view.readings) { reading in
                            readingRow(reading)
                        }
                    }
                } else {
                    ProgressView().frame(maxWidth: .infinity)
                }

                Text("A personal record to share with your doctor or pharmacist. Not medical advice.")
                    .fhFont(.small)
                    .foregroundStyle(FH.inkSoft)
                    .frame(maxWidth: .infinity)
                    .multilineTextAlignment(.center)
            }
            .padding(16)
        }
        .groundBackground()
        .task { await people.load(); await load() }
        .onChange(of: people.selected?.id) { Task { await load() } }
        .task(id: days) { await load() }
        .refreshable { await load() }
        .sheet(isPresented: $showTargetForm) {
            BpTargetSheet(person: people.selected, existing: view?.target) { await load() }
        }
    }

    private var entryCard: some View {
        Card(title: "New reading", icon: "heart.fill") {
            // Three steppers side by side when they fit (iPad), stacked on iPhone.
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .bottom, spacing: 20) {
                    steppers
                }
                VStack(spacing: 16) {
                    steppers
                }
            }
            .frame(maxWidth: .infinity)
            BigButton(title: "Save reading", icon: "checkmark", variant: .confirm) {
                Task { await save() }
            }
            .disabled(people.selected == nil)
        }
    }

    @ViewBuilder
    private var steppers: some View {
        BigStepper(label: "Top (systolic)", value: $systolic, range: 60...260)
        BigStepper(label: "Bottom (diastolic)", value: $diastolic, range: 30...180)
        BigStepper(label: "Pulse", value: $pulse, range: 30...220)
    }

    private var exportRow: some View {
        Group {
            if let pdfURL {
                ShareLink(item: pdfURL) {
                    HStack(spacing: 10) {
                        Image(systemName: "printer.fill")
                        Text("Print or save as PDF")
                    }
                    .fhFont(.base, weight: .bold)
                    .foregroundStyle(FH.ink)
                    .padding(.horizontal, 24)
                    .frame(maxWidth: .infinity, minHeight: FH.minTouch)
                    .chrome()
                }
                .buttonStyle(PressableStyle())
            }
        }
    }

    private func readingRow(_ reading: Reading) -> some View {
        Well {
            HStack(alignment: .center, spacing: 14) {
                Chip(text: "\(reading.systolic) / \(reading.diastolic)", display: true)
                if let pulse = reading.pulse {
                    Text("pulse \(pulse)").fhFont(.base).foregroundStyle(FH.inkSoft)
                }
                Spacer(minLength: 0)
                Text(Format.dayAndTime(reading.takenAt))
                    .fhFont(.base)
                    .multilineTextAlignment(.trailing)
            }
            if let status = reading.status {
                // Neutral wording only — never colour, never judgment.
                Text("Top \(status.systolic) range · Bottom \(status.diastolic) range")
                    .fhFont(.small)
                    .foregroundStyle(FH.inkSoft)
            }
            if let note = reading.note, !note.isEmpty {
                Text(note).fhFont(.small).foregroundStyle(FH.inkSoft)
            }
        }
    }

    private func load() async {
        guard let person = people.selected else { return }
        if let data: BpView = try? await APIClient.shared.get("/api/people/\(person.id)/bp",
                                                              query: [URLQueryItem(name: "days", value: days)]) {
            view = data
            pdfURL = BpReport.makePDF(person: person, view: data, days: days)
        } else if view == nil {
            banners.error("Couldn't load the readings. Please try again.")
        }
    }

    private func save() async {
        guard let person = people.selected else { return }
        do {
            let _: Reading = try await APIClient.shared.post("/api/people/\(person.id)/bp",
                                                             BpIn(systolic: systolic, diastolic: diastolic, pulse: pulse))
            banners.confirm("Reading saved")
            await load()
        } catch {
            banners.error("Couldn't save the reading. Please try again.")
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
                    Stepper("Top, low end: \(sysLow)", value: $sysLow, in: 50...250)
                    Stepper("Top, high end: \(sysHigh)", value: $sysHigh, in: 50...260)
                    Stepper("Bottom, low end: \(diaLow)", value: $diaLow, in: 30...150)
                    Stepper("Bottom, high end: \(diaHigh)", value: $diaHigh, in: 30...180)
                    TextField("Doctor or clinic that set this target", text: $doctorLabel)
                } footer: {
                    Text("Enter the range your doctor gave. Each reading is then marked within, above or below that range. The app never decides what is normal.")
                }
                if let errorText { InlineError(text: errorText) }
            }
            .fhFont(.base)
            .scrollContentBackground(.hidden)
            .groundBackground()
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
            errorText = "Couldn't save the target. Please try again."
        }
    }
}
