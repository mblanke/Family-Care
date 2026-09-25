import SwiftUI

struct GroceryView: View {
    @Environment(BannerCenter.self) private var banners
    @State private var items: [GroceryItem] = []
    @State private var filter = "all"          // costco | grocery | all
    @State private var newName = ""
    @State private var newStore = "either"     // item store vocab: costco | grocery | either
    @State private var confirmClear = false

    private static let storeLabels = ["costco": "Costco", "grocery": "Grocery store", "either": "Either store"]

    /// In "All", one section per store (empty ones say so); otherwise a single section.
    private var sections: [(key: String, title: String?, items: [GroceryItem])] {
        let sorted = { (group: [GroceryItem]) in
            group.sorted { (!$0.checked && $1.checked) || ($0.checked == $1.checked && $0.id < $1.id) }
        }
        if filter == "all" {
            return ["costco", "grocery", "either"].map { store in
                (store, Self.storeLabels[store], sorted(items.filter { $0.store == store }))
            }
        }
        return [(filter, Self.storeLabels[filter], sorted(items))]
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                ScreenHeading(text: "Grocery")

                SegControl(options: [("costco", "Costco"), ("grocery", "Grocery store"), ("all", "All")],
                           selection: $filter)
                .accessibilityLabel("Which store")

                Card {
                    HStack(spacing: 10) {
                        TextField("Add an item", text: $newName)
                            .fhField()
                            .fhFont(.base)
                            .onSubmit { Task { await add() } }
                            .accessibilityLabel("New grocery item")
                        Picker("Store", selection: $newStore) {
                            Text("Either store").tag("either")
                            Text("Costco").tag("costco")
                            Text("Grocery store").tag("grocery")
                        }
                        .pickerStyle(.menu)
                        .tint(FH.ink)
                        .padding(.horizontal, 8)
                        .frame(minHeight: FH.minTouch)
                        .chrome(radius: FH.fieldRadius)
                        BigButton(title: "Add", icon: "plus", fullWidth: false) {
                            Task { await add() }
                        }
                        .disabled(newName.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }

                ForEach(sections, id: \.key) { section in
                    Card(title: section.title, icon: "cart.fill") {
                        if section.items.isEmpty {
                            Text(filter == "all" ? "Nothing needed." : "Nothing on this list yet.")
                                .fhFont(.base)
                                .foregroundStyle(FH.inkSoft)
                        }
                        ForEach(section.items) { item in
                            row(item)
                        }
                    }
                }

                if items.contains(where: \.checked) {
                    BigButton(title: "Remove checked items", icon: "trash", variant: .secondary) {
                        confirmClear = true
                    }
                }
            }
            .padding(16)
        }
        .groundBackground()
        .task(id: filter) { await load() }
        .refreshable { await load() }
        .confirmationDialog("Remove all checked items?", isPresented: $confirmClear, titleVisibility: .visible) {
            Button("Remove", role: .destructive) { Task { await clearChecked() } }
            Button("Keep them", role: .cancel) {}
        } message: {
            Text("They come off the list for everyone.")
        }
    }

    private func row(_ item: GroceryItem) -> some View {
        HStack(spacing: 14) {
            CheckSquare(done: item.checked, itemName: item.name) {
                Task { await check(item) }
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(item.name)
                    .fhFont(.big)
                    .strikethrough(item.checked)
                    .foregroundStyle(item.checked ? FH.inkSoft : FH.ink)
                if filter != "all" && item.store == "either" {
                    Text("Either store")
                        .fhFont(.small)
                        .foregroundStyle(FH.inkSoft)
                }
            }

            Spacer(minLength: 0)

            if item.checked {
                Text("\(item.qty)")
                    .fhDisplay(.big)
                    .foregroundStyle(FH.inkSoft)
                    .frame(minWidth: 56)
            } else {
                BigStepper(label: item.name,
                           value: Binding(get: { item.qty }, set: { newValue in Task { await setQty(item, newValue) } }),
                           range: 1...999,
                           size: .base,
                           showLabel: false,
                           downLabel: "One fewer \(item.name)",
                           upLabel: "One more \(item.name)")
            }
        }
        .opacity(item.checked ? 0.6 : 1)
    }

    private func load() async {
        var query: [URLQueryItem] = []
        if filter != "all" { query.append(URLQueryItem(name: "store", value: filter)) }
        if let list: [GroceryItem] = try? await APIClient.shared.get("/api/grocery", query: query) {
            items = list
        } else if items.isEmpty {
            banners.error("Couldn't load the list. Please try again.")
        }
    }

    private func add() async {
        let name = newName.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { return }
        struct GroceryIn: Encodable { var name: String; var store: String }
        do {
            let _: GroceryItem = try await APIClient.shared.post("/api/grocery", GroceryIn(name: name, store: newStore))
            newName = ""
            banners.confirm("Added to the list")
            await load()
        } catch {
            banners.error("Couldn't add the item. Please try again.")
        }
    }

    private func check(_ item: GroceryItem) async {
        struct CheckIn: Encodable { var checked: Bool }
        do {
            let _: GroceryItem = try await APIClient.shared.post("/api/grocery/\(item.id)/check", CheckIn(checked: !item.checked))
            await load()
        } catch {
            banners.error("Couldn't save. Please try again.")
        }
    }

    private func setQty(_ item: GroceryItem, _ qty: Int) async {
        guard qty != item.qty else { return }
        struct QtyIn: Encodable { var qty: Int }
        do {
            let _: GroceryItem = try await APIClient.shared.post("/api/grocery/\(item.id)/qty", QtyIn(qty: max(1, qty)))
            await load()
        } catch {
            banners.error("Couldn't save. Please try again.")
        }
    }

    private func clearChecked() async {
        do {
            let _: RemovedOut = try await APIClient.shared.post("/api/grocery/clear-checked")
            banners.confirm("Removed checked items")
            await load()
        } catch {
            banners.error("Couldn't remove the checked items. Please try again.")
        }
    }
}
