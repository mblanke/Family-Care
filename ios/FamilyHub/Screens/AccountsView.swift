import SwiftUI

/// Admin-only account management: create + deactivate (no delete or password
/// change exists in the API — parity with the web).
struct AccountsView: View {
    @Environment(BannerCenter.self) private var banners
    @State private var accounts: [Account] = []
    @State private var people: [Person] = []
    @State private var showAdd = false
    @State private var pendingDeactivate: Account?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                ForEach(accounts) { account in
                    Card {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(account.displayName + (account.isActive ? "" : " (inactive)"))
                                    .fhFont(.base, weight: .bold)
                                    .foregroundStyle(account.isActive ? FH.ink : .secondary)
                                Text("\(account.username) — \(account.role.rawValue)")
                                    .fhFont(.small)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer(minLength: 0)
                            if account.isActive {
                                Button("Deactivate", role: .destructive) {
                                    pendingDeactivate = account
                                }
                                .fhFont(.small, weight: .semibold)
                                .buttonStyle(.bordered)
                                .frame(minHeight: FH.minTouch - 16)
                            }
                        }
                    }
                }

                BigButton(title: "Create account", icon: "person.badge.plus") { showAdd = true }
            }
            .padding(16)
        }
        .background(Color(.systemGroupedBackground))
        .task { await load() }
        .refreshable { await load() }
        .sheet(isPresented: $showAdd) {
            AccountFormSheet(people: people) { await load() }
        }
        .confirmationDialog("Deactivate this account?", isPresented: Binding(
            get: { pendingDeactivate != nil },
            set: { if !$0 { pendingDeactivate = nil } }
        ), titleVisibility: .visible) {
            Button("Deactivate", role: .destructive) {
                if let account = pendingDeactivate { Task { await deactivate(account) } }
            }
            Button("Keep it", role: .cancel) {}
        }
    }

    private func load() async {
        async let accountsReq: [Account]? = try? APIClient.shared.get("/api/accounts")
        async let peopleReq: [Person]? = try? APIClient.shared.get("/api/people")
        if let list = await accountsReq { accounts = list }
        if let list = await peopleReq { people = list }
    }

    private func deactivate(_ account: Account) async {
        do {
            let _: Account = try await APIClient.shared.post("/api/accounts/\(account.id)/deactivate")
            banners.confirm("Deactivated \(account.displayName)")
            await load()
        } catch {
            banners.error(error.localizedDescription)
        }
    }
}

struct AccountFormSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(BannerCenter.self) private var banners
    var people: [Person]
    var onSaved: () async -> Void

    @State private var username = ""
    @State private var password = ""
    @State private var displayName = ""
    @State private var role = "family"
    @State private var personId: Int?
    @State private var errorText: String?

    var body: some View {
        NavigationStack {
            Form {
                TextField("Username", text: $username)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                SecureField("Password", text: $password)
                TextField("Display name", text: $displayName)
                Picker("Role", selection: $role) {
                    Text("Family").tag("family")
                    Text("Parent").tag("parent")
                    Text("Admin").tag("admin")
                }
                if role == "parent" {
                    Picker("Link to", selection: $personId) {
                        Text("No link").tag(Int?.none)
                        ForEach(people) { person in
                            Text(person.name).tag(Int?.some(person.id))
                        }
                    }
                }
                if let errorText { Text(errorText).foregroundStyle(FH.danger) }
            }
            .fhFont(.base)
            .navigationTitle("Create account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") { Task { await save() } }
                        .disabled(username.isEmpty || password.isEmpty || displayName.isEmpty)
                }
            }
        }
    }

    private func save() async {
        do {
            let body = AccountIn(username: username, password: password, displayName: displayName,
                                 role: role, personId: role == "parent" ? personId : nil)
            let _: Account = try await APIClient.shared.post("/api/accounts", body)
            banners.confirm("Created \(displayName)")
            await onSaved()
            dismiss()
        } catch {
            errorText = error.localizedDescription
        }
    }
}
