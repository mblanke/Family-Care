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

struct PersonPicker: View {
    var people: [Person]
    @Binding var selected: Person?

    var body: some View {
        HStack(spacing: 8) {
            ForEach(people) { person in
                Button {
                    selected = person
                } label: {
                    HStack(spacing: 6) {
                        Circle().fill(FH.personColor(person)).frame(width: 14, height: 14)
                        Text(person.name).fhFont(.base, weight: selected?.id == person.id ? .bold : .regular)
                    }
                    .foregroundStyle(selected?.id == person.id ? .white : FH.ink)
                    .frame(maxWidth: .infinity, minHeight: FH.minTouch)
                    .background(
                        selected?.id == person.id ? FH.brand : Color(.systemGray5),
                        in: RoundedRectangle(cornerRadius: 12)
                    )
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selected?.id == person.id ? [.isSelected] : [])
            }
        }
    }
}
