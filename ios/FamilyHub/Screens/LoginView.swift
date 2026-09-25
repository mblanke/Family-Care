import SwiftUI

struct LoginView: View {
    @Environment(AppSession.self) private var session

    static let defaultServer = "https://atlas.tail8d54ec.ts.net"

    @State private var server = APIClient.shared.serverURL.isEmpty
        ? Self.defaultServer : APIClient.shared.serverURL
    @State private var username = ""
    @State private var password = ""
    @State private var showPassword = false
    @State private var errorText: String?
    @State private var busy = false
    @State private var showServerField = APIClient.shared.serverURL.isEmpty

    var body: some View {
        ScrollView {
            VStack(spacing: 32) {
                medallion
                    .padding(.top, 48)

                VStack(alignment: .leading, spacing: 24) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(session.appDisplayName)
                            .fhDisplay(.huge)
                            .accessibilityAddTraits(.isHeader)
                        Text("Sign in to see today's plan.")
                            .fhFont(.base)
                            .foregroundStyle(FH.inkSoft)
                    }

                    if showServerField {
                        FieldLabel(title: "Server address") {
                            TextField(Self.defaultServer, text: $server)
                                .fhField()
                                .fhFont(.base)
                                .keyboardType(.URL)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                            Text("The Tailscale address of the family server.")
                                .fhFont(.small)
                                .foregroundStyle(FH.inkSoft)
                        }
                    } else {
                        Button {
                            showServerField = true
                        } label: {
                            Text("Change server (\(server))")
                                .fhFont(.small)
                                .foregroundStyle(FH.inkSoft)
                                .frame(minHeight: 44)
                        }
                        .buttonStyle(.plain)
                    }

                    FieldLabel(title: "Username") {
                        TextField("", text: $username)
                            .fhField()
                            .fhFont(.big)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .textContentType(.username)
                    }

                    FieldLabel(title: "Password") {
                        HStack(spacing: 12) {
                            Group {
                                if showPassword {
                                    TextField("", text: $password)
                                        .textInputAutocapitalization(.never)
                                        .autocorrectionDisabled()
                                } else {
                                    SecureField("", text: $password)
                                }
                            }
                            .fhField()
                            .fhFont(.big)
                            .textContentType(.password)

                            Button {
                                showPassword.toggle()
                            } label: {
                                Text(showPassword ? "Hide" : "Show")
                                    .fhFont(.base, weight: .bold)
                                    .foregroundStyle(FH.ink)
                                    .frame(minWidth: 100, minHeight: FH.minTouch)
                                    .chrome(radius: FH.fieldRadius)
                            }
                            .buttonStyle(PressableStyle())
                            .accessibilityLabel(showPassword ? "Hide password" : "Show password")
                        }
                    }

                    if let errorText {
                        InlineError(text: errorText)
                    }

                    BigButton(title: busy ? "Signing in…" : "Sign in", icon: "arrow.right") {
                        Task { await signIn() }
                    }
                    .disabled(busy || username.isEmpty || password.isEmpty || server.isEmpty)
                    .opacity(busy || username.isEmpty || password.isEmpty || server.isEmpty ? 0.6 : 1)
                }
                .padding(28)
                .glass(radius: 36)

                Text("Only people in the family can sign in. Ask whoever set up the board if you need an account.")
                    .fhFont(.small)
                    .foregroundStyle(FH.inkSoft)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 12)
            }
            .padding(20)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity)
        }
        .groundBackground()
        .task { await debugAutoLogin() }
    }

    /// Platinum ring around a brand-metal disc with the house glyph (matches the app icon).
    private var medallion: some View {
        ZStack {
            Circle()
                .fill(AngularGradient(
                    colors: [Color.white, Color(hex: 0xB9C2CC), Color(hex: 0xF4F6F8), Color(hex: 0x9FA9B5),
                             Color.white, Color(hex: 0xC3CAD3), Color.white],
                    center: .center, angle: .degrees(210)))
                .shadow(color: FH.ink.opacity(0.22), radius: 20, x: 0, y: 18)
                .frame(width: 150, height: 150)
            Circle()
                .fill(LinearGradient(colors: [FH.brandLight, FH.brandDark], startPoint: .top, endPoint: .bottom))
                .overlay(Circle().strokeBorder(Color.white.opacity(0.35), lineWidth: 2))
                .frame(width: 110, height: 110)
            Image(systemName: "house.fill")
                .font(.system(size: 54, weight: .semibold))
                .foregroundStyle(Color.white)
        }
        .accessibilityHidden(true)
    }

    /// Debug-build hook: lets simulator test runs sign in via environment
    /// variables (SIMCTL_CHILD_FH_AUTO_USER / _PASS). Not compiled into release.
    private func debugAutoLogin() async {
        #if DEBUG
        let env = ProcessInfo.processInfo.environment
        guard let user = env["FH_AUTO_USER"], let pass = env["FH_AUTO_PASS"], !busy else { return }
        username = user
        password = pass
        await signIn()
        #endif
    }

    private func signIn() async {
        busy = true
        errorText = nil
        defer { busy = false }
        do {
            var cleaned = server.trimmingCharacters(in: .whitespacesAndNewlines)
            while cleaned.hasSuffix("/") { cleaned = String(cleaned.dropLast()) }
            if !cleaned.contains("://") { cleaned = "http://" + cleaned }
            try await session.login(server: cleaned, username: username, password: password)
        } catch let error as URLError {
            _ = error
            errorText = "Couldn't reach the server. Check the connection and try again."
        } catch {
            errorText = error.localizedDescription
        }
    }
}
