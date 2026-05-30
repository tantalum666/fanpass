import StripeCore
import SwiftUI

@main
struct FanPassApp: App {
    @State private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            AppShellView()
                .environment(appState)
                .onOpenURL { url in
                    _ = StripeAPI.handleURLCallback(with: url)
                }
        }
    }
}
