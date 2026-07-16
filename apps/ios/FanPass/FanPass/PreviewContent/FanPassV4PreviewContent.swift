import Foundation

#if DEBUG
enum FanPassV4PreviewContent {
    static let user = FanPassMockData.currentUser
    static let staff = FanPassMockData.staffUser
    static let event = FanPassMockData.events[0]
    static let ticket = FanPassMockData.tickets[0]
    static let listing = FanPassMockData.listings[0]
    static let scanAccepted = FanPassMockData.scanResults[0]
}
#endif
