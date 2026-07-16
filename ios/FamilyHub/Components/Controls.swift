import SwiftUI

/// Big primary button (≥60pt touch target, text + optional icon — never color alone).
struct BigButton: View {
    var title: String
    var icon: String?
    var role: ButtonRole?
    var background: Color = FH.brand
    var action: () -> Void

    var body: some View {
        Button(role: role, action: action) {
            HStack(spacing: 10) {
                if let icon { Image(systemName: icon) }
                Text(title)
            }
            .fhFont(.base, weight: .semibold)
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: FH.minTouch)
            .background(background, in: RoundedRectangle(cornerRadius: 14))
        }
        .buttonStyle(.plain)
    }
}

/// Segmented filter matching the web's Seg (Costco | Grocery | All).
struct SegControl: View {
    var options: [(value: String, label: String)]
    @Binding var selection: String

    var body: some View {
        HStack(spacing: 8) {
            ForEach(options, id: \.value) { option in
                Button {
                    selection = option.value
                } label: {
                    Text(option.label)
                        .fhFont(.base, weight: selection == option.value ? .bold : .regular)
                        .foregroundStyle(selection == option.value ? .white : FH.ink)
                        .frame(maxWidth: .infinity, minHeight: FH.minTouch)
                        .background(
                            selection == option.value ? FH.brand : Color(.systemGray5),
                            in: RoundedRectangle(cornerRadius: 12)
                        )
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selection == option.value ? [.isSelected] : [])
            }
        }
    }
}

/// Big −/value/+ stepper used by grocery qty and BP entry (≥60pt buttons).
struct BigStepper: View {
    var label: String
    @Binding var value: Int
    var range: ClosedRange<Int> = 1...999

    var body: some View {
        HStack(spacing: 12) {
            if !label.isEmpty {
                Text(label).fhFont(.base, weight: .semibold)
                Spacer(minLength: 0)
            }
            stepButton("minus", "Decrease \(label)") { value = max(range.lowerBound, value - 1) }
            Text("\(value)")
                .fhFont(.big, weight: .bold)
                .frame(minWidth: 64)
                .monospacedDigit()
            stepButton("plus", "Increase \(label)") { value = min(range.upperBound, value + 1) }
        }
    }

    private func stepButton(_ icon: String, _ a11y: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .fhFont(.big, weight: .bold)
                .frame(width: FH.minTouch, height: FH.minTouch)
                .background(Color(.systemGray5), in: RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(a11y)
    }
}

/// Person chip with the person's color as a leading dot (color + name, never color alone).
struct PersonBadge: View {
    var person: Person?
    var forBoth: Bool = false

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(forBoth ? FH.brand : FH.personColor(person))
                .frame(width: 14, height: 14)
            Text(forBoth ? "Both" : (person?.name ?? ""))
                .fhFont(.small, weight: .semibold)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .background(Color(.systemGray6), in: Capsule())
    }
}

/// Card container used across screens.
struct Card<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) { content }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
    }
}

/// Section heading matching the web's large headings.
struct ScreenHeading: View {
    var text: String

    var body: some View {
        Text(text)
            .fhFont(.big, weight: .bold)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityAddTraits(.isHeader)
    }
}
