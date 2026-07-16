import SwiftUI

struct LoginView: View {
    @Environment(AppSession.self) private var session

    static let defaultServer = "https://atlas.tail8d54ec.ts.net"

    @State private var server = APIClient.shared.serverURL.isEmpty
        ? Self.defaultServer : APIClient.shared.serverURL
    @State private var username = ""
    @State private var password = ""
    @State private var errorText: String?
    @State private var busy = false
    @State private var showServerField = APIClient.shared.serverURL.isEmpty

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                Text("Home Board")
                    .fhFont(.huge, weight: .bold)
                    .padding(.top, 60)

                if showServerField {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Server address").fhFont(.small, weight: .semibold)
                        TextField(Self.defaultServer, text: $server)
                            .textFieldStyle(.roundedBorder)
                            .keyboardType(.URL)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                        Text("The Tailscale address of the family server.")
                            .fhFont(.small)
                            .foregroundStyle(.secondary)
                    }
                } else {
                    Button("Change server (\(server))") { showServerField = true }
                        .fhFont(.small)
                        .foregroundStyle(.secondary)
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("Username").fhFont(.small, weight: .semibold)
                    TextField("Username", text: $username)
                        .textFieldStyle(.roundedBorder)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .textContentType(.username)
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("Password").fhFont(.small, weight: .semibold)
                    SecureField("Password", text: $password)
                        .textFieldStyle(.roundedBorder)
                        .textContentType(.password)
                }

                if let errorText {
                    Label(errorText, systemImage: "exclamationmark.triangle.fill")
                        .fhFont(.base, weight: .semibold)
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity, minHeight: FH.minTouch)
                        .background(FH.danger, in: RoundedRectangle(cornerRadius: 14))
                }

                BigButton(title: busy ? "Signing in…" : "Sign in", icon: "person.fill") {
                    Task { await signIn() }
                }
                .disabled(busy || username.isEmpty || password.isEmpty || server.isEmpty)
            }
            .fhFont(.base)
            .padding(24)
            .frame(maxWidth: 480)
            .frame(maxWidth: .infinity)
        }
        .background(Color(.systemGroupedBackground))
        .task { await debugAutoLogin() }
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
        } catch {
            errorText = error.localizedDescription
        }
    }
}
