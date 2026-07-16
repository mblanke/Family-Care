import SwiftUI

/// Transient full-width banners, mirroring Confirmation.tsx (green, ~6s) and
/// ErrorBanner.tsx (red, ~8s). Big, text + icon, auto-dismissing.
@Observable
@MainActor
final class BannerCenter {
    struct Banner: Equatable {
        var text: String
        var isError: Bool
    }

    var current: Banner?
    private var hideTask: Task<Void, Never>?

    func confirm(_ text: String) { show(Banner(text: text, isError: false), seconds: 6) }
    func error(_ text: String) { show(Banner(text: text, isError: true), seconds: 8) }

    private func show(_ banner: Banner, seconds: Double) {
        hideTask?.cancel()
        current = banner
        hideTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(seconds))
            guard !Task.isCancelled else { return }
            self?.current = nil
        }
    }
}

struct BannerOverlay: ViewModifier {
    @Environment(BannerCenter.self) private var banners

    func body(content: Content) -> some View {
        content.overlay(alignment: .top) {
            if let banner = banners.current {
                HStack(spacing: 12) {
                    Image(systemName: banner.isError ? "exclamationmark.triangle.fill" : "checkmark.circle.fill")
                    Text(banner.text)
                }
                .fhFont(.big, weight: .bold)
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity, minHeight: FH.minTouch)
                .padding(.vertical, 12)
                .background(banner.isError ? FH.danger : FH.confirm)
                .transition(.move(edge: .top).combined(with: .opacity))
                .accessibilityAddTraits(.isStaticText)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: banners.current)
    }
}

extension View {
    func bannerOverlay() -> some View { modifier(BannerOverlay()) }
}
