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
                HStack(spacing: 10) {
                    TextField("Add something…", text: $newText)
                        .textFieldStyle(.roundedBorder)
                        .fhFont(.base)
                        .onSubmit { Task { await add() } }
                    Button {
                        Task { await add() }
                    } label: {
                        Label("Add", systemImage: "plus")
                            .fhFont(.base, weight: .semibold)
                            .foregroundStyle(.white)
                            .padding(.horizontal, 20)
                            .frame(minHeight: FH.minTouch)
                            .background(FH.brand, in: RoundedRectangle(cornerRadius: 14))
                    }
                    .buttonStyle(.plain)
                    .disabled(newText.trimmingCharacters(in: .whitespaces).isEmpty)
                }

                ForEach(open) { todo in
                    row(todo)
                }
                if open.isEmpty {
                    Card { Text("Nothing on the list.").fhFont(.base) }
                }

                if !done.isEmpty {
                    ScreenHeading(text: "Done")
                    ForEach(done) { todo in
                        row(todo).opacity(0.7)
                    }
                }
            }
            .padding(16)
        }
        .background(Color(.systemGroupedBackground))
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
        Card {
            HStack(spacing: 14) {
                Button {
                    Task { await toggle(todo) }
                } label: {
                    Image(systemName: todo.done ? "checkmark.square.fill" : "square")
                        .fhFont(.big, weight: .bold)
                        .foregroundStyle(todo.done ? FH.confirm : FH.ink)
                        .frame(width: FH.minTouch, height: FH.minTouch)
                        .background(Color(.systemGray6), in: RoundedRectangle(cornerRadius: 12))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(todo.done ? "Mark \(todo.text) as not done" : "Check off \(todo.text)")

                Text(todo.text)
                    .fhFont(.base)
                    .strikethrough(todo.done)

                Spacer(minLength: 0)

                Button {
                    pendingDelete = todo
                } label: {
                    Image(systemName: "trash")
                        .fhFont(.base)
                        .foregroundStyle(FH.danger)
                        .frame(width: FH.minTouch, height: FH.minTouch)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Remove \(todo.text)")
            }
        }
    }

    private func load() async {
        if let list: [Todo] = try? await APIClient.shared.get("/api/todos") {
            todos = list
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
            banners.error(error.localizedDescription)
        }
    }

    private func toggle(_ todo: Todo) async {
        struct DoneIn: Encodable { var done: Bool }
        do {
            let _: Todo = try await APIClient.shared.post("/api/todos/\(todo.id)/done", DoneIn(done: !todo.done))
            if !todo.done { banners.confirm("Checked off ✓") }
            await load()
        } catch {
            banners.error(error.localizedDescription)
        }
    }

    private func remove(_ todo: Todo) async {
        do {
            let _: OkOut = try await APIClient.shared.delete("/api/todos/\(todo.id)")
            await load()
        } catch {
            banners.error(error.localizedDescription)
        }
    }
}
