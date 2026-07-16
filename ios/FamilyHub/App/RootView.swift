import SwiftUI

/// Mirrors the web's Gate(): Login or the role-appropriate shell.
struct RootView: View {
    @Environment(AppSession.self) private var session

    var body: some View {
        if session.checking {
            ProgressView()
        } else if !session.isLoggedIn {
            LoginView()
        } else {
            AppShellView()
        }
    }
}
