import StripePaymentSheet
import SwiftUI
import UIKit

enum FanPassStripeCheckoutResult: Equatable {
    case completed
    case canceled
    case failed(String)

    var message: String {
        switch self {
        case .completed:
            "Payment authorization completed. Waiting for backend webhook settlement."
        case .canceled:
            "Payment authorization was canceled."
        case let .failed(message):
            message
        }
    }
}

struct FanPassStripePaymentSheetPresenter: UIViewControllerRepresentable {
    let clientSecret: String
    let publishableKey: String
    let returnURL: String
    @Binding var presentationRequest: UUID?
    let onResult: (FanPassStripeCheckoutResult) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIViewController(context: Context) -> UIViewController {
        UIViewController()
    }

    func updateUIViewController(_ viewController: UIViewController, context: Context) {
        guard let request = presentationRequest,
              context.coordinator.lastRequest != request
        else {
            return
        }

        context.coordinator.lastRequest = request
        STPAPIClient.shared.publishableKey = publishableKey

        var configuration = PaymentSheet.Configuration()
        configuration.returnURL = returnURL
        configuration.allowsDelayedPaymentMethods = false

        let paymentSheet = PaymentSheet(
            paymentIntentClientSecret: clientSecret,
            configuration: configuration
        )

        DispatchQueue.main.async {
            let presentingController = currentPresentingController(fallback: viewController)
            paymentSheet.present(from: presentingController) { result in
                switch result {
                case .completed:
                    onResult(.completed)
                case .canceled:
                    onResult(.canceled)
                case let .failed(error):
                    onResult(.failed(error.localizedDescription))
                }
                presentationRequest = nil
            }
        }
    }

    final class Coordinator {
        var lastRequest: UUID?
    }
}

private func currentPresentingController(fallback: UIViewController) -> UIViewController {
    let activeScene = UIApplication.shared.connectedScenes
        .compactMap { $0 as? UIWindowScene }
        .first { $0.activationState == .foregroundActive }

    guard let rootViewController = activeScene?.windows.first(where: \.isKeyWindow)?.rootViewController else {
        return fallback.fanPassTopMostViewController()
    }

    return rootViewController.fanPassTopMostViewController()
}

private extension UIViewController {
    func fanPassTopMostViewController() -> UIViewController {
        if let presentedViewController {
            return presentedViewController.fanPassTopMostViewController()
        }
        if let navigationController = self as? UINavigationController,
           let visibleViewController = navigationController.visibleViewController {
            return visibleViewController.fanPassTopMostViewController()
        }
        if let tabBarController = self as? UITabBarController,
           let selectedViewController = tabBarController.selectedViewController {
            return selectedViewController.fanPassTopMostViewController()
        }
        return self
    }
}
