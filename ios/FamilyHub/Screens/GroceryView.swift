import SwiftUI

struct GroceryView: View {
    @Environment(BannerCenter.self) private var banners
    @State private var items: [GroceryItem] = []
    @State private var filter = "all"          // costco | grocery | all
    @State private var newName = ""
    @State private var newStore = "either"     // item store vocab: costco | grocery | either
    @State private var confirmClear = false

    private static let storeLabels = ["costco": "Costco", "grocery": "Grocery", "either": "Either"]

    /// In "All", group by store section; otherwise a single section.
    private var sections: [(title: String?, items: [GroceryItem])] {
        let sorted = { (group: [GroceryItem]) in
            group.sorted { (!$0.checked && $1.checked) || ($0.checked == $1.checked && $0.id < $1.id) }
        }
        if filter == "all" {
            return ["costco", "grocery", "either"].compactMap { store in
                let group = items.filter { $0.store == store }
                return group.isEmpty ? nil : (Self.storeLabels[store], sorted(group))
            }
        }
        return [(nil, sorted(items))]
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                SegControl(options: [("costco", "Costco"), ("grocery", "Grocery"), ("all", "All")],
                           selection: $filter)

                HStack(spacing: 10) {
                    TextField("Add an item…", text: $newName)
                        .textFieldStyle(.roundedBorder)
                        .fhFont(.base)
                        .onSubmit { Task { await add() } }
                    Picker("Store", selection: $newStore) {
                        Text("Either").tag("either")
                        Text("Costco").tag("costco")
                        Text("Grocery").tag("grocery")
                    }
                    .pickerStyle(.menu)
                    .frame(minHeight: FH.minTouch)
                    Button {
                        Task { await add() }
                    } label: {
                        Label("Add", systemImage: "plus")
                            .fhFont(.base, weight: .semibold)
                            .foregroundStyle(.white)
                            .padding(.horizontal, 16)
                            .frame(minHeight: FH.minTouch)
                            .background(FH.brand, in: RoundedRectangle(cornerRadius: 14))
                    }
                    .buttonStyle(.plain)
                    .disabled(newName.trimmingCharacters(in: .whitespaces).isEmpty)
                }

                ForEach(sections, id: \.title) { section in
                    if let title = section.title {
                        Text(title).fhFont(.base, weight: .bold).foregroundStyle(.secondary)
                    }
                    ForEach(section.items) { item in
                        row(item)
                    }
                }
                if items.isEmpty {
                    Card { Text("List is empty.").fhFont(.base) }
                }

                if items.contains(where: \.checked) {
                    BigButton(title: "Clear checked items", icon: "trash", background: FH.danger) {
                        confirmClear = true
                    }
                }
            }
            .padding(16)
        }
        .background(Color(.systemGroupedBackground))
        .task(id: filter) { await load() }
        .refreshable { await load() }
        .confirmationDialog("Clear all checked items?", isPresented: $confirmClear, titleVisibility: .visible) {
            Button("Clear checked", role: .destructive) { Task { await clearChecked() } }
            Button("Keep them", role: .cancel) {}
        }
    }

    private func row(_ item: GroceryItem) -> some View {
        Card {
            HStack(spacing: 14) {
                Button {
                    Task { await check(item) }
                } label: {
                    Image(systemName: item.checked ? "checkmark.square.fill" : "square")
                        .fhFont(.big, weight: .bold)
                        .foregroundStyle(item.checked ? FH.confirm : FH.ink)
                        .frame(width: FH.minTouch, height: FH.minTouch)
                        .background(Color(.systemGray6), in: RoundedRectangle(cornerRadius: 12))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(item.checked ? "Uncheck \(item.name)" : "Check \(item.name)")

                VStack(alignment: .leading, spacing: 2) {
                    Text(item.name)
                        .fhFont(.base)
                        .strikethrough(item.checked)
                    if filter != "all" || item.store == "either" {
                        Text(Self.storeLabels[item.store] ?? item.store)
                            .fhFont(.small)
                            .foregroundStyle(.secondary)
                    }
                }

                Spacer(minLength: 0)

                qtyStepper(item)
            }
            .opacity(item.checked ? 0.5 : 1)
        }
    }

    private func qtyStepper(_ item: GroceryItem) -> some View {
        HStack(spacing: 8) {
            qtyButton("minus", "Decrease quantity of \(item.name)") { Task { await setQty(item, item.qty - 1) } }
            Text("\(item.qty)")
                .fhFont(.base, weight: .bold)
                .frame(minWidth: 36)
                .monospacedDigit()
            qtyButton("plus", "Increase quantity of \(item.name)") { Task { await setQty(item, item.qty + 1) } }
        }
    }

    private func qtyButton(_ icon: String, _ a11y: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .fhFont(.base, weight: .bold)
                .frame(width: FH.minTouch, height: FH.minTouch)
                .background(Color(.systemGray6), in: RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(a11y)
    }

    private func load() async {
        var query: [URLQueryItem] = []
        if filter != "all" { query.append(URLQueryItem(name: "store", value: filter)) }
        if let list: [GroceryItem] = try? await APIClient.shared.get("/api/grocery", query: query) {
            items = list
        }
    }

    private func add() async {
        let name = newName.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { return }
        struct GroceryIn: Encodable { var name: String; var store: String }
        do {
            let _: GroceryItem = try await APIClient.shared.post("/api/grocery", GroceryIn(name: name, store: newStore))
            newName = ""
            banners.confirm("Added")
            await load()
        } catch {
            banners.error(error.localizedDescription)
        }
    }

    private func check(_ item: GroceryItem) async {
        struct CheckIn: Encodable { var checked: Bool }
        do {
            let _: GroceryItem = try await APIClient.shared.post("/api/grocery/\(item.id)/check", CheckIn(checked: !item.checked))
            await load()
        } catch {
            banners.error(error.localizedDescription)
        }
    }

    private func setQty(_ item: GroceryItem, _ qty: Int) async {
        struct QtyIn: Encodable { var qty: Int }
        do {
            let _: GroceryItem = try await APIClient.shared.post("/api/grocery/\(item.id)/qty", QtyIn(qty: max(1, qty)))
            await load()
        } catch {
            banners.error(error.localizedDescription)
        }
    }

    private func clearChecked() async {
        do {
            let _: RemovedOut = try await APIClient.shared.post("/api/grocery/clear-checked")
            banners.confirm("Cleared checked items")
            await load()
        } catch {
            banners.error(error.localizedDescription)
        }
    }
}
