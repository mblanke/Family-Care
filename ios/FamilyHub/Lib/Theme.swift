import SwiftUI
import UIKit

/// Design tokens mirroring frontend/tailwind.config.ts and frontend/src/index.css
/// ("liquid metal", senior-first). Rules that still hold: big text, touch targets
/// >= 64pt, text + icon (never colour alone), person colour always beside the name.
enum FH {
    // Ink and ground
    static let ink = Color(hex: 0x0F1720)        // 16:1 on glass
    static let inkSoft = Color(hex: 0x3B4652)    // secondary text, 8:1 on glass
    static let paper = Color.white
    static let ground = Color(hex: 0xE6E9EE)     // flat fallback for the platinum ground

    // Brand teal metal (white text stays >= 4.5:1 on every band)
    static let brand = Color(hex: 0x0E7490)
    static let brandLight = Color(hex: 0x0F7F9D)
    static let brandDark = Color(hex: 0x0A5570)
    static let brandEdge = Color(hex: 0x084B5E)

    static let confirm = Color(hex: 0x1A7F37)
    static let confirmLight = Color(hex: 0x22883F)
    static let confirmDark = Color(hex: 0x145F2A)
    static let confirmEdge = Color(hex: 0x0F4F22)

    static let danger = Color(hex: 0xB3261E)
    static let dangerLight = Color(hex: 0xC4362C)
    static let dangerDark = Color(hex: 0x8D1D17)
    static let dangerEdge = Color(hex: 0x6E1511)

    // People (the API sends each person's colour; these are the seed defaults)
    static let dad = Color(hex: 0x1F6FEB)
    static let mom = Color(hex: 0x8A5CF0)

    // Type scale (points, before the user's Larger-text multiplier)
    static let smallSize: CGFloat = 18
    static let baseSize: CGFloat = 22
    static let bigSize: CGFloat = 30
    static let titleSize: CGFloat = 32
    static let hugeSize: CGFloat = 48

    // Shape
    static let minTouch: CGFloat = 64
    static let cardRadius: CGFloat = 28
    static let wellRadius: CGFloat = 22
    static let squareRadius: CGFloat = 20
    static let fieldRadius: CGFloat = 20
    static let pillRadius: CGFloat = 999

    // Bundled fonts (ios/FamilyHub/Fonts, registered via UIAppFonts in project.yml)
    static let bodyFont = "AtkinsonHyperlegible-Regular"
    static let bodyBoldFont = "AtkinsonHyperlegible-Bold"
    static let displayFont = "Sora-Bold"
    static let displaySemiFont = "Sora-SemiBold"

    static func personColor(_ person: Person?) -> Color {
        guard let person, let value = UInt32(person.color.dropFirst(), radix: 16) else { return brand }
        return Color(hex: value)
    }

    /// Resolves a text style to a bundled font, falling back to the system font if
    /// the custom face is missing so the app never renders blank text.
    static func font(_ style: FHTextStyle, weight: Font.Weight, display: Bool, scale: CGFloat) -> Font {
        let size = style.size * scale
        let bold = weight == .semibold || weight == .bold || weight == .heavy || weight == .black
        let useDisplay = display || style == .huge || style == .title
        let name = useDisplay ? (bold ? displayFont : displaySemiFont) : (bold ? bodyBoldFont : bodyFont)
        if UIFont(name: name, size: size) != nil {
            return .custom(name, fixedSize: size)
        }
        return .system(size: size, weight: weight, design: useDisplay ? .rounded : .default)
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
    case small, base, big, title, huge

    var size: CGFloat {
        switch self {
        case .small: return FH.smallSize
        case .base: return FH.baseSize
        case .big: return FH.bigSize
        case .title: return FH.titleSize
        case .huge: return FH.hugeSize
        }
    }
}

private struct FHFont: ViewModifier {
    @Environment(\.fhScale) private var scale
    let style: FHTextStyle
    let weight: Font.Weight
    let display: Bool

    func body(content: Content) -> some View {
        content.font(FH.font(style, weight: weight, display: display, scale: scale))
    }
}

extension View {
    /// Body text in Atkinson Hyperlegible. `.title` and `.huge` always use Sora.
    func fhFont(_ style: FHTextStyle, weight: Font.Weight = .regular) -> some View {
        modifier(FHFont(style: style, weight: weight, display: false))
    }

    /// Sora at any size: headings, time chips, big numerals.
    func fhDisplay(_ style: FHTextStyle, weight: Font.Weight = .bold) -> some View {
        modifier(FHFont(style: style, weight: weight, display: true))
    }
}
