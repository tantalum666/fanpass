import StripeCore
import SwiftUI

@main
struct FanPassApp: App {
    var body: some Scene {
        WindowGroup {
            FanPassV4AppShellView()
                .onOpenURL { url in
                    _ = StripeAPI.handleURLCallback(with: url)
                }
        }
    }
}
