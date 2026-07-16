import SwiftUI

@main
struct FamilyHubApp: App {
    @State private var session = AppSession()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .environment(\.fhScale, session.fontScale)
                .tint(FH.brand)
                .task { await session.restore() }
        }
    }
}
