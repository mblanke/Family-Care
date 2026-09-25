import SwiftUI

struct TodoView: View {
    @Environment(BannerCenter.self) private var banners
    @State private var todos: [Todo] = []
    @State private var newText = ""
    @State private var pendingDelete: Todo?

    private var open: [Todo] { todos.filter { !$0.done } }
    private var done: [Todo] { todos.filter { $0.done } }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                ScreenHeading(text: "To-do")

                Card {
                    HStack(spacing: 10) {
                        TextField("Add an item", text: $newText)
                            .fhField()
                            .fhFont(.base)
                            .onSubmit { Task { await add() } }
                            .accessibilityLabel("New to-do item")
                        BigButton(title: "Add", icon: "plus", fullWidth: false) {
                            Task { await add() }
                        }
                        .disabled(newText.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }

                Card {
                    if open.isEmpty {
                        Text("Nothing on the list. Add something above.")
                            .fhFont(.big)
                            .foregroundStyle(FH.inkSoft)
                    }
                    ForEach(open) { todo in
                        row(todo)
                    }
                }

                if !done.isEmpty {
                    Card(title: "Done", icon: "checkmark") {
                        ForEach(done) { todo in
                            row(todo).opacity(0.8)
                        }
                    }
                }
            }
            .padding(16)
        }
        .groundBackground()
        .task { await load() }
        .refreshable { await load() }
        .confirmationDialog("Remove this item?", isPresented: Binding(
            get: { pendingDelete != nil },
            set: { if !$0 { pendingDelete = nil } }
        ), titleVisibility: .visible) {
            Button("Remove", role: .destructive) {
                if let todo = pendingDelete { Task { await remove(todo) } }
            }
            Button("Keep it", role: .cancel) {}
        }
    }

    private func row(_ todo: Todo) -> some View {
        HStack(spacing: 14) {
            CheckSquare(done: todo.done, itemName: todo.text) {
                Task { await toggle(todo) }
            }
            Text(todo.text)
                .fhFont(.big)
                .strikethrough(todo.done)
                .foregroundStyle(todo.done ? FH.inkSoft : FH.ink)
            Spacer(minLength: 0)
            IconButton(systemName: "trash", label: "Delete \(todo.text)") {
                pendingDelete = todo
            }
        }
    }

    private func load() async {
        if let list: [Todo] = try? await APIClient.shared.get("/api/todos") {
            todos = list
        } else if todos.isEmpty {
            banners.error("Couldn't load the list. Please try again.")
        }
    }

    private func add() async {
        let text = newText.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return }
        struct TodoIn: Encodable { var text: String }
        do {
            let _: Todo = try await APIClient.shared.post("/api/todos", TodoIn(text: text))
            newText = ""
            banners.confirm("Added to the list")
            await load()
        } catch {
            banners.error("Couldn't add the item. Please try again.")
        }
    }

    private func toggle(_ todo: Todo) async {
        struct DoneIn: Encodable { var done: Bool }
        do {
            let _: Todo = try await APIClient.shared.post("/api/todos/\(todo.id)/done", DoneIn(done: !todo.done))
            if !todo.done { banners.confirm("Checked off") }
            await load()
        } catch {
            banners.error("Couldn't save. Please try again.")
        }
    }

    private func remove(_ todo: Todo) async {
        do {
            let _: OkOut = try await APIClient.shared.delete("/api/todos/\(todo.id)")
            banners.confirm("Removed")
            await load()
        } catch {
            banners.error("Couldn't remove the item. Please try again.")
        }
    }
}
