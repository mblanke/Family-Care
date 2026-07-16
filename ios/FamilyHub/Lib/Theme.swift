import SwiftUI

/// Design tokens from frontend/tailwind.config.ts and the accessibility rules in
/// docs/superpowers/plans/2026-06-22-family-hub-overview.md:
/// base text 20px (big 28 / huge 40), touch targets ≥60pt, never color alone.
enum FH {
    static let ink = Color(hex: 0x111418)
    static let paper = Color.white
    static let brand = Color(hex: 0x0E7490)
    static let dad = Color(hex: 0x1F6FEB)
    static let mom = Color(hex: 0xA371F7)
    static let confirm = Color(hex: 0x1A7F37)
    static let danger = Color(hex: 0xB91C1C)

    static let baseSize: CGFloat = 20
    static let bigSize: CGFloat = 28
    static let hugeSize: CGFloat = 40
    static let minTouch: CGFloat = 60

    static func personColor(_ person: Person?) -> Color {
        guard let person, let value = UInt32(person.color.dropFirst(), radix: 16) else { return brand }
        return Color(hex: value)
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}

// MARK: - Font scale ("normal" | "large" ≈ web's 16 → 22.5px root bump, i.e. ×1.4)

private struct FontScaleKey: EnvironmentKey {
    static let defaultValue: CGFloat = 1
}

extension EnvironmentValues {
    var fhScale: CGFloat {
        get { self[FontScaleKey.self] }
        set { self[FontScaleKey.self] = newValue }
    }
}

/// Scaled text helper: `.fhFont(.base)` etc., multiplied by the user's font scale.
enum FHTextStyle {
    case base, big, huge, small

    var size: CGFloat {
        switch self {
        case .small: return 16
        case .base: return FH.baseSize
        case .big: return FH.bigSize
        case .huge: return FH.hugeSize
        }
    }
}

private struct FHFont: ViewModifier {
    @Environment(\.fhScale) private var scale
    let style: FHTextStyle
    let weight: Font.Weight

    func body(content: Content) -> some View {
        content.font(.system(size: style.size * scale, weight: weight))
    }
}

extension View {
    func fhFont(_ style: FHTextStyle, weight: Font.Weight = .regular) -> some View {
        modifier(FHFont(style: style, weight: weight))
    }
}
