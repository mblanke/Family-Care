import SwiftUI

/// Full-width banners, mirroring Confirmation.tsx (green, ~6s) and ErrorBanner.tsx
/// (red). Big, text + icon. Errors stay until dismissed so an older reader never
/// misses one because it vanished.
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
    func error(_ text: String) { show(Banner(text: text, isError: true), seconds: nil) }
    func dismiss() {
        hideTask?.cancel()
        current = nil
    }

    private func show(_ banner: Banner, seconds: Double?) {
        hideTask?.cancel()
        current = banner
        guard let seconds else { return }
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
                let tone: MetalTone = banner.isError ? .danger : .confirm
                HStack(spacing: 14) {
                    Image(systemName: banner.isError ? "exclamationmark.triangle.fill" : "checkmark")
                        .font(.system(size: 30, weight: .heavy))
                    Text(banner.text)
                        .fhFont(.big, weight: .bold)
                    if banner.isError {
                        Button {
                            banners.dismiss()
                        } label: {
                            Text("Dismiss")
                                .fhFont(.small, weight: .bold)
                                .foregroundStyle(FH.ink)
                                .padding(.horizontal, 18)
                                .frame(minHeight: 52)
                                .chrome()
                        }
                        .buttonStyle(PressableStyle())
                    }
                }
                .foregroundStyle(Color.white)
                .padding(.horizontal, 20)
                .padding(.vertical, 14)
                .frame(maxWidth: .infinity, minHeight: FH.minTouch)
                .background(
                    LinearGradient(stops: [
                        .init(color: tone.light, location: 0),
                        .init(color: tone.base, location: 0.3),
                        .init(color: tone.dark, location: 1),
                    ], startPoint: .top, endPoint: .bottom)
                    .clipShape(UnevenRoundedRectangle(bottomLeadingRadius: FH.cardRadius, bottomTrailingRadius: FH.cardRadius))
                    .shadow(color: tone.dark.opacity(0.35), radius: 16, x: 0, y: 10)
                )
                .transition(.move(edge: .top).combined(with: .opacity))
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(.isStaticText)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: banners.current)
    }
}

extension View {
    func bannerOverlay() -> some View { modifier(BannerOverlay()) }
}
