import SwiftUI

/// Loads /api/people once and lets the user pick a person (Medications, BP).
@Observable
@MainActor
final class PeopleStore {
    var people: [Person] = []
    var selected: Person?

    func load() async {
        guard people.isEmpty else { return }
        if let list: [Person] = try? await APIClient.shared.get("/api/people") {
            people = list
            if selected == nil { selected = list.first }
        }
    }
}

/// Chrome tray of person chips; the chosen one lit in brand metal, the person's
/// colour as a dot beside the name (never colour alone).
struct PersonPicker: View {
    var people: [Person]
    @Binding var selected: Person?

    var body: some View {
        HStack(spacing: 6) {
            ForEach(people) { person in
                let active = selected?.id == person.id
                Button {
                    selected = person
                } label: {
                    HStack(spacing: 8) {
                        Circle()
                            .fill(active ? Color.white : FH.personColor(person))
                            .overlay(Circle().strokeBorder(FH.personColor(person), lineWidth: 3))
                            .frame(width: 16, height: 16)
                        Text(person.name).fhFont(.base, weight: .bold)
                    }
                    .foregroundStyle(active ? Color.white : FH.ink)
                    .padding(.horizontal, 18)
                    .frame(maxWidth: .infinity, minHeight: 56)
                    .background {
                        if active { MetalSurface(tone: .brand) }
                    }
                }
                .buttonStyle(PressableStyle())
                .accessibilityAddTraits(active ? [.isSelected] : [])
            }
        }
        .padding(6)
        .chrome()
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Whose record")
    }
}
