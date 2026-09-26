import SwiftUI

/// The "liquid metal" materials, mirroring frontend/src/index.css:
/// platinum ground, glass cards, chrome secondary controls, metal action fills.

enum MetalTone {
    case brand, confirm, danger

    var light: Color {
        switch self { case .brand: return FH.brandLight; case .confirm: return FH.confirmLight; case .danger: return FH.dangerLight }
    }
    var base: Color {
        switch self { case .brand: return FH.brand; case .confirm: return FH.confirm; case .danger: return FH.danger }
    }
    var dark: Color {
        switch self { case .brand: return FH.brandDark; case .confirm: return FH.confirmDark; case .danger: return FH.dangerDark }
    }
    var edge: Color {
        switch self { case .brand: return FH.brandEdge; case .confirm: return FH.confirmEdge; case .danger: return FH.dangerEdge }
    }
}

/// Platinum sheen with two soft highlights. Use as a screen background.
struct GroundBackground: View {
    var body: some View {
        ZStack {
            LinearGradient(
                stops: [
                    .init(color: Color(hex: 0xF5F7FA), location: 0),
                    .init(color: Color(hex: 0xE2E6EC), location: 0.42),
                    .init(color: Color(hex: 0xF1F3F6), location: 0.68),
                    .init(color: Color(hex: 0xD9DFE6), location: 1),
                ],
                startPoint: .topLeading, endPoint: .bottomTrailing
            )
            RadialGradient(
                colors: [Color.white.opacity(0.95), Color.white.opacity(0)],
                center: UnitPoint(x: 0.15, y: -0.1), startRadius: 0, endRadius: 700
            )
            RadialGradient(
                colors: [FH.brand.opacity(0.16), FH.brand.opacity(0)],
                center: UnitPoint(x: 1.1, y: 1.05), startRadius: 0, endRadius: 600
            )
        }
        .ignoresSafeArea()
    }
}

/// Glass card surface: replaces the old outlined boxes.
struct GlassSurface: View {
    var radius: CGFloat = FH.cardRadius

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        shape
            .fill(LinearGradient(colors: [Color.white.opacity(0.94), Color.white.opacity(0.80)],
                                 startPoint: .top, endPoint: .bottom))
            .overlay(
                shape.strokeBorder(
                    LinearGradient(stops: [
                        .init(color: Color.white.opacity(0.95), location: 0),
                        .init(color: FH.ink.opacity(0.16), location: 0.12),
                        .init(color: FH.ink.opacity(0.16), location: 1),
                    ], startPoint: .top, endPoint: .bottom),
                    lineWidth: 1
                )
            )
            .shadow(color: FH.ink.opacity(0.10), radius: 17, x: 0, y: 14)
    }
}

/// Soft white well inside a glass card (list rows, appointment rows).
struct WellSurface: View {
    var radius: CGFloat = FH.wellRadius

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        shape
            .fill(Color.white.opacity(0.7))
            .overlay(shape.strokeBorder(FH.ink.opacity(0.12), lineWidth: 1))
    }
}

/// Chrome: secondary buttons, segmented trays, chips, check squares.
struct ChromeSurface: View {
    var radius: CGFloat = FH.pillRadius

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        shape
            .fill(LinearGradient(stops: [
                .init(color: Color.white, location: 0),
                .init(color: Color(hex: 0xD7DDE5), location: 0.44),
                .init(color: Color(hex: 0xF2F4F7), location: 0.58),
                .init(color: Color(hex: 0xC6CED8), location: 1),
            ], startPoint: .topLeading, endPoint: .bottomTrailing))
            .overlay(
                shape.strokeBorder(
                    LinearGradient(stops: [
                        .init(color: Color.white.opacity(0.95), location: 0),
                        .init(color: FH.ink.opacity(0.24), location: 0.15),
                        .init(color: FH.ink.opacity(0.24), location: 1),
                    ], startPoint: .top, endPoint: .bottom),
                    lineWidth: 1
                )
            )
            .shadow(color: FH.ink.opacity(0.10), radius: 6, x: 0, y: 4)
    }
}

/// Metal fill for actions. White text on every band.
struct MetalSurface: View {
    var tone: MetalTone
    var radius: CGFloat = FH.pillRadius

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        shape
            .fill(LinearGradient(stops: [
                .init(color: tone.light, location: 0),
                .init(color: tone.base, location: 0.3),
                .init(color: tone.dark, location: 1),
            ], startPoint: .top, endPoint: .bottom))
            .overlay(
                shape.strokeBorder(
                    LinearGradient(stops: [
                        .init(color: Color.white.opacity(0.42), location: 0),
                        .init(color: tone.edge, location: 0.2),
                        .init(color: tone.edge, location: 1),
                    ], startPoint: .top, endPoint: .bottom),
                    lineWidth: 1
                )
            )
            .shadow(color: tone.dark.opacity(0.30), radius: 10, x: 0, y: 8)
    }
}

/// Modal surface (sheets, dialogs).
struct DialogSurface: View {
    var radius: CGFloat = 36

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        shape
            .fill(LinearGradient(colors: [Color.white, Color(hex: 0xF3F5F8)], startPoint: .top, endPoint: .bottom))
            .overlay(shape.strokeBorder(FH.ink.opacity(0.2), lineWidth: 1))
            .shadow(color: FH.ink.opacity(0.35), radius: 45, x: 0, y: 40)
    }
}

/// Text input look: white well, 2pt ink border, 64pt tall.
struct FHFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        let shape = RoundedRectangle(cornerRadius: FH.fieldRadius, style: .continuous)
        return configuration
            .padding(.horizontal, 18)
            .frame(minHeight: FH.minTouch)
            .background(
                shape.fill(LinearGradient(colors: [Color.white, Color(hex: 0xF4F6F8)], startPoint: .top, endPoint: .bottom))
            )
            .overlay(shape.strokeBorder(FH.ink.opacity(0.35), lineWidth: 2))
    }
}

/// Buttons squash slightly while pressed.
struct PressableStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

extension View {
    func groundBackground() -> some View { background(GroundBackground()) }
    func glass(radius: CGFloat = FH.cardRadius) -> some View { background(GlassSurface(radius: radius)) }
    func well(radius: CGFloat = FH.wellRadius) -> some View { background(WellSurface(radius: radius)) }
    func chrome(radius: CGFloat = FH.pillRadius) -> some View { background(ChromeSurface(radius: radius)) }
    func metal(_ tone: MetalTone, radius: CGFloat = FH.pillRadius) -> some View { background(MetalSurface(tone: tone, radius: radius)) }
    func fhField() -> some View { textFieldStyle(FHFieldStyle()) }
}

/// A visible label above a control, with an optional "(optional)" hint.
struct FieldLabel<Content: View>: View {
    var title: String
    var optional: Bool = false
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Text(title).fhFont(.base, weight: .bold)
                if optional {
                    Text("(optional)").fhFont(.base).foregroundStyle(FH.inkSoft)
                }
            }
            content
        }
    }
}

/// Inline validation or failure line: icon + bold text in danger ink (never colour alone).
struct InlineError: View {
    var text: String

    var body: some View {
        Label(text, systemImage: "exclamationmark.triangle.fill")
            .fhFont(.base, weight: .bold)
            .foregroundStyle(FH.danger)
            .accessibilityAddTraits(.isStaticText)
    }
}
