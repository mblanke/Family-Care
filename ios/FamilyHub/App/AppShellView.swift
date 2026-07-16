import SwiftUI

/// One tab entry; visibility mirrors ParentLayout.tsx / AdminLayout.tsx.
enum Screen: String, CaseIterable, Identifiable {
    case today, schedule, month, todo, grocery, birthdays, medications, bp, accounts, contacts

    var id: String { rawValue }

    var title: String {
        switch self {
        case .today: return "Today"
        case .schedule: return "Schedule"
        case .month: return "Month"
        case .todo: return "To-do"
        case .grocery: return "Grocery"
        case .birthdays: return "Birthdays"
        case .medications: return "Medications"
        case .bp: return "Blood Pressure"
        case .accounts: return "Accounts"
        case .contacts: return "Contacts"
        }
    }

    var icon: String {
        switch self {
        case .today: return "sun.max.fill"
        case .schedule: return "calendar"
        case .month: return "calendar.badge.clock"
        case .todo: return "checklist"
        case .grocery: return "cart.fill"
        case .birthdays: return "gift.fill"
        case .medications: return "pills.fill"
        case .bp: return "heart.fill"
        case .accounts: return "person.2.fill"
        case .contacts: return "phone.fill"
        }
    }

    static func tabs(for role: Role) -> [Screen] {
        switch role {
        case .parent:
            // Today-first, six tabs, no Schedule/Month/Birthdays/Accounts.
            return [.today, .todo, .grocery, .medications, .bp, .contacts]
        case .family:
            return [.today, .schedule, .todo, .grocery, .birthdays, .medications, .bp, .contacts]
        case .admin:
            return [.today, .schedule, .month, .todo, .grocery, .birthdays, .medications, .bp, .accounts, .contacts]
        }
    }
}

struct AppShellView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var banners = BannerCenter()
    @State private var selection: Screen = .today

    private var tabs: [Screen] { Screen.tabs(for: session.role) }

    var body: some View {
        Group {
            if sizeClass == .regular {
                splitLayout
            } else {
                tabLayout
            }
        }
        .bannerOverlay()
        .environment(banners)
        .onAppear { debugSelectTab() }
    }

    /// Debug-build hook: FH_AUTO_TAB jumps straight to a screen so simulator
    /// test runs can screenshot each tab. Not compiled into release.
    private func debugSelectTab() {
        #if DEBUG
        if let raw = ProcessInfo.processInfo.environment["FH_AUTO_TAB"],
           let screen = Screen(rawValue: raw), tabs.contains(screen) {
            selection = screen
        }
        #endif
    }

    @State private var columnVisibility = NavigationSplitViewVisibility.all

    // iPad: sidebar navigation.
    private var splitLayout: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            List(tabs, selection: Binding(get: { Optional(selection) }, set: { selection = $0 ?? .today })) { screen in
                Label(screen.title, systemImage: screen.icon)
                    .fhFont(.base, weight: .semibold)
                    .frame(minHeight: FH.minTouch - 16)
                    .tag(screen)
            }
            .navigationTitle(session.appDisplayName)
            .toolbar { headerToolbar }
        } detail: {
            NavigationStack {
                screenView(selection)
                    .navigationTitle(selection.title)
                    .navigationBarTitleDisplayMode(.inline)
            }
        }
    }

    // iPhone: tabs (system More handles overflow for admin/family).
    private var tabLayout: some View {
        TabView(selection: $selection) {
            ForEach(tabs) { screen in
                NavigationStack {
                    screenView(screen)
                        .navigationTitle(screen == .today ? session.appDisplayName : screen.title)
                        .toolbar { headerToolbar }
                }
                .tabItem { Label(screen.title, systemImage: screen.icon) }
                .tag(screen)
            }
        }
    }

    @ToolbarContentBuilder
    private var headerToolbar: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Button {
                Task { await session.toggleFontScale() }
            } label: {
                Text(session.fontScale > 1 ? "Aa Normal" : "Aa Larger")
                    .fhFont(.small, weight: .semibold)
            }
            .accessibilityLabel(session.fontScale > 1 ? "Switch to normal text size" : "Switch to larger text size")
        }
        ToolbarItem(placement: .topBarTrailing) {
            Button {
                Task { await session.logout() }
            } label: {
                Text("Sign out").fhFont(.small, weight: .semibold)
            }
        }
    }

    @ViewBuilder
    private func screenView(_ screen: Screen) -> some View {
        switch screen {
        case .today: TodayView()
        case .schedule: ScheduleView()
        case .month: MonthView()
        case .todo: TodoView()
        case .grocery: GroceryView()
        case .birthdays: BirthdaysView()
        case .medications: MedicationsView()
        case .bp: BpLogView()
        case .accounts: AccountsView()
        case .contacts: ContactsView()
        }
    }
}
