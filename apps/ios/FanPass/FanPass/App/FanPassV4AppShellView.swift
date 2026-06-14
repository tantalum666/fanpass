import SwiftUI

struct FanPassV4AppShellView: View {
    @State private var viewModel = FanPassRootViewModel()
    @State private var backend = FanPassBackendContext()

    var body: some View {
        Group {
            switch viewModel.stage {
            case .splash:
                FanPassV4SplashView {
                    viewModel.finishSplash()
                }
            case .onboarding:
                FanPassV4OnboardingView {
                    viewModel.finishOnboarding()
                }
            case .login:
                FanPassV4LoginView(
                    signIn: {
                        viewModel.browseEvents()
                    },
                    accountSignIn: {
                        viewModel.openPrivySignIn()
                    }
                )
            case .main:
                FanPassV4MainTabView(viewModel: viewModel) {
                    Task {
                        await backend.signOut()
                        viewModel.stage = .main
                        viewModel.selectedTab = .home
                        viewModel.selectedTabID = FanPassV4Tab.home.id
                    }
                }
            }
        }
        .environment(backend)
        .environment(viewModel)
        .background(FPColors.backgroundNight)
        .preferredColorScheme(.dark)
    }
}

#Preview {
    FanPassV4AppShellView()
}
