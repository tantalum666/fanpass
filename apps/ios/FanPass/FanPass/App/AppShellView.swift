import SwiftUI

struct AppShellView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        @Bindable var appState = appState

        TabView(selection: $appState.selectedTab) {
            NavigationStack {
                EventListView()
            }
            .tabItem { Label(AppTab.events.title, systemImage: AppTab.events.systemImage) }
            .tag(AppTab.events)

            NavigationStack {
                TicketWalletView()
            }
            .tabItem { Label(AppTab.tickets.title, systemImage: AppTab.tickets.systemImage) }
            .tag(AppTab.tickets)

            NavigationStack {
                MarketplaceView()
            }
            .tabItem { Label(AppTab.marketplace.title, systemImage: AppTab.marketplace.systemImage) }
            .tag(AppTab.marketplace)

            NavigationStack {
                FanAccessView()
            }
            .tabItem { Label(AppTab.fanAccess.title, systemImage: AppTab.fanAccess.systemImage) }
            .tag(AppTab.fanAccess)

            NavigationStack {
                ProfileView()
            }
            .tabItem { Label(AppTab.profile.title, systemImage: AppTab.profile.systemImage) }
            .tag(AppTab.profile)
        }
        .sheet(item: $appState.authRequest) { request in
            AuthView(title: request.title)
                .presentationDetents([.large])
        }
    }
}

#Preview {
    AppShellView()
        .environment(AppState())
}
