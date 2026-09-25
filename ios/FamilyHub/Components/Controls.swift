import SwiftUI

enum ButtonVariant {
    case primary, confirm, secondary, danger
}

/// Big metal pill button (>=64pt touch target, text + optional icon — never colour alone).
struct BigButton: View {
    var title: String
    var icon: String?
    var variant: ButtonVariant = .primary
    var role: ButtonRole?
    var fullWidth: Bool = true
    var action: () -> Void

    var body: some View {
        Button(role: role, action: action) {
            HStack(spacing: 10) {
                if let icon { Image(systemName: icon).fontWeight(.bold) }
                Text(title)
            }
            .fhFont(.base, weight: .bold)
            .foregroundStyle(variant == .secondary ? FH.ink : Color.white)
            .padding(.horizontal, 24)
            .frame(maxWidth: fullWidth ? .infinity : nil, minHeight: FH.minTouch)
            .background {
                switch variant {
                case .primary: MetalSurface(tone: .brand)
                case .confirm: MetalSurface(tone: .confirm)
                case .danger: MetalSurface(tone: .danger)
                case .secondary: ChromeSurface()
                }
            }
        }
        .buttonStyle(PressableStyle())
    }
}

/// Square chrome icon button (delete, previous/next, small actions).
struct IconButton: View {
    var systemName: String
    var label: String
    var size: CGFloat = FH.minTouch
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 26, weight: .semibold))
                .foregroundStyle(FH.ink)
                .frame(width: size, height: size)
                .chrome(radius: 18)
        }
        .buttonStyle(PressableStyle())
        .accessibilityLabel(label)
    }
}

/// Segmented filter: chrome tray, the chosen option lit in brand metal.
struct SegControl: View {
    var options: [(value: String, label: String)]
    @Binding var selection: String

    var body: some View {
        HStack(spacing: 6) {
            ForEach(options, id: \.value) { option in
                let active = selection == option.value
                Button {
                    selection = option.value
                } label: {
                    Text(option.label)
                        .fhFont(.base, weight: .bold)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                        .foregroundStyle(active ? Color.white : FH.ink)
                        .padding(.horizontal, 12)
                        .frame(maxWidth: .infinity, minHeight: FH.minTouch - 8)
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
    }
}

/// Big −/value/+ stepper used by grocery qty and BP entry.
struct BigStepper: View {
    enum Size { case big, base }

    var label: String
    @Binding var value: Int
    var range: ClosedRange<Int> = 1...999
    var size: Size = .big
    var showLabel: Bool = true
    var downLabel: String?
    var upLabel: String?

    private var button: CGFloat { size == .big ? 80 : 68 }

    var body: some View {
        VStack(spacing: 8) {
            if showLabel && !label.isEmpty {
                Text(label).fhFont(.base, weight: .bold)
            }
            HStack(spacing: 8) {
                stepButton("minus", downLabel ?? "\(label) decrease") { value = max(range.lowerBound, value - 1) }
                Text("\(value)")
                    .fhDisplay(size == .big ? .huge : .big)
                    .monospacedDigit()
                    .frame(minWidth: size == .big ? 96 : 56)
                    .accessibilityLabel("\(label) \(value)")
                stepButton("plus", upLabel ?? "\(label) increase") { value = min(range.upperBound, value + 1) }
            }
        }
    }

    private func stepButton(_ icon: String, _ a11y: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 30, weight: .bold))
                .foregroundStyle(FH.ink)
                .frame(width: button, height: button)
                .chrome(radius: size == .big ? 22 : 18)
        }
        .buttonStyle(PressableStyle())
        .accessibilityLabel(a11y)
    }
}

/// 72pt check square: chrome when open, confirm metal with a check when done.
struct CheckSquare: View {
    var done: Bool
    var itemName: String
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                if done {
                    MetalSurface(tone: .confirm, radius: FH.squareRadius)
                    Image(systemName: "checkmark")
                        .font(.system(size: 34, weight: .heavy))
                        .foregroundStyle(Color.white)
                } else {
                    ChromeSurface(radius: FH.squareRadius)
                }
            }
            .frame(width: 72, height: 72)
        }
        .buttonStyle(PressableStyle())
        .accessibilityLabel(done ? "Mark \(itemName) not done" : "Mark \(itemName) done")
        .accessibilityAddTraits(done ? [.isSelected] : [])
    }
}

/// Person chip: the person's colour as a ring and dot beside the name (colour + name, never colour alone).
struct PersonBadge: View {
    var person: Person?
    var forBoth: Bool = false

    private var color: Color { forBoth ? FH.brand : FH.personColor(person) }

    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(color)
                .frame(width: 14, height: 14)
            Text(forBoth ? "Everyone" : (person?.name ?? ""))
                .fhFont(.small, weight: .bold)
                .foregroundStyle(FH.ink)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(Capsule().fill(Color.white.opacity(0.7)))
        .overlay(Capsule().strokeBorder(color, lineWidth: 2))
    }
}

/// Small chrome chip: time of an appointment, a dose, a role.
struct Chip: View {
    var text: String
    var systemImage: String?
    var display: Bool = false

    var body: some View {
        HStack(spacing: 6) {
            if let systemImage { Image(systemName: systemImage) }
            Text(text)
        }
        .modifier(ChipFont(display: display))
        .foregroundStyle(FH.ink)
        .padding(.horizontal, 14)
        .frame(minHeight: 48)
        .chrome(radius: 16)
    }

    private struct ChipFont: ViewModifier {
        var display: Bool
        @ViewBuilder
        func body(content: Content) -> some View {
            if display { content.fhDisplay(.big) } else { content.fhFont(.small, weight: .bold) }
        }
    }
}

/// Glass card container used across screens, with an optional heading.
struct Card<Content: View>: View {
    var title: String?
    var icon: String?
    @ViewBuilder var content: Content

    init(title: String? = nil, icon: String? = nil, @ViewBuilder content: () -> Content) {
        self.title = title
        self.icon = icon
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let title {
                HStack(spacing: 8) {
                    if let icon { Image(systemName: icon) }
                    Text(title)
                }
                .fhFont(.base, weight: .bold)
                .foregroundStyle(FH.inkSoft)
                .accessibilityAddTraits(.isHeader)
            }
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .glass()
    }
}

/// A soft white row inside a card.
struct Well<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) { content }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .well()
    }
}

/// Screen heading in Sora, matching the web's big headings.
struct ScreenHeading: View {
    var text: String
    var sub: String?

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 14) {
            Text(text)
                .fhDisplay(.title)
                .accessibilityAddTraits(.isHeader)
            if let sub {
                Text(sub).fhFont(.base).foregroundStyle(FH.inkSoft)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Brand-metal "Needs a ride" badge.
struct RideBadge: View {
    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "car.fill")
            Text("Needs a ride")
        }
        .fhFont(.small, weight: .bold)
        .foregroundStyle(Color.white)
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .metal(.brand)
        .accessibilityLabel("Needs a ride")
    }
}
