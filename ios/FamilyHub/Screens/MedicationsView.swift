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

    private static let slots = [("morning", "Morning"), ("noon", "Noon"), ("evening", "Evening"), ("bedtime", "Bedtime")]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("This is a record to share with a doctor — not medical advice.")
                    .fhFont(.small, weight: .semibold)
                    .foregroundStyle(.secondary)

                PersonPicker(people: people.people, selected: $people.selected)

                if let regimen {
                    ForEach(Self.slots, id: \.0) { slot, label in
                        let meds = regimen.regimen.filter { $0.active && $0.slot == slot }
                        if !meds.isEmpty {
                            Text(label).fhFont(.base, weight: .bold)
                            ForEach(meds) { med in
                                medCard(med)
                            }
                        }
                    }
                    if regimen.regimen.filter(\.active).isEmpty {
                        Card { Text("No current medications recorded.").fhFont(.base) }
                    }

                    if session.isAdmin {
                        BigButton(title: "Add medication", icon: "plus") { activeSheet = .add }
                        BigButton(title: "Add a note", icon: "square.and.pencil", background: Color(.systemGray)) {
                            activeSheet = .note
                        }
                        if let person = people.selected {
                            ScanReviewView(person: person) { await load() }
                        }
                    }

                    if !regimen.history.isEmpty {
                        ScreenHeading(text: "Change history")
                        ForEach(regimen.history) { change in
                            Card {
                                Text(Format.dayAndTime(change.recordedAt))
                                    .fhFont(.small)
                                    .foregroundStyle(.secondary)
                                Text(change.summary).fhFont(.base)
                                if let reason = change.reason, !reason.isEmpty {
                                    Text("Reason: \(reason)").fhFont(.small).foregroundStyle(.secondary)
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

    private func medCard(_ med: Med) -> some View {
        Card {
            Text("\(med.name) — \(med.dose)\(med.prn ? " (as needed)" : "")")
                .fhFont(.base, weight: .bold)
            if let purpose = med.purpose, !purpose.isEmpty {
                Text("For: \(purpose)").fhFont(.small).foregroundStyle(.secondary)
            }
            if let prescriber = med.prescriber, !prescriber.isEmpty {
                Text("Prescriber: \(prescriber)").fhFont(.small).foregroundStyle(.secondary)
            }
            if session.isAdmin {
                HStack(spacing: 10) {
                    Button("Change dose") { activeSheet = .dose(med) }
                        .fhFont(.small, weight: .semibold)
                        .frame(minHeight: FH.minTouch - 16)
                        .buttonStyle(.bordered)
                    Button("Stop", role: .destructive) { activeSheet = .stop(med) }
                        .fhFont(.small, weight: .semibold)
                        .frame(minHeight: FH.minTouch - 16)
                        .buttonStyle(.bordered)
                }
            }
        }
    }

    private func load() async {
        guard let person = people.selected else { return }
        // Keep stale data on network failure, like the web does.
        if let data: Regimen = try? await APIClient.shared.get("/api/people/\(person.id)/medications") {
            regimen = data
        }
    }
}

// MARK: - Admin sheets (native replacements for the web's window.prompt flows)

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
                    TextField("Name (e.g. Amlodipine)", text: $name)
                    TextField("Dose — written exactly as on the label", text: $dose)
                    Picker("Time of day", selection: $slot) {
                        Text("Morning").tag("morning")
                        Text("Noon").tag("noon")
                        Text("Evening").tag("evening")
                        Text("Bedtime").tag("bedtime")
                    }
                    Toggle("As needed (PRN)", isOn: $prn)
                    TextField("Purpose (optional)", text: $purpose)
                    TextField("Prescriber (optional)", text: $prescriber)
                } footer: {
                    Text("The dose is recorded word-for-word. The app never checks or calculates doses.")
                }
                if let errorText { Text(errorText).foregroundStyle(FH.danger) }
            }
            .fhFont(.base)
            .navigationTitle("Add medication")
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
            banners.confirm("Added \(name)")
            await onSaved()
            dismiss()
        } catch {
            errorText = error.localizedDescription
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
                    TextField("New dose — written exactly as on the label", text: $newDose)
                    TextField("Reason (optional)", text: $reason)
                } footer: {
                    Text("Recorded word-for-word in the change history. The app never checks doses.")
                }
                if let errorText { Text(errorText).foregroundStyle(FH.danger) }
            }
            .fhFont(.base)
            .navigationTitle("Change dose — \(med.name)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await save() } }
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
            banners.confirm("Dose updated")
            await onSaved()
            dismiss()
        } catch {
            errorText = error.localizedDescription
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
                    Text("This is recorded in the change history. The medication stays visible there.")
                }
                if let errorText { Text(errorText).foregroundStyle(FH.danger) }
            }
            .fhFont(.base)
            .navigationTitle("Stop \(med.name)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Stop", role: .destructive) { Task { await save() } }
                }
            }
        }
    }

    private func save() async {
        struct StopIn: Encodable { var reason: String? }
        do {
            let _: Med = try await APIClient.shared.post("/api/medications/\(med.id)/stop",
                                                         StopIn(reason: reason.isEmpty ? nil : reason))
            banners.confirm("Stopped \(med.name)")
            await onSaved()
            dismiss()
        } catch {
            errorText = error.localizedDescription
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
                TextField("Note for the record", text: $summary, axis: .vertical)
                    .lineLimit(3...6)
                if let errorText { Text(errorText).foregroundStyle(FH.danger) }
            }
            .fhFont(.base)
            .navigationTitle("Add a note")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await save() } }
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
            errorText = error.localizedDescription
        }
    }
}
