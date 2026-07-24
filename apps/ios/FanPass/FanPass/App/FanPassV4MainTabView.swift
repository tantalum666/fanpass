import SwiftUI

struct FanPassV4MainTabView: View {
    @Bindable var viewModel: FanPassRootViewModel
    var signOut: () -> Void = {}
    @Environment(FanPassBackendContext.self) private var backend

    var body: some View {
        TabView(selection: $viewModel.selectedTabID) {
            NavigationStack {
                FanPassV5HomeView()
                    .navigationBarTitleDisplayMode(.inline)
            }
            .tabItem { Label(FanPassV4Tab.home.title, systemImage: FanPassV4Tab.home.systemImage) }
            .tag(FanPassV4Tab.home.id)

            NavigationStack {
                FanPassV5ExploreView()
                    .navigationBarTitleDisplayMode(.inline)
            }
            .tabItem { Label(FanPassV4Tab.explore.title, systemImage: FanPassV4Tab.explore.systemImage) }
            .tag(FanPassV4Tab.explore.id)

            NavigationStack {
                FanPassV4MarketView()
                    .navigationBarTitleDisplayMode(.inline)
            }
            .tabItem { Label(FanPassV4Tab.market.title, systemImage: FanPassV4Tab.market.systemImage) }
            .tag(FanPassV4Tab.market.id)

            NavigationStack {
                FanPassV4TicketsView()
                    .navigationBarTitleDisplayMode(.inline)
            }
            .tabItem { Label(FanPassV4Tab.tickets.title, systemImage: FanPassV4Tab.tickets.systemImage) }
            .tag(FanPassV4Tab.tickets.id)

            NavigationStack {
                FanPassV4ProfileView(
                    user: backend.user,
                    selectedSection: $viewModel.accountSection,
                    onSignOut: signOut
                )
                    .navigationBarTitleDisplayMode(.inline)
            }
            .tabItem { Label(FanPassV4Tab.profile.title, systemImage: FanPassV4Tab.profile.systemImage) }
            .tag(FanPassV4Tab.profile.id)
        }
        .tint(FPV5Colors.signalRed)
        .toolbarBackground(FPV5Colors.ink.opacity(0.98), for: .tabBar)
        .toolbarBackground(.visible, for: .tabBar)
        .toolbarColorScheme(.dark, for: .tabBar)
        .background(FPV5Colors.ink.ignoresSafeArea())
    }
}
