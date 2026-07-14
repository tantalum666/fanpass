import { useEffect, useMemo, useState } from "react";
import {
  formatDateTime,
  formatMoney,
  shortId,
  titleCase,
} from "../../console/format";
import { buildMarketSnapshot } from "../../console/operations";
import type { EventOperationsView } from "../../console/types";
import {
  Badge,
  EmptyState,
  PageHeader,
  Section,
  StatStrip,
  TableFrame,
  toneForStatus,
} from "../../components/ConsoleUi";
import { OrderbookLivePanel } from "../../OrderbookLivePanel";
import { PriceHistoryChart } from "./PriceHistoryChart";

type SalesTab = "orders" | "trades" | "payments";

export function SalesPage({ eventView }: { eventView: EventOperationsView }) {
  const ticketTypes = eventView.event.ticketTypes;
  const [ticketTypeId, setTicketTypeId] = useState(ticketTypes[0]?.id ?? "");
  const [tab, setTab] = useState<SalesTab>("orders");

  useEffect(() => {
    if (!ticketTypes.some((ticketType) => ticketType.id === ticketTypeId)) {
      setTicketTypeId(ticketTypes[0]?.id ?? "");
    }
  }, [ticketTypeId, ticketTypes]);

  const selectedTicketType =
    ticketTypes.find((ticketType) => ticketType.id === ticketTypeId) ?? null;
  const market = useMemo(
    () =>
      selectedTicketType
        ? buildMarketSnapshot(
            eventView.event,
            selectedTicketType,
            eventView.orders,
            eventView.trades,
          )
        : null,
    [eventView.event, eventView.orders, eventView.trades, selectedTicketType],
  );
  const openOrders = eventView.orders.filter(
    (order) => order.ticketTypeId === ticketTypeId && order.status === "OPEN",
  );
  const trades = eventView.trades.filter(
    (trade) => trade.ticketTypeId === ticketTypeId,
  );
  const grossVolume = trades
    .filter((trade) => trade.settlementStatus === "SETTLED")
    .reduce((sum, trade) => sum + trade.price, 0);

  return (
    <>
      <PageHeader
        eyebrow="Commerce"
        title="Sales & market"
        description="Monitor primary payments and the verified resale market in the current event context."
        actions={
          ticketTypes.length > 0 ? (
            <label className="inline-select">
              <span>Ticket type</span>
              <select
                value={ticketTypeId}
                onChange={(event) => setTicketTypeId(event.target.value)}
              >
                {ticketTypes.map((ticketType) => (
                  <option key={ticketType.id} value={ticketType.id}>
                    {ticketType.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null
        }
      />

      {!market || !selectedTicketType ? (
        <EmptyState
          title="No market to monitor"
          description="Add at least one ticket type in Events & inventory to initialize this workspace."
        />
      ) : (
        <>
          <StatStrip
            items={[
              {
                label: "Face value",
                value: formatMoney(market.faceValue, market.currency),
                meta: selectedTicketType.name,
              },
              {
                label: "Last resale",
                value:
                  market.lastTradePrice === null
                    ? "—"
                    : formatMoney(market.lastTradePrice, market.currency),
                meta: market.volume
                  ? `${market.volume} settled trades`
                  : "No settled trades",
              },
              {
                label: "Best ask",
                value:
                  market.floorPrice === null
                    ? "—"
                    : formatMoney(market.floorPrice, market.currency),
                meta: `${market.asks.length} ask levels`,
              },
              {
                label: "Best bid",
                value:
                  market.highestBid === null
                    ? "—"
                    : formatMoney(market.highestBid, market.currency),
                meta: `${market.bids.length} bid levels`,
              },
              {
                label: "Gross resale",
                value: formatMoney(grossVolume, market.currency),
                meta: `${openOrders.length} open orders`,
              },
            ]}
          />

          <div className="content-columns content-columns--market">
            <Section
              title="Live orderbook"
              description={`${eventView.event.title} · ${selectedTicketType.name}`}
            >
              <OrderbookLivePanel market={market} />
            </Section>
            <Section
              title="Settled price history"
              description="Verified resale settlements only."
            >
              <PriceHistoryChart market={market} />
            </Section>
          </div>
        </>
      )}

      <Section
        title="Sales ledger"
        description="Review lifecycle records without leaving the selected event."
        action={
          <div
            className="segmented-control"
            role="tablist"
            aria-label="Sales ledger view"
          >
            {(["orders", "trades", "payments"] as SalesTab[]).map((item) => (
              <button
                aria-selected={tab === item}
                className={tab === item ? "is-active" : ""}
                key={item}
                onClick={() => setTab(item)}
                role="tab"
                type="button"
              >
                {titleCase(item)}
              </button>
            ))}
          </div>
        }
      >
        {tab === "orders" ? <OrdersTable eventView={eventView} /> : null}
        {tab === "trades" ? <TradesTable eventView={eventView} /> : null}
        {tab === "payments" ? <PaymentsTable eventView={eventView} /> : null}
      </Section>
    </>
  );
}

function OrdersTable({ eventView }: { eventView: EventOperationsView }) {
  if (eventView.orders.length === 0) {
    return (
      <EmptyState
        title="No orders"
        description="Primary and resale orders will appear here."
      />
    );
  }
  const ticketTypes = new Map(
    eventView.event.ticketTypes.map((type) => [type.id, type]),
  );
  return (
    <TableFrame>
      <table className="data-table">
        <thead>
          <tr>
            <th>Created</th>
            <th>Side</th>
            <th>Ticket type</th>
            <th>Price</th>
            <th>Quantity</th>
            <th>Status</th>
            <th>User</th>
          </tr>
        </thead>
        <tbody>
          {eventView.orders.map((order) => (
            <tr key={order.id}>
              <td>{formatDateTime(order.createdAt)}</td>
              <td>
                <Badge tone={order.side === "BUY" ? "info" : "warning"}>
                  {order.side}
                </Badge>
              </td>
              <td>
                {ticketTypes.get(order.ticketTypeId)?.name ??
                  shortId(order.ticketTypeId)}
              </td>
              <td>{formatMoney(order.price)}</td>
              <td>{order.remainingQuantity}</td>
              <td>
                <Badge tone={toneForStatus(order.status)}>
                  {titleCase(order.status)}
                </Badge>
              </td>
              <td className="mono-cell">{shortId(order.userId)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}

function TradesTable({ eventView }: { eventView: EventOperationsView }) {
  if (eventView.trades.length === 0) {
    return (
      <EmptyState
        title="No settled trades"
        description="Completed resale matches will appear here."
      />
    );
  }
  return (
    <TableFrame>
      <table className="data-table">
        <thead>
          <tr>
            <th>Settled</th>
            <th>Trade</th>
            <th>Ticket type</th>
            <th>Price</th>
            <th>Fee</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {eventView.trades.map((trade) => (
            <tr key={trade.id}>
              <td>{formatDateTime(trade.createdAt)}</td>
              <td className="mono-cell">{shortId(trade.id)}</td>
              <td>{trade.ticketTypeName}</td>
              <td>{formatMoney(trade.price)}</td>
              <td>{formatMoney(trade.fee)}</td>
              <td>
                <Badge tone={toneForStatus(trade.settlementStatus)}>
                  {titleCase(trade.settlementStatus)}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}

function PaymentsTable({ eventView }: { eventView: EventOperationsView }) {
  if (eventView.payments.length === 0) {
    return (
      <EmptyState
        title="No payments"
        description="Payment authorization and capture records will appear here."
      />
    );
  }
  return (
    <TableFrame>
      <table className="data-table">
        <thead>
          <tr>
            <th>Updated</th>
            <th>Payment</th>
            <th>Amount</th>
            <th>Payment status</th>
            <th>Capture</th>
            <th>User</th>
          </tr>
        </thead>
        <tbody>
          {eventView.payments.map((payment) => (
            <tr key={payment.id}>
              <td>{formatDateTime(payment.updatedAt)}</td>
              <td className="mono-cell">{shortId(payment.id)}</td>
              <td>{formatMoney(payment.amount, payment.currency)}</td>
              <td>
                <Badge tone={toneForStatus(payment.status)}>
                  {titleCase(payment.status)}
                </Badge>
              </td>
              <td>
                <Badge tone={toneForStatus(payment.captureStatus)}>
                  {titleCase(payment.captureStatus)}
                </Badge>
              </td>
              <td className="mono-cell">{shortId(payment.userId)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}
