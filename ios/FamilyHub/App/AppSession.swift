import SwiftUI

/// Auth + app-wide state, mirroring the web's AuthProvider/fontScale context.
@Observable
@MainActor
final class AppSession {
    var user: User?
    var appDisplayName = "Home Board"
    var checking = true

    var isLoggedIn: Bool { user != nil }
    var role: Role { user?.role ?? .parent }
    var canEditSchedule: Bool { role == .admin || role == .family }
    var isAdmin: Bool { role == .admin }
    var fontScale: CGFloat { user?.fontScale == "large" ? 1.4 : 1.0 }

    init() {
        APIClient.shared.onAuthExpired = { [weak self] in
            self?.user = nil
        }
    }

    /// On launch: if a session cookie (or stored credentials) still works, skip login.
    func restore() async {
        defer { checking = false }
        guard !APIClient.shared.serverURL.isEmpty else { return }
        if let me: MeOut = try? await APIClient.shared.get("/api/auth/me") {
            user = me.user
            appDisplayName = me.appDisplayName
        }
    }

    func login(server: String, username: String, password: String) async throws {
        APIClient.shared.serverURL = server
        try await APIClient.shared.login(username: username, password: password)
        Keychain.saveCredentials(username: username, password: password)
        let me: MeOut = try await APIClient.shared.get("/api/auth/me")
        user = me.user
        appDisplayName = me.appDisplayName
    }

    func logout() async {
        await APIClient.shared.logout()
        Keychain.delete()
        user = nil
    }

    func toggleFontScale() async {
        guard var u = user else { return }
        let next = u.fontScale == "large" ? "normal" : "large"
        struct FontIn: Encodable { var fontScale: String }
        do {
            let _: OkOut = try await APIClient.shared.put("/api/auth/me/font-scale", FontIn(fontScale: next))
            u.fontScale = next
            user = u
        } catch {
            // Toggle is cosmetic; ignore failures silently like the web does.
        }
    }
}
