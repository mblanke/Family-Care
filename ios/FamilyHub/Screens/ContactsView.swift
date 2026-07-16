import SwiftUI

struct ContactsView: View {
    @Environment(AppSession.self) private var session
    @Environment(BannerCenter.self) private var banners
    @State private var contacts: [Contact] = []
    @State private var showAdd = false
    @State private var pendingDelete: Contact?

    private static let roleLabels: [String: (icon: String, label: String)] = [
        "doctor": ("🩺", "Doctor"),
        "paramedics": ("🚑", "Paramedics"),
        "occupational_therapist": ("🧑‍⚕️", "Occupational therapist"),
        "pharmacist": ("💊", "Pharmacist"),
        "other": ("📇", "Contact"),
    ]

    private var emergency: [Contact] { contacts.filter(\.isEmergency) }
    private var regular: [Contact] { contacts.filter { !$0.isEmergency } }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if !emergency.isEmpty {
                    Text("🚨 Emergency").fhFont(.base, weight: .bold)
                    ForEach(emergency) { card($0) }
                }
                ForEach(regular) { card($0) }
                if contacts.isEmpty {
                    Card { Text("No contacts yet.").fhFont(.base) }
                }

                if session.canEditSchedule {
                    BigButton(title: "Add contact", icon: "plus") { showAdd = true }
                }
            }
            .padding(16)
        }
        .background(Color(.systemGroupedBackground))
        .task { await load() }
        .refreshable { await load() }
        .sheet(isPresented: $showAdd) {
            ContactFormSheet { await load() }
        }
        .confirmationDialog("Remove this contact?", isPresented: Binding(
            get: { pendingDelete != nil },
            set: { if !$0 { pendingDelete = nil } }
        ), titleVisibility: .visible) {
            Button("Remove", role: .destructive) {
                if let contact = pendingDelete { Task { await remove(contact) } }
            }
            Button("Keep it", role: .cancel) {}
        }
    }

    private func card(_ contact: Contact) -> some View {
        let meta = Self.roleLabels[contact.role] ?? Self.roleLabels["other"]!
        return Card {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(contact.name).fhFont(.base, weight: .bold)
                    Text("\(meta.icon) \(meta.label)").fhFont(.small).foregroundStyle(.secondary)
                    if let notes = contact.notes, !notes.isEmpty {
                        Text(notes).fhFont(.small).foregroundStyle(.secondary)
                    }
                }
                Spacer(minLength: 0)
                if session.canEditSchedule {
                    Button {
                        pendingDelete = contact
                    } label: {
                        Image(systemName: "trash")
                            .fhFont(.base)
                            .foregroundStyle(FH.danger)
                            .frame(width: FH.minTouch, height: FH.minTouch)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Remove \(contact.name)")
                }
            }

            BigButton(title: "📞 Call \(contact.name)", icon: nil) {
                let digits = contact.phone.filter { $0.isNumber || $0 == "+" }
                if let url = URL(string: "tel:\(digits)") {
                    UIApplication.shared.open(url)
                }
            }

            if let address = contact.address, !address.isEmpty {
                Button {
                    let encoded = address.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? address
                    if let url = URL(string: "https://maps.apple.com/?q=\(encoded)") {
                        UIApplication.shared.open(url)
                    }
                } label: {
                    Label(address, systemImage: "map")
                        .fhFont(.small)
                        .frame(maxWidth: .infinity, minHeight: FH.minTouch, alignment: .leading)
                }
                .buttonStyle(.plain)
                .foregroundStyle(FH.brand)
            }
        }
    }

    private func load() async {
        if let list: [Contact] = try? await APIClient.shared.get("/api/contacts") {
            contacts = list
        }
    }

    private func remove(_ contact: Contact) async {
        do {
            let _: OkOut = try await APIClient.shared.delete("/api/contacts/\(contact.id)")
            await load()
        } catch {
            banners.error(error.localizedDescription)
        }
    }
}

struct ContactFormSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(BannerCenter.self) private var banners
    var onSaved: () async -> Void

    @State private var name = ""
    @State private var role = "doctor"
    @State private var phone = ""
    @State private var address = ""
    @State private var notes = ""
    @State private var isEmergency = false
    @State private var errorText: String?

    var body: some View {
        NavigationStack {
            Form {
                TextField("Name", text: $name)
                Picker("Role", selection: $role) {
                    Text("Doctor").tag("doctor")
                    Text("Paramedics").tag("paramedics")
                    Text("Occupational therapist").tag("occupational_therapist")
                    Text("Pharmacist").tag("pharmacist")
                    Text("Other").tag("other")
                }
                TextField("Phone", text: $phone).keyboardType(.phonePad)
                TextField("Address (optional)", text: $address)
                TextField("Notes (optional)", text: $notes)
                Toggle("🚨 Emergency contact", isOn: $isEmergency)
                if let errorText {
                    Text(errorText).foregroundStyle(FH.danger)
                }
            }
            .fhFont(.base)
            .navigationTitle("Add contact")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await save() } }
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty
                                  || phone.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }

    private func save() async {
        do {
            let body = ContactIn(name: name, role: role, phone: phone,
                                 address: address.isEmpty ? nil : address,
                                 notes: notes.isEmpty ? nil : notes,
                                 personId: nil, isEmergency: isEmergency)
            let _: Contact = try await APIClient.shared.post("/api/contacts", body)
            banners.confirm("Added \(name)")
            await onSaved()
            dismiss()
        } catch {
            errorText = error.localizedDescription
        }
    }
}
