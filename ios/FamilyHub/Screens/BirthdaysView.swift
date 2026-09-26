import SwiftUI

struct BirthdaysView: View {
    @Environment(AppSession.self) private var session
    @Environment(BannerCenter.self) private var banners
    @State private var birthdays: [Birthday] = []
    @State private var showAdd = false
    @State private var pendingDelete: Birthday?

    private static let months = ["January", "February", "March", "April", "May", "June",
                                 "July", "August", "September", "October", "November", "December"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                ScreenHeading(text: "Birthdays")

                Card {
                    if birthdays.isEmpty {
                        Text("No birthdays yet.").fhFont(.big).foregroundStyle(FH.inkSoft)
                    }
                    ForEach(birthdays) { birthday in
                        Well {
                            HStack(spacing: 14) {
                                Image(systemName: "birthday.cake.fill")
                                    .font(.system(size: 28))
                                    .foregroundStyle(FH.brand)
                                    .accessibilityHidden(true)
                                Text(birthday.name).fhFont(.big, weight: .bold)
                                Spacer(minLength: 0)
                                Text("\(Self.months[max(0, min(11, birthday.month - 1))]) \(birthday.day)"
                                     + (birthday.year.map { ", \($0)" } ?? ""))
                                    .fhFont(.big)
                                if session.canEditSchedule {
                                    IconButton(systemName: "trash", label: "Delete \(birthday.name)") {
                                        pendingDelete = birthday
                                    }
                                }
                            }
                        }
                    }
                }

                if session.canEditSchedule {
                    BigButton(title: "Add a birthday", icon: "plus", fullWidth: false) { showAdd = true }
                }
            }
            .padding(16)
        }
        .groundBackground()
        .task { await load() }
        .refreshable { await load() }
        .sheet(isPresented: $showAdd) {
            BirthdayFormSheet { await load() }
        }
        .confirmationDialog("Remove this birthday?", isPresented: Binding(
            get: { pendingDelete != nil },
            set: { if !$0 { pendingDelete = nil } }
        ), titleVisibility: .visible) {
            Button("Remove", role: .destructive) {
                if let birthday = pendingDelete { Task { await remove(birthday) } }
            }
            Button("Keep it", role: .cancel) {}
        }
    }

    private func load() async {
        if let list: [Birthday] = try? await APIClient.shared.get("/api/birthdays") {
            birthdays = list
        }
    }

    private func remove(_ birthday: Birthday) async {
        do {
            let _: OkOut = try await APIClient.shared.delete("/api/birthdays/\(birthday.id)")
            banners.confirm("Birthday removed")
            await load()
        } catch {
            banners.error("Couldn't remove the birthday. Please try again.")
        }
    }
}

struct BirthdayFormSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(BannerCenter.self) private var banners
    var onSaved: () async -> Void

    @State private var name = ""
    @State private var month = 1
    @State private var day = 1
    @State private var yearText = ""
    @State private var errorText: String?

    var body: some View {
        NavigationStack {
            Form {
                TextField("Name", text: $name)
                Picker("Month", selection: $month) {
                    ForEach(1...12, id: \.self) { m in
                        Text(DateFormatter().monthSymbols[m - 1]).tag(m)
                    }
                }
                Picker("Day", selection: $day) {
                    ForEach(1...31, id: \.self) { d in
                        Text("\(d)").tag(d)
                    }
                }
                TextField("Birth year (optional, shows \"turning N\")", text: $yearText)
                    .keyboardType(.numberPad)
                if let errorText { InlineError(text: errorText) }
            }
            .fhFont(.base)
            .scrollContentBackground(.hidden)
            .groundBackground()
            .navigationTitle("Add a birthday")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await save() } }
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }

    private func save() async {
        struct BirthdayIn: Encodable {
            var name: String
            var month: Int
            var day: Int
            var year: Int?
        }
        do {
            let body = BirthdayIn(name: name, month: month, day: day, year: Int(yearText))
            let _: Birthday = try await APIClient.shared.post("/api/birthdays", body)
            banners.confirm("Birthday added")
            await onSaved()
            dismiss()
        } catch {
            errorText = "Couldn't add the birthday. Please try again."
        }
    }
}
