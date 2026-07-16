import type {
  AlphaEvent,
  AlphaOperations,
  EventOperationsView,
  MarketLevel,
  MarketSnapshot,
  OrderRecord,
  TicketType,
  TradeRecord,
} from "./types";

export function eventOperations(
  operations: AlphaOperations,
  event: AlphaEvent,
): EventOperationsView {
  const ticketIds = new Set(
    operations.tickets
      .filter((ticket) => ticket.eventId === event.id)
      .map((ticket) => ticket.id),
  );

  return {
    event,
    tickets: operations.tickets.filter((ticket) => ticket.eventId === event.id),
    orders: operations.orders.filter((order) => order.eventId === event.id),
    payments: operations.payments.filter(
      (payment) => payment.eventId === event.id,
    ),
    trades: operations.trades.filter((trade) => trade.eventId === event.id),
    gateAssignments: operations.gateAssignments.filter(
      (assignment) => assignment.eventId === event.id,
    ),
    checkins: operations.checkins.filter(
      (checkin) =>
        checkin.eventId === event.id || ticketIds.has(checkin.ticketId),
    ),
    fanCampaigns: operations.fanCampaigns.filter(
      (campaign) => campaign.eventId === event.id,
    ),
    fanTaskSubmissions: operations.fanTaskSubmissions.filter(
      (submission) => submission.eventId === event.id,
    ),
  };
}

export function issuedForTicketType(
  operations: EventOperationsView,
  ticketTypeId: string,
) {
  return operations.tickets.filter(
    (ticket) => ticket.ticketTypeId === ticketTypeId,
  ).length;
}

export function sellThrough(
  operations: EventOperationsView,
  ticketType: TicketType,
) {
  if (ticketType.supply <= 0) {
    return 0;
  }
  return (
    (issuedForTicketType(operations, ticketType.id) / ticketType.supply) * 100
  );
}

export function buildMarketSnapshot(
  event: AlphaEvent,
  ticketType: TicketType,
  orders: OrderRecord[],
  trades: TradeRecord[],
): MarketSnapshot {
  const marketOrders = orders.filter(
    (order) => order.ticketTypeId === ticketType.id && order.status === "OPEN",
  );
  const marketTrades = trades
    .filter(
      (trade) =>
        trade.ticketTypeId === ticketType.id &&
        trade.settlementStatus === "SETTLED",
    )
    .sort(
      (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt),
    );
  const asks = aggregateLevels(
    marketOrders.filter((order) => order.side === "SELL"),
    "asc",
  );
  const bids = aggregateLevels(
    marketOrders.filter((order) => order.side === "BUY"),
    "desc",
  );
  const lastTradePrice = marketTrades.at(-1)?.price ?? null;
  const floorPrice = asks[0]?.price ?? null;
  const highestBid = bids[0]?.price ?? null;

  return {
    eventId: event.id,
    eventTitle: event.title,
    ticketTypeId: ticketType.id,
    ticketTypeName: ticketType.name,
    currency: ticketType.currency,
    faceValue: ticketType.faceValue,
    resaleCap: ticketType.resaleCap,
    bids,
    asks,
    lastTradePrice,
    floorPrice,
    highestBid,
    spread:
      floorPrice === null || highestBid === null
        ? null
        : floorPrice - highestBid,
    volume: marketTrades.length,
    premiumPercent:
      lastTradePrice === null
        ? null
        : ((lastTradePrice - ticketType.faceValue) / ticketType.faceValue) *
          100,
    priceHistory: marketTrades.map((trade) => ({
      tradeId: trade.id,
      price: trade.price,
      fee: trade.fee,
      premiumPercent:
        ((trade.price - ticketType.faceValue) / ticketType.faceValue) * 100,
      createdAt: trade.createdAt,
    })),
  };
}

function aggregateLevels(
  orders: OrderRecord[],
  direction: "asc" | "desc",
): MarketLevel[] {
  const quantities = new Map<number, number>();
  for (const order of orders) {
    quantities.set(
      order.price,
      (quantities.get(order.price) ?? 0) + order.remainingQuantity,
    );
  }
  const multiplier = direction === "asc" ? 1 : -1;
  return Array.from(quantities, ([price, quantity]) => ({
    price,
    quantity,
  })).sort((left, right) => (left.price - right.price) * multiplier);
}
