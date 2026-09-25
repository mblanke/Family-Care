import SwiftUI

struct MedicationsView: View {
    @Environment(AppSession.self) private var session
    @Environment(BannerCenter.self) private var banners
    @State private var people = PeopleStore()
    @State private var regimen: Regimen?
    @State private var activeSheet: MedSheet?

    enum MedSheet: Identifiable {
        case add
        case dose(Med)
        case stop(Med)
        case note

        var id: String {
            switch self {
            case .add: return "add"
            case .dose(let med): return "dose-\(med.id)"
            case .stop(let med): return "stop-\(med.id)"
            case .note: return "note"
            }
        }
    }

    private static let slots: [(key: String, label: String, icon: String)] = [
        ("morning", "Morning", "sun.max.fill"),
        ("noon", "Noon", "clock.fill"),
        ("evening", "Evening", "moon.fill"),
        ("bedtime", "Bedtime", "bed.double.fill"),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                ScreenHeading(text: "Medications")

                PersonPicker(people: people.people, selected: $people.selected)

                Text("A personal record to share with your doctor or pharmacist. Not medical advice.")
                    .fhFont(.base)
                    .foregroundStyle(FH.inkSoft)

                if let regimen {
                    let active = regimen.regimen.filter(\.active)
                    if active.isEmpty {
                        Card {
                            Text("No medications recorded\(people.selected.map { " for \($0.name)" } ?? "").")
                                .fhFont(.big)
                                .foregroundStyle(FH.inkSoft)
                        }
                    }
                    ForEach(Self.slots, id: \.key) { slot in
                        let meds = active.filter { $0.slot == slot.key }
                        if !meds.isEmpty {
                            Card(title: slot.label, icon: slot.icon) {
                                ForEach(meds) { med in
                                    medRow(med)
                                }
                            }
                        }
                    }

                    if session.isAdmin {
                        HStack(spacing: 12) {
                            BigButton(title: "Add medication", icon: "plus", fullWidth: false) { activeSheet = .add }
                            BigButton(title: "Add a note", icon: "note.text", variant: .secondary, fullWidth: false) {
                                activeSheet = .note
                            }
                        }
                        if let person = people.selected {
                            ScanReviewView(person: person) { await load() }
                        }
                    }

                    Card(title: "Change history", icon: "clock.fill") {
                        if regimen.history.isEmpty {
                            Text("No changes recorded yet.").fhFont(.base).foregroundStyle(FH.inkSoft)
                        }
                        ForEach(regimen.history) { change in
                            HStack(alignment: .top, spacing: 12) {
                                RoundedRectangle(cornerRadius: 2)
                                    .fill(FH.brand.opacity(0.6))
                                    .frame(width: 4)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(Format.longDate(change.recordedAt)).fhFont(.base, weight: .bold)
                                    Text(change.summary).fhFont(.base)
                                    if let reason = change.reason, !reason.isEmpty {
                                        Text("(\(reason))").fhFont(.base).foregroundStyle(FH.inkSoft).italic()
                                    }
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
        .groundBackground()
        .task { await people.load(); await load() }
        .onChange(of: people.selected?.id) { Task { await load() } }
        .refreshable { await load() }
        .sheet(item: $activeSheet) { sheet in
            switch sheet {
            case .add:
                MedFormSheet(person: people.selected) { await load() }
            case .dose(let med):
                DoseChangeSheet(med: med) { await load() }
            case .stop(let med):
                StopMedSheet(med: med) { await load() }
            case .note:
                MedNoteSheet(person: people.selected) { await load() }
            }
        }
    }

    private func medRow(_ med: Med) -> some View {
        let details = [
            med.purpose.flatMap { $0.isEmpty ? nil : "For \($0)" },
            med.prescriber.flatMap { $0.isEmpty ? nil : "Prescribed by \($0)" },
        ].compactMap { $0 }.joined(separator: " · ")
        return Well {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                Text(med.name).fhFont(.big, weight: .bold)
                Chip(text: med.dose)
                if med.prn {
                    Text("as needed").fhFont(.base).foregroundStyle(FH.inkSoft)
                }
            }
            if !details.isEmpty {
                Text(details).fhFont(.base).foregroundStyle(FH.inkSoft)
            }
            if session.isAdmin {
                HStack(spacing: 10) {
                    BigButton(title: "Change dose", variant: .secondary, fullWidth: false) { activeSheet = .dose(med) }
                    BigButton(title: "Stop medication", variant: .secondary, fullWidth: false) { activeSheet = .stop(med) }
                }
            }
        }
    }

    private func load() async {
        guard let person = people.selected else { return }
        // Keep stale data on network failure, like the web does.
        if let data: Regimen = try? await APIClient.shared.get("/api/people/\(person.id)/medications") {
            regimen = data
        } else if regimen == nil {
            banners.error("Couldn't load the medication record. Please try again.")
        }
    }
}

// MARK: - Admin sheets (native replacements for the web's dialogs)

struct MedFormSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(BannerCenter.self) private var banners
    var person: Person?
    var onSaved: () async -> Void

    @State private var name = ""
    @State private var dose = ""
    @State private var slot = "morning"
    @State private var purpose = ""
    @State private var prescriber = ""
    @State private var prn = false
    @State private var errorText: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Name", text: $name)
                    TextField("Dose, as written on the label", text: $dose)
                    Picker("When it's taken", selection: $slot) {
                        Text("Morning").tag("morning")
                        Text("Noon").tag("noon")
                        Text("Evening").tag("evening")
                        Text("Bedtime").tag("bedtime")
                    }
                    Toggle("As needed", isOn: $prn).tint(FH.brand)
                    TextField("What it's for (optional)", text: $purpose)
                    TextField("Prescriber (optional)", text: $prescriber)
                } footer: {
                    Text("Type the dose exactly as written on the label. The app records it as typed and does not check it.")
                }
                if let errorText { InlineError(text: errorText) }
            }
            .fhFont(.base)
            .scrollContentBackground(.hidden)
            .groundBackground()
            .navigationTitle("Add a medication")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await save() } }
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty
                                  || dose.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }

    private func save() async {
        guard let person else { return }
        do {
            let body = MedIn(name: name, dose: dose, slot: slot,
                             purpose: purpose.isEmpty ? nil : purpose,
                             prescriber: prescriber.isEmpty ? nil : prescriber,
                             prn: prn)
            let _: Med = try await APIClient.shared.post("/api/people/\(person.id)/medications", body)
            banners.confirm("Medication added")
            await onSaved()
            dismiss()
        } catch {
            errorText = "Couldn't save the medication. Please try again."
        }
    }
}

struct DoseChangeSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(BannerCenter.self) private var banners
    var med: Med
    var onSaved: () async -> Void

    @State private var newDose = ""
    @State private var reason = ""
    @State private var errorText: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    LabeledContent("Current dose", value: med.dose)
                    TextField("New dose", text: $newDose)
                    TextField("Reason (optional)", text: $reason)
                } footer: {
                    Text("Type the new dose exactly as written on the label. The app records it as typed and does not check it.")
                }
                if let errorText { InlineError(text: errorText) }
            }
            .fhFont(.base)
            .scrollContentBackground(.hidden)
            .groundBackground()
            .navigationTitle("New dose for \(med.name)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save dose") { Task { await save() } }
                        .disabled(newDose.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }

    private func save() async {
        struct DoseIn: Encodable { var newDose: String; var reason: String? }
        do {
            let _: Med = try await APIClient.shared.post("/api/medications/\(med.id)/dose",
                                                         DoseIn(newDose: newDose, reason: reason.isEmpty ? nil : reason))
            banners.confirm("Dose change recorded")
            await onSaved()
            dismiss()
        } catch {
            errorText = "Couldn't save the dose change. Please try again."
        }
    }
}

struct StopMedSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(BannerCenter.self) private var banners
    var med: Med
    var onSaved: () async -> Void

    @State private var reason = ""
    @State private var errorText: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Reason (optional)", text: $reason)
                } header: {
                    Text("Stop \(med.name)?")
                } footer: {
                    Text("This marks the medication as stopped in the record. Nothing is deleted; it stays in the change history.")
                }
                if let errorText { InlineError(text: errorText) }
            }
            .fhFont(.base)
            .scrollContentBackground(.hidden)
            .groundBackground()
            .navigationTitle("Stop \(med.name)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Mark as stopped") { Task { await save() } }
                }
            }
        }
    }

    private func save() async {
        struct StopIn: Encodable { var reason: String? }
        do {
            let _: Med = try await APIClient.shared.post("/api/medications/\(med.id)/stop",
                                                         StopIn(reason: reason.isEmpty ? nil : reason))
            banners.confirm("\(med.name) marked as stopped")
            await onSaved()
            dismiss()
        } catch {
            errorText = "Couldn't stop the medication. Please try again."
        }
    }
}

struct MedNoteSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(BannerCenter.self) private var banners
    var person: Person?
    var onSaved: () async -> Void

    @State private var summary = ""
    @State private var errorText: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Note", text: $summary, axis: .vertical)
                        .lineLimit(3...6)
                } footer: {
                    Text("Recorded exactly as typed, with today's date.")
                }
                if let errorText { InlineError(text: errorText) }
            }
            .fhFont(.base)
            .scrollContentBackground(.hidden)
            .groundBackground()
            .navigationTitle("Add a note to the history")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save note") { Task { await save() } }
                        .disabled(summary.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }

    private func save() async {
        guard let person else { return }
        struct NoteIn: Encodable { var summary: String }
        do {
            let _: MedChange = try await APIClient.shared.post("/api/people/\(person.id)/medications/note",
                                                               NoteIn(summary: summary))
            banners.confirm("Note added")
            await onSaved()
            dismiss()
        } catch {
            errorText = "Couldn't save the note. Please try again."
        }
    }
}
