import { Metric } from "./Metric";
import {
  formatDay,
  formatMoney,
  formatMonth,
  headlineFor,
  heroImageFor,
  lowestListing,
  lowestPrice,
  orderbookRows,
  seatOptionsFor,
  sublineFor,
} from "../lib/viewHelpers";
import type { MarketListing, OrderbookSnapshot, UserOrder, UserTicket, WebEvent } from "../types";

interface TerminalConceptProps {
  event: WebEvent;
  tickets: UserTicket[];
  listings: MarketListing[];
  orderbook: OrderbookSnapshot | null;
  orderbookSource: "Live API" | "Demo depth";
  actionStatus: string;
  sellOrders: UserOrder[];
  cancellingOrderId: string | null;
  onOpenEvent: (event: WebEvent) => void;
  onReviewOrder: (event: WebEvent, price: number) => void;
  onCancelListing: (order: UserOrder) => void;
}

export function TerminalConcept({
  event,
  tickets,
  listings,
  orderbook,
  orderbookSource,
  actionStatus,
  sellOrders,
  cancellingOrderId,
  onOpenEvent,
  onReviewOrder,
  onCancelListing,
}: TerminalConceptProps) {
  const currency = event.ticketTypes[0]?.currency ?? "HKD";
  const rows = orderbookRows(orderbook);
  const askRows = rows.filter((row) => row.side === "ask").slice(0, 5);
  const bidRows = rows.filter((row) => row.side === "bid").slice(0, 5);
  const seatOptions = seatOptionsFor(event);
  const featuredSeat = seatOptions.find((option) => option.featured) ?? seatOptions[0];
  const lastPrice =
    orderbook?.lastTradePrice ?? orderbook?.floorPrice ?? lowestListing(listings) ?? lowestPrice(event);
  const buyLimitPrice = askRows[0]?.price ?? lastPrice;
  const volume = orderbook ? Math.max(orderbook.volume, rows.reduce((sum, row) => sum + row.qty, 0)) : 1245;
  const sales24h = Math.max(lastPrice * Math.max(1, Math.round(volume * 0.18)), lastPrice);
  const walletRows = [
    { name: featuredSeat?.name ?? "Lower 200", status: "Listed", price: lastPrice },
    { name: "Lower 100", status: "Held", price: Math.round(lastPrice * 1.24) },
    { name: "Upper 200", status: "Held", price: Math.round(lastPrice * 0.42) },
  ];
  const activityRows = [
    { event: "Sold", detail: `${featuredSeat?.name ?? "Lower 200"} Row 11`, price: Math.round(lastPrice * 0.98), time: "2h ago" },
    { event: "Listed", detail: `${featuredSeat?.name ?? "Lower 200"} Row 9`, price: lastPrice, time: "3h ago" },
    { event: "Purchased", detail: "Upper 100 Row 18", price: Math.round(lastPrice * 0.44), time: "1d ago" },
  ];
  const tapeRows = rows.slice(0, 5).map((row, index) => ({
    time: ["14:02:16", "14:01:42", "14:01:08", "14:00:51", "13:59:37"][index],
    side: row.side === "ask" ? "Ask posted" : "Bid lifted",
    price: row.price,
    qty: row.qty,
  }));

  return (
    <section className="product-view terminal-concept">
      <div className="terminal-event-strip">
        <div className="date-tile"><strong>{formatDay(event.startsAt)}</strong><span>{formatMonth(event.startsAt)}</span></div>
        <img src={heroImageFor(event)} alt="" />
        <div>
          <h1>{headlineFor(event)}</h1>
          <p>{sublineFor(event)}</p>
          <div className="mini-tags"><span>Concert</span><span>Pop</span><span>Event details</span></div>
        </div>
        <Metric label="Market status" value="Open" />
        <Metric label="Time to event" value="16d 4h" />
        <Metric label="Price cap" value={formatMoney(event.ticketTypes[0]?.resaleCap ?? 680, event.ticketTypes[0]?.currency ?? "HKD")} />
        <Metric label="Volume" value={`${volume} tickets`} />
        <Metric label="Sales (24h)" value={formatMoney(sales24h, currency)} />
      </div>
      <div className="terminal-grid">
        <section className="orderbook-panel">
          <div className="panel-heading"><span>Orderbook / {orderbookSource}</span><strong>{formatMoney(lastPrice, currency)}</strong></div>
          <div className="book-table">
            <div className="book-head">
              <span>Price</span>
              <p>Qty</p>
              <strong>Total</strong>
            </div>
            {askRows.map((row) => (
              <div key={`${row.price}-${row.side}`} className={row.side}>
                <span>{formatMoney(row.price, currency)}</span><p>{row.qty}</p><strong>{formatMoney(row.total, currency)}</strong>
              </div>
            ))}
            <div className="book-last-price">
              <strong>{formatMoney(lastPrice, currency)}</strong>
              <span>Last price</span>
            </div>
            {bidRows.map((row) => (
              <div key={`${row.price}-${row.side}`} className={row.side}>
                <span>{formatMoney(row.price, currency)}</span><p>{row.qty}</p><strong>{formatMoney(row.total, currency)}</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="depth-panel">
          <div className="panel-heading"><span>Market depth</span><strong><i /> Asks <b /> Bids</strong></div>
          <svg viewBox="0 0 520 270" role="img" aria-label="Market depth chart">
            <defs>
              <linearGradient id="askDepthFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#f24f54" stopOpacity="0.24" />
                <stop offset="100%" stopColor="#f24f54" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="bidDepthFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#51d98b" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#51d98b" stopOpacity="0" />
              </linearGradient>
            </defs>
            <g className="depth-grid">
              <line x1="18" x2="500" y1="60" y2="60" />
              <line x1="18" x2="500" y1="124" y2="124" />
              <line x1="18" x2="500" y1="188" y2="188" />
            </g>
            <path className="depth-fill ask-fill" d="M18 52 L82 66 L128 104 L170 132 L220 188 L266 214 L266 232 L18 232 Z" />
            <path className="depth-fill bid-fill" d="M266 214 L310 180 L360 155 L420 132 L500 116 L500 232 L266 232 Z" />
            <path className="depth-line ask-line" d="M18 52 L82 66 L128 104 L170 132 L220 188 L266 214" />
            <path className="depth-line bid-line" d="M266 214 L310 180 L360 155 L420 132 L500 116" />
            <line className="depth-midline" x1="266" x2="266" y1="36" y2="232" />
            <g className="depth-axis">
              <text x="18" y="250">{formatMoney(Math.round(lastPrice * 0.86), currency)}</text>
              <text x="228" y="250">{formatMoney(lastPrice, currency)}</text>
              <text x="436" y="250">{formatMoney(Math.round(lastPrice * 1.14), currency)}</text>
            </g>
            <text className="depth-last-label" x="278" y="168">Last {formatMoney(lastPrice, currency)}</text>
          </svg>
          <div className="range-tabs"><span>1H</span><span>6H</span><strong>24H</strong><span>7D</span><span>30D</span></div>
        </section>
        <section className="trade-panel">
          <div className="buy-sell"><button type="button">Buy</button><button type="button">Sell</button></div>
          <label>Ticket type<select><option>{featuredSeat?.name ?? "Lower 200"}</option></select></label>
          <label>Quantity<input value="2" readOnly /></label>
          <label>Limit price<input value={String(buyLimitPrice)} readOnly /></label>
          <div className="price-cap-row"><span>Price cap</span><strong>{formatMoney(event.ticketTypes[0]?.resaleCap ?? 680, currency)}</strong><button type="button">Edit</button></div>
          <div className="trade-total"><span>Est. total</span><strong>{formatMoney(buyLimitPrice * 2, currency)}</strong></div>
          <button type="button" onClick={() => onReviewOrder(event, buyLimitPrice)}>Review order</button>
          <div className="trade-preferences">
            <div><span>Auto relist</span><strong>On</strong></div>
            <div><span>Smart pricing</span><strong>Recommended</strong></div>
          </div>
          <p className="trade-status">{actionStatus}</p>
        </section>
        <section className="wallet-panel">
          <div className="panel-heading"><span>Your wallet</span><strong>{tickets.length + 3}</strong></div>
          {walletRows.map((row) => (
            <div className="wallet-line" key={row.name}><span>{row.name}</span><strong>{row.status}</strong><p>{formatMoney(row.price, currency)} ea</p></div>
          ))}
          {sellOrders.length > 0 && (
            <div className="open-listings" aria-label="Your open resale listings">
              <span>Your open listings</span>
              {sellOrders.slice(0, 3).map((order) => (
                <div key={order.id}>
                  <p>{seatLabelFor(order, event)}</p>
                  <strong>{formatMoney(order.total, currency)} ea</strong>
                  <button
                    type="button"
                    disabled={cancellingOrderId === order.id}
                    onClick={() => onCancelListing(order)}
                  >
                    {cancellingOrderId === order.id ? "Cancelling" : "Cancel"}
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="recent-activity">
            <span>Recent activity</span>
            {activityRows.map((item) => (
              <div key={`${item.event}-${item.detail}`}>
                <em aria-hidden="true" />
                <p>{item.event} / {item.detail}</p>
                <strong>{formatMoney(item.price, currency)}</strong>
                <small>{item.time}</small>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => onOpenEvent(event)}>View all orders</button>
        </section>
      </div>
      <div className="terminal-lower-grid">
        <section className="terminal-tape-panel">
          <div className="panel-heading"><span>Market tape</span><strong>Live flow</strong></div>
          {tapeRows.map((row) => (
            <div key={`${row.time}-${row.price}-${row.side}`}>
              <span>{row.time}</span>
              <p>{row.side}</p>
              <strong>{formatMoney(row.price, currency)}</strong>
              <b>{row.qty}</b>
            </div>
          ))}
        </section>
        <section className="liquidity-panel">
          <div className="panel-heading"><span>Liquidity bands</span><strong>By section</strong></div>
          {["Floor", "Lower 100", "Lower 200", "Upper 100"].map((band, index) => (
            <div key={band}>
              <span>{band}</span>
              <i style={{ width: `${[78, 61, 88, 42][index]}%` }} />
              <strong>{[18, 12, 24, 9][index]}</strong>
            </div>
          ))}
        </section>
        <section className="market-controls-panel">
          <div className="panel-heading"><span>Execution controls</span><strong>Protected</strong></div>
          {["Cap check active", "One holder per ticket", "Settlement evidence queued"].map((item) => (
            <p key={item}><span />{item}</p>
          ))}
        </section>
      </div>
    </section>
  );
}

function seatLabelFor(order: UserOrder, event: WebEvent) {
  const ticketType = event.ticketTypes.find((item) => item.id === order.ticketTypeId);
  return ticketType?.name ?? "Resale listing";
}
