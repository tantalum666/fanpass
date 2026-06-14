import SwiftUI
#if DEBUG
import UIKit
#endif

struct AuthView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    let title: String
    @State private var mode: AuthMode = .register
    @State private var name = ""
    @State private var email = ""
    @State private var emailCode = ""
    @State private var hasRequestedPrivyCode = false
    @State private var isSubmitting = false
    @State private var isSendingCode = false
    @State private var errorMessage: String?

    init(title: String = "Sign in to FanPass") {
        self.title = title
    }

    var body: some View {
        NavigationStack {
            FanPassScreen {
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("FanPass")
                                .font(.system(size: 36, weight: .black, design: .rounded))
                                .foregroundStyle(FanPassTheme.ink)

                            HStack(spacing: 8) {
                                StatusPill(text: "Verified entry", color: FanPassTheme.mint)
                                StatusPill(text: "Fair access", color: FanPassTheme.accent)
                            }
                        }

                        SoftCard {
                            VStack(alignment: .leading, spacing: 20) {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text(title)
                                        .font(.title2.weight(.bold))
                                        .foregroundStyle(FanPassTheme.ink)
                                    Text("Use a fan account for tickets, orders, and access rewards.")
                                        .font(.subheadline)
                                        .foregroundStyle(.secondary)
                                        .lineLimit(2)
                                        .fixedSize(horizontal: false, vertical: true)
                                }

                                Picker("Auth mode", selection: $mode) {
                                    ForEach(AuthMode.allCases) { candidate in
                                        Text(candidate.title).tag(candidate)
                                    }
                                }
                                .pickerStyle(.segmented)
                                .tint(FanPassTheme.accent)

                                VStack(spacing: 14) {
                                    if mode == .register {
                                        TextField("Full name", text: $name)
                                            .textContentType(.name)
                                            .textInputAutocapitalization(.words)
                                            .submitLabel(.next)
                                    }

                                    TextField("Email", text: $email)
                                        .keyboardType(.emailAddress)
                                        .textContentType(.emailAddress)
                                        .textInputAutocapitalization(.never)
                                        .autocorrectionDisabled()
                                        .submitLabel(mode == .privyEmail ? .next : .done)

                                    if mode == .privyEmail {
                                        TextField("One-time code", text: $emailCode)
                                            .keyboardType(.numberPad)
                                            .textContentType(.oneTimeCode)
                                            .textInputAutocapitalization(.never)
                                            .autocorrectionDisabled()
                                            .submitLabel(.done)
                                            .disabled(!hasRequestedPrivyCode)
                                    }
                                }
                                .textFieldStyle(.roundedBorder)

                                if mode == .privyEmail && !appState.privyAuthProvider.isAvailable {
                                    Text("Email login is temporarily unavailable.")
                                        .font(.footnote.weight(.semibold))
                                        .foregroundStyle(FanPassTheme.amber)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                }

                                if let errorMessage {
                                    Text(errorMessage)
                                        .font(.footnote.weight(.semibold))
                                        .foregroundStyle(FanPassTheme.coral)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                }

                                if mode == .privyEmail {
                                    Button {
                                        sendPrivyCode()
                                    } label: {
                                        HStack {
                                            if isSendingCode {
                                                ProgressView()
                                            }
                                            Text(hasRequestedPrivyCode ? "Resend code" : "Send code")
                                        }
                                        .frame(maxWidth: .infinity)
                                    }
                                    .buttonStyle(.bordered)
                                    .disabled(isSendingCode || !isValidEmail || !appState.privyAuthProvider.isAvailable)

                                }

                                Button {
                                    submit()
                                } label: {
                                    HStack {
                                        if isSubmitting {
                                            ProgressView()
                                        }
                                        Text(mode.primaryActionTitle)
                                    }
                                    .frame(maxWidth: .infinity)
                                }
                                .buttonStyle(.borderedProminent)
                                .disabled(isSubmitting || !canSubmit)

                                #if DEBUG
                                Button {
                                    usePastedPrivyToken()
                                } label: {
                                    Label("Use clipboard session", systemImage: "doc.on.clipboard")
                                        .frame(maxWidth: .infinity)
                                }
                                .buttonStyle(.bordered)
                                .disabled(isSubmitting)
                                #endif

                                Button {
                                    continueDemo()
                                } label: {
                                    Label("Continue browsing", systemImage: "person.crop.circle.badge.checkmark")
                                        .frame(maxWidth: .infinity)
                                }
                                .buttonStyle(.bordered)
                            }
                        }

                        Spacer(minLength: 32)
                    }
                    .padding(24)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Close") {
                        appState.authRequest = nil
                        dismiss()
                    }
                }
            }
        }
    }

    private var canSubmit: Bool {
        switch mode {
        case .register:
            !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && isValidEmail
        case .login:
            isValidEmail
        case .privyEmail:
            isValidEmail &&
                hasRequestedPrivyCode &&
                !emailCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
                appState.privyAuthProvider.isAvailable
        }
    }

    private var isValidEmail: Bool {
        email.contains("@") && email.contains(".")
    }

    private func submit() {
        isSubmitting = true
        errorMessage = nil

        Task {
            do {
                switch mode {
                case .register:
                    try await appState.register(name: name, email: email)
                case .login:
                    try await appState.login(email: email)
                case .privyEmail:
                    try await appState.loginWithPrivyEmailCode(
                        email: email.trimmingCharacters(in: .whitespacesAndNewlines),
                        code: emailCode.trimmingCharacters(in: .whitespacesAndNewlines)
                    )
                }
            } catch {
                #if DEBUG
                errorMessage = "\(mode.failureMessage) \(error.localizedDescription)"
                #else
                errorMessage = mode.failureMessage
                #endif
            }
            isSubmitting = false
        }
    }

    private func sendPrivyCode() {
        isSendingCode = true
        errorMessage = nil

        Task {
            do {
                try await appState.sendPrivyEmailCode(email: email.trimmingCharacters(in: .whitespacesAndNewlines))
                hasRequestedPrivyCode = true
            } catch {
                #if DEBUG
                errorMessage = "Could not send this code. \(error.localizedDescription)"
                #else
                errorMessage = "Could not send this code."
                #endif
            }
            isSendingCode = false
        }
    }

    private func continueDemo() {
        isSubmitting = true
        errorMessage = nil

        Task {
            do {
                try await appState.continueAsDemoFan()
            } catch {
                errorMessage = "Could not continue."
            }
            isSubmitting = false
        }
    }

    #if DEBUG
    private func usePastedPrivyToken() {
        let token = UIPasteboard.general.string?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !token.isEmpty else {
            errorMessage = "No session token found on the clipboard."
            return
        }

        isSubmitting = true
        errorMessage = nil

        Task {
            do {
                try await appState.loginWithPrivyAccessToken(token)
            } catch {
                errorMessage = "Could not use clipboard session. \(error.localizedDescription)"
            }
            isSubmitting = false
        }
    }
    #endif
}

private enum AuthMode: String, CaseIterable, Identifiable {
    case register
    case login
    case privyEmail

    var id: String { rawValue }

    var title: String {
        switch self {
        case .register: "Register"
        case .login: "Sign in"
        case .privyEmail: "Email code"
        }
    }

    var primaryActionTitle: String {
        switch self {
        case .register: "Create fan account"
        case .login: "Sign in"
        case .privyEmail: "Verify code"
        }
    }

    var failureMessage: String {
        switch self {
        case .register: "Could not create this account."
        case .login: "No fan account was found for this email."
        case .privyEmail: "Could not verify this code."
        }
    }
}

#Preview {
    AuthView()
        .environment(AppState())
}
