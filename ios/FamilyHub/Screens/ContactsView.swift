import SwiftUI

struct ContactsView: View {
    @Environment(AppSession.self) private var session
    @Environment(BannerCenter.self) private var banners
    @State private var contacts: [Contact] = []
    @State private var showAdd = false
    @State private var pendingDelete: Contact?

    private static let roleLabels: [String: (icon: String, label: String)] = [
        "doctor": ("stethoscope", "Doctor"),
        "paramedics": ("cross.case.fill", "Paramedics"),
        "occupational_therapist": ("figure.walk", "Occupational therapist"),
        "pharmacist": ("pills.fill", "Pharmacist"),
        "other": ("person.fill", "Contact"),
    ]

    private var emergency: [Contact] { contacts.filter(\.isEmergency) }
    private var regular: [Contact] { contacts.filter { !$0.isEmergency } }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                ScreenHeading(text: "Contacts")

                if !emergency.isEmpty {
                    Card(title: "Emergency", icon: "exclamationmark.triangle.fill") {
                        ForEach(emergency) { contact in
                            Well { contactBody(contact) }
                        }
                    }
                    .overlay(RoundedRectangle(cornerRadius: FH.cardRadius, style: .continuous)
                                .strokeBorder(FH.danger.opacity(0.4), lineWidth: 2))
                }
                ForEach(regular) { contact in
                    Card { contactBody(contact) }
                }
                if contacts.isEmpty {
                    Card { Text("No contacts yet.").fhFont(.big).foregroundStyle(FH.inkSoft) }
                }

                if session.canEditSchedule {
                    BigButton(title: "Add a contact", icon: "plus") { showAdd = true }
                }
            }
            .padding(16)
        }
        .groundBackground()
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

    @ViewBuilder
    private func contactBody(_ contact: Contact) -> some View {
        let meta = Self.roleLabels[contact.role] ?? Self.roleLabels["other"]!
        HStack(alignment: .center, spacing: 12) {
            Text(contact.name).fhFont(.big, weight: .bold)
            Spacer(minLength: 0)
            Chip(text: meta.label, systemImage: meta.icon)
        }
        if let notes = contact.notes, !notes.isEmpty {
            Text(notes).fhFont(.base).foregroundStyle(FH.inkSoft)
        }

        BigButton(title: "Call \(contact.name)", icon: "phone.fill", variant: .confirm) {
            let digits = contact.phone.filter { $0.isNumber || $0 == "+" }
            if let url = URL(string: "tel:\(digits)") {
                UIApplication.shared.open(url)
            }
        }
        .accessibilityLabel("Call \(contact.name)")

        if let address = contact.address, !address.isEmpty {
            Button {
                let encoded = address.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? address
                if let url = URL(string: "https://maps.apple.com/?q=\(encoded)") {
                    UIApplication.shared.open(url)
                }
            } label: {
                Label(address, systemImage: "mappin.and.ellipse")
                    .fhFont(.base)
                    .underline()
                    .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
            }
            .buttonStyle(.plain)
            .foregroundStyle(FH.brandDark)
        }

        if session.canEditSchedule {
            BigButton(title: "Remove", icon: "trash", variant: .secondary, fullWidth: false) {
                pendingDelete = contact
            }
            .accessibilityLabel("Remove \(contact.name)")
        }
    }

    private func load() async {
        if let list: [Contact] = try? await APIClient.shared.get("/api/contacts") {
            contacts = list
        } else if contacts.isEmpty {
            banners.error("Couldn't load the contacts. Please try again.")
        }
    }

    private func remove(_ contact: Contact) async {
        do {
            let _: OkOut = try await APIClient.shared.delete("/api/contacts/\(contact.id)")
            banners.confirm("Contact removed")
            await load()
        } catch {
            banners.error("Couldn't remove the contact. Please try again.")
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
                Picker("Who they are", selection: $role) {
                    Text("Doctor").tag("doctor")
                    Text("Paramedics").tag("paramedics")
                    Text("Occupational therapist").tag("occupational_therapist")
                    Text("Pharmacist").tag("pharmacist")
                    Text("Other").tag("other")
                }
                TextField("Phone", text: $phone).keyboardType(.phonePad)
                TextField("Address (optional)", text: $address)
                TextField("Notes (optional)", text: $notes)
                Toggle("Show at the top as an emergency number", isOn: $isEmergency).tint(FH.brand)
                if let errorText { InlineError(text: errorText) }
            }
            .fhFont(.base)
            .scrollContentBackground(.hidden)
            .groundBackground()
            .navigationTitle("Add a contact")
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
            banners.confirm("Contact added")
            await onSaved()
            dismiss()
        } catch {
            errorText = "Couldn't add the contact. Please try again."
        }
    }
}
