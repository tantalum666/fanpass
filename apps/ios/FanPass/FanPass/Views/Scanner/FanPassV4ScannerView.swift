import SwiftUI

struct FanPassV4ScannerView: View {
    @State private var viewModel = ScannerViewModel()
    @State private var hasSelectedEvent = true

    var body: some View {
        FanPassV4Scaffold(title: "Staff Scanner", subtitle: "Staff-only QR and NFC verification.") {
            if hasSelectedEvent {
                FPSurfaceCard(cornerRadius: FPRadius.xl) {
                    VStack(alignment: .leading, spacing: FPSpacing.lg) {
                        FPStatusPill(title: "Staff mode", systemImage: FPIcons.scanner, foreground: FPColors.warningAmber, background: FPColors.warningAmber.opacity(0.12), border: FPColors.warningAmber.opacity(0.6))
                        FPSectionHeader(title: viewModel.selectedEvent.title, subtitle: "Gate \(viewModel.selectedGate)")
                        Picker("Event", selection: $viewModel.selectedEvent) {
                            ForEach(FanPassMockData.events) { event in
                                Text(event.title).tag(event)
                            }
                        }
                        .pickerStyle(.menu)
                        .tint(FPColors.pulseCyan)
                    }
                }

                VStack(spacing: FPSpacing.md) {
                    NavigationLink {
                        FanPassV4QRScanResultView()
                    } label: {
                        scannerButtonLabel(title: "Scan QR", systemImage: FPIcons.qr)
                    }
                    .buttonStyle(.plain)

                    NavigationLink {
                        FanPassV4NFCScanResultView()
                    } label: {
                        scannerButtonLabel(title: "Scan NFC", systemImage: FPIcons.nfc)
                    }
                    .buttonStyle(.plain)

                    FPSecondaryButton(title: "Manual lookup", systemImage: "magnifyingglass") {
                        // Mock manual lookup placeholder for staff demo only.
                    }
                }

                FPTertiaryButton(title: "Clear event selection", systemImage: "minus.circle") {
                    hasSelectedEvent = false
                }
            } else {
                FPEmptyStateView(title: "No scanner event selected", message: "Select an assigned event before scanning QR or NFC credentials.", systemImage: FPIcons.scanner)
                    .frame(maxWidth: .infinity)
                    .background(FPColors.surfaceCard, in: RoundedRectangle(cornerRadius: FPRadius.lg, style: .continuous))
                FPSecondaryButton(title: "Select event", systemImage: "checkmark.circle.fill") {
                    hasSelectedEvent = true
                }
            }

            FPSurfaceCard {
                Text("Use an assigned staff device before event entry.")
                    .font(FPTypography.callout)
                    .foregroundStyle(FPColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func scannerButtonLabel(title: String, systemImage: String) -> some View {
        HStack(spacing: FPSpacing.md) {
            Image(systemName: systemImage)
                .font(.system(size: 22, weight: .semibold))
            Text(title)
                .font(FPTypography.headline)
            Spacer()
            Image(systemName: "chevron.right")
                .font(.system(size: 14, weight: .semibold))
        }
        .foregroundStyle(FPColors.textPrimary)
        .padding(FPSpacing.lg)
        .background(FPColors.surfaceGlass, in: RoundedRectangle(cornerRadius: FPRadius.lg, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: FPRadius.lg, style: .continuous)
                .stroke(FPColors.borderDivider, lineWidth: 1)
        }
    }
}

enum FanPassV4QRDemoState: String, CaseIterable, Identifiable {
    case valid
    case alreadyRedeemed
    case invalid
    case wrongEvent
    case expired
    case unknown

    var id: String { rawValue }

    var title: String {
        switch self {
        case .valid: "Valid ticket"
        case .alreadyRedeemed: "Already redeemed"
        case .invalid: "Invalid ticket"
        case .wrongEvent: "Wrong event"
        case .expired: "Expired credential"
        case .unknown: "Unknown verification error"
        }
    }

    var message: String {
        switch self {
        case .valid: "Entry accepted. The ticket can be redeemed for this event."
        case .alreadyRedeemed: "This ticket was already checked in at Gate A1."
        case .invalid: "This QR code does not match a valid FanPass ticket."
        case .wrongEvent: "The ticket is verified, but it belongs to a different event."
        case .expired: "The short-lived entry credential expired. Ask the fan to refresh the ticket."
        case .unknown: "Verification could not complete. Use manual lookup or try again."
        }
    }

    var color: Color {
        switch self {
        case .valid: FPColors.verifiedGreen
        case .alreadyRedeemed, .wrongEvent, .expired: FPColors.warningAmber
        case .invalid, .unknown: FPColors.dangerRed
        }
    }
}

struct FanPassV4QRScanResultView: View {
    @State private var selectedState: FanPassV4QRDemoState = .valid

    var body: some View {
        FanPassV4Scaffold(title: "QR Result", subtitle: "QR verification.") {
            Picker("Result state", selection: $selectedState) {
                ForEach(FanPassV4QRDemoState.allCases) { state in
                    Text(state.title).tag(state)
                }
            }
            .pickerStyle(.segmented)

            resultCard(
                title: selectedState.title,
                message: selectedState.message,
                systemImage: selectedState == .valid ? FPIcons.verified : FPIcons.warning,
                color: selectedState.color
            )
            FPSecondaryButton(title: "Scan next", systemImage: FPIcons.scanner) {
                selectedState = .valid
            }

            FPSurfaceCard {
                VStack(alignment: .leading, spacing: FPSpacing.md) {
                    FPSectionHeader(title: "Scan metadata")
                    metadataRow("Event", FanPassMockData.events[0].title)
                    metadataRow("Gate", "A1")
                    metadataRow("Ticket", "FP-ANWT...12-15")
                    metadataRow("Checked", Date().formatted(date: .omitted, time: .shortened))
                }
            }
        }
    }
}

struct FanPassV4NFCScanResultView: View {
    @State private var selectedState: ScannerViewModel.NFCScanState = .ready

    var body: some View {
        FanPassV4Scaffold(title: "NFC Result", subtitle: "NFC credential verification.") {
            Picker("NFC state", selection: $selectedState) {
                ForEach(ScannerViewModel.NFCScanState.allCases) { state in
                    Text(state.title).tag(state)
                }
            }
            .pickerStyle(.menu)
            .tint(FPColors.pulseCyan)

            FPSurfaceCard(cornerRadius: FPRadius.xl) {
                VStack(alignment: .leading, spacing: FPSpacing.lg) {
                    FPNFCIndicator(title: selectedState.title)
                    Text(nfcMessage)
                        .font(FPTypography.headline)
                        .foregroundStyle(FPColors.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                    Text("NFC checks the ticket without showing private details.")
                        .font(FPTypography.caption)
                        .foregroundStyle(FPColors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    private var nfcMessage: String {
        switch selectedState {
        case .ready: "Hold the fan ticket near the scanner device."
        case .scanning: "Reading credential..."
        case .valid: "Valid NFC credential. Entry may be accepted."
        case .invalid: "Invalid NFC credential. Ask for QR or manual lookup."
        case .alreadyRedeemed: "This ticket has already been redeemed."
        case .unreadable: "The NFC tag could not be read. Hold again or use QR."
        case .expired: "The NFC credential expired. Ask the fan to refresh their ticket."
        }
    }
}

private func resultCard(title: String, message: String, systemImage: String, color: Color) -> some View {
    FPSurfaceCard(cornerRadius: FPRadius.xl) {
        VStack(alignment: .leading, spacing: FPSpacing.lg) {
            Image(systemName: systemImage)
                .font(.system(size: 46, weight: .bold))
                .foregroundStyle(color)
            Text(title)
                .font(FPTypography.title1)
                .foregroundStyle(FPColors.textPrimary)
            Text(message)
                .font(FPTypography.callout)
                .foregroundStyle(FPColors.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

private func metadataRow(_ title: String, _ value: String) -> some View {
    HStack(alignment: .top) {
        Text(title)
            .font(FPTypography.caption)
            .foregroundStyle(FPColors.textSecondary)
            .frame(width: 82, alignment: .leading)
        Text(value)
            .font(FPTypography.callout)
            .foregroundStyle(FPColors.textPrimary)
            .fixedSize(horizontal: false, vertical: true)
        Spacer(minLength: 0)
    }
}

#Preview {
    FanPassV4ScannerView()
}
