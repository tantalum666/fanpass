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
        context.coordinator.present(
            request: request,
            from: viewController,
            clientSecret: clientSecret,
            publishableKey: publishableKey,
            returnURL: returnURL,
            clearRequest: {
                presentationRequest = nil
            },
            onResult: onResult
        )
    }

    final class Coordinator {
        var lastRequest: UUID?

        func present(
            request: UUID,
            from viewController: UIViewController,
            clientSecret: String,
            publishableKey: String,
            returnURL: String,
            clearRequest: @escaping () -> Void,
            onResult: @escaping (FanPassStripeCheckoutResult) -> Void
        ) {
            STPAPIClient.shared.publishableKey = publishableKey

            var configuration = PaymentSheet.Configuration()
            configuration.merchantDisplayName = "FanPass"
            configuration.returnURL = returnURL
            configuration.allowsDelayedPaymentMethods = false

            let paymentSheet = PaymentSheet(
                paymentIntentClientSecret: clientSecret,
                configuration: configuration
            )

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) { [weak self] in
                self?.attemptPresentation(
                    request: request,
                    retriesRemaining: 6,
                    paymentSheet: paymentSheet,
                    fallback: viewController,
                    clearRequest: clearRequest,
                    onResult: onResult
                )
            }
        }

        private func attemptPresentation(
            request: UUID,
            retriesRemaining: Int,
            paymentSheet: PaymentSheet,
            fallback: UIViewController,
            clearRequest: @escaping () -> Void,
            onResult: @escaping (FanPassStripeCheckoutResult) -> Void
        ) {
            guard lastRequest == request else {
                return
            }

            let presentingController = currentPresentingController(fallback: fallback)
            guard presentingController.viewIfLoaded?.window != nil,
                  presentingController.transitionCoordinator == nil,
                  !presentingController.isBeingPresented,
                  !presentingController.isBeingDismissed
            else {
                retryOrFail(
                    request: request,
                    retriesRemaining: retriesRemaining,
                    paymentSheet: paymentSheet,
                    fallback: fallback,
                    clearRequest: clearRequest,
                    onResult: onResult
                )
                return
            }

            paymentSheet.present(from: presentingController) { result in
                switch result {
                case .completed:
                    onResult(.completed)
                case .canceled:
                    onResult(.canceled)
                case let .failed(error):
                    onResult(.failed(error.localizedDescription))
                }
                clearRequest()
            }
        }

        private func retryOrFail(
            request: UUID,
            retriesRemaining: Int,
            paymentSheet: PaymentSheet,
            fallback: UIViewController,
            clearRequest: @escaping () -> Void,
            onResult: @escaping (FanPassStripeCheckoutResult) -> Void
        ) {
            guard retriesRemaining > 0 else {
                clearRequest()
                onResult(.failed("Stripe checkout could not open. Try again after the current screen finishes loading."))
                return
            }

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.16) { [weak self] in
                self?.attemptPresentation(
                    request: request,
                    retriesRemaining: retriesRemaining - 1,
                    paymentSheet: paymentSheet,
                    fallback: fallback,
                    clearRequest: clearRequest,
                    onResult: onResult
                )
            }
        }
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
