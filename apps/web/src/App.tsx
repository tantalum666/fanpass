import { useEffect, useMemo, useState } from "react";
import { initialMarketListings, initialTickets } from "./data/fanpassWebData";
import { AppHeader } from "./components/AppHeader";
import { CheckoutView } from "./components/CheckoutView";
import { CommandStrip } from "./components/CommandStrip";
import { DiscoverView } from "./components/DiscoverView";
import { EventView } from "./components/EventView";
import { FeatureWorkspace } from "./components/FeatureWorkspace";
import { PulseConcept } from "./components/PulseConcept";
import { ResaleListingView } from "./components/ResaleListingView";
import { TicketDetailView } from "./components/TicketDetailView";
import { TerminalConcept } from "./components/TerminalConcept";
import { useOrderbookSnapshot } from "./hooks/useOrderbookSnapshot";
import { useTicketDetailEvidence } from "./hooks/useTicketDetailEvidence";
import { relatedOrderForTicket } from "./lib/orderPresentation";
import { buildShowcaseEvents } from "./lib/viewHelpers";
import {
  cancelDemoOrder,
  createDemoBuyOrder,
  createDemoSellOrder,
  loadDemoOrders,
  loadDemoTickets,
  loadEvents,
} from "./services/fanpassApi";
import type {
  ApiStatus,
  AppView,
  EventCategory,
  MarketListing,
  TicketType,
  UserOrder,
  UserTicket,
  WebEvent,
} from "./types";

type CheckoutIntent =
  | {
      kind: "primary";
      price: null;
    }
  | {
      kind: "resale";
      price: number;
      source: "Market orderbook";
    };

export function App() {
  const [view, setView] = useState<AppView>("discover");
  const [events, setEvents] = useState<WebEvent[]>([]);
  const [apiStatus, setApiStatus] = useState<ApiStatus>({
    label: "Demo data",
    detail: "Preparing FanPass Web.",
  });
  const [selectedEventId, setSelectedEventId] = useState("evt_hk_neon_weekender");
  const [selectedTicketTypeId, setSelectedTicketTypeId] = useState("tt_neon_floor");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedTicketPreview, setSelectedTicketPreview] = useState<UserTicket | null>(initialTickets[0] ?? null);
  const [tickets, setTickets] = useState<UserTicket[]>(initialTickets);
  const [listings, setListings] = useState<MarketListing[]>(initialMarketListings);
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [marketActionStatus, setMarketActionStatus] = useState("Ready");
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("All");
  const [category, setCategory] = useState<EventCategory | "All">("All");
  const [checkoutStep, setCheckoutStep] = useState<"select" | "authorize" | "confirm">("select");
  const [checkoutIntent, setCheckoutIntent] = useState<CheckoutIntent>({ kind: "primary", price: null });
  const [checkoutActionStatus, setCheckoutActionStatus] = useState("Ready");
  const [listingSubmitting, setListingSubmitting] = useState(false);
  const [listingStatus, setListingStatus] = useState("Ready to check organizer rules.");
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

  useEffect(() => {
    const resetScroll = () => window.scrollTo({ top: 0, left: 0 });
    resetScroll();
    const frame = window.requestAnimationFrame(resetScroll);
    const timeout = window.setTimeout(resetScroll, 80);
    const settledTimeout = window.setTimeout(resetScroll, 240);
    const imageSettledTimeout = window.setTimeout(resetScroll, 520);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      window.clearTimeout(settledTimeout);
      window.clearTimeout(imageSettledTimeout);
    };
  }, [selectedTicketId, view]);

  useEffect(() => {
    let cancelled = false;

    void loadEvents().then((result) => {
      if (cancelled) {
        return;
      }
      setEvents(result.events);
      setApiStatus(result.status);
      void loadDemoTickets(result.events).then((apiTickets) => {
        if (!cancelled && apiTickets?.length) {
          setTickets(apiTickets);
        }
      });
      void loadDemoOrders().then((apiOrders) => {
        if (!cancelled && apiOrders?.length) {
          setOrders(apiOrders);
        }
      });
      const firstEvent = result.events[0];
      const firstTicket = firstEvent?.ticketTypes[0];
      if (
        firstEvent &&
        (!result.events.some((event) => event.id === selectedEventId) ||
          (result.status.label === "Live API" && selectedEventId === "evt_hk_neon_weekender"))
      ) {
        setSelectedEventId(firstEvent.id);
        setSelectedTicketTypeId(firstTicket?.id ?? "");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? events[0],
    [events, selectedEventId],
  );

  const selectedTicketType = useMemo(() => {
    if (!selectedEvent) {
      return undefined;
    }
    return (
      selectedEvent.ticketTypes.find((ticketType) => ticketType.id === selectedTicketTypeId) ??
      selectedEvent.ticketTypes[0]
    );
  }, [selectedEvent, selectedTicketTypeId]);

  const { orderbook, orderbookSource, refreshOrderbook } = useOrderbookSnapshot(
    selectedEvent?.id,
    selectedTicketType?.id,
  );

  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return events.filter((event) => {
      const matchesQuery =
        !normalizedQuery ||
        [event.title, event.artist, event.venue, event.city]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesCity = city === "All" || event.city === city;
      const matchesCategory = category === "All" || event.category === category;
      return matchesQuery && matchesCity && matchesCategory;
    });
  }, [category, city, events, query]);

  const selectedListings = useMemo(() => {
    if (!selectedEvent) {
      return [];
    }
    return listings.filter((listing) => listing.eventId === selectedEvent.id);
  }, [listings, selectedEvent]);

  const selectedSellOrders = useMemo(() => {
    if (!selectedEvent) {
      return [];
    }

    return orders.filter(
      (order) =>
        order.eventId === selectedEvent.id &&
        order.side === "Sell" &&
        order.status === "Listed",
    );
  }, [orders, selectedEvent]);

  const selectedTicket = useMemo(() => {
    return tickets.find((ticket) => ticket.id === selectedTicketId) ?? selectedTicketPreview ?? tickets[0];
  }, [selectedTicketId, selectedTicketPreview, tickets]);

  const selectedTicketEvent = useMemo(() => {
    if (!selectedTicket) {
      return selectedEvent;
    }
    return events.find((event) => event.id === selectedTicket.eventId) ?? selectedEvent;
  }, [events, selectedEvent, selectedTicket]);

  const selectedTicketDetailType = useMemo(() => {
    if (!selectedTicket || !selectedTicketEvent) {
      return selectedTicketType;
    }
    return (
      selectedTicketEvent.ticketTypes.find((ticketType) => ticketType.id === selectedTicket.ticketTypeId) ??
      selectedTicketEvent.ticketTypes[0] ??
      selectedTicketType
    );
  }, [selectedTicket, selectedTicketEvent, selectedTicketType]);

  const selectedTicketOrder = useMemo(() => {
    if (!selectedTicket) {
      return null;
    }
    return relatedOrderForTicket(selectedTicket, orders);
  }, [orders, selectedTicket]);

  const {
    entryCredentials,
    proofHistories,
    entryCredentialLoading,
    proofHistoryLoading,
    refreshSelectedEntryCredential,
  } = useTicketDetailEvidence(view, selectedTicket);

  function openEvent(event: WebEvent) {
    setSelectedEventId(event.id);
    setSelectedTicketTypeId(event.ticketTypes[0]?.id ?? "");
    setCheckoutStep("select");
    setCheckoutIntent({ kind: "primary", price: null });
    setCheckoutActionStatus("Ready");
    setView("event");
  }

  function startCheckout(ticketType: TicketType) {
    if (!selectedEvent) {
      return;
    }
    setSelectedTicketTypeId(ticketType.id);
    setCheckoutStep("select");
    setCheckoutIntent({ kind: "primary", price: null });
    setCheckoutActionStatus("Ready");
    setView("checkout");
  }

  function openTicketDetail(ticket: UserTicket) {
    const event = events.find((item) => item.id === ticket.eventId);
    const ticketType = event?.ticketTypes.find((item) => item.id === ticket.ticketTypeId);
    if (event) {
      setSelectedEventId(event.id);
    }
    if (ticketType) {
      setSelectedTicketTypeId(ticketType.id);
    }
    setSelectedTicketId(ticket.id);
    setSelectedTicketPreview(ticket);
    setView("ticketDetail");
  }

  function openListingComposer(ticket: UserTicket) {
    const event = events.find((item) => item.id === ticket.eventId);
    const ticketType = event?.ticketTypes.find((item) => item.id === ticket.ticketTypeId);
    if (event) {
      setSelectedEventId(event.id);
    }
    if (ticketType) {
      setSelectedTicketTypeId(ticketType.id);
    }
    setSelectedTicketId(ticket.id);
    setSelectedTicketPreview(ticket);
    setListingStatus("Ready to check organizer rules.");
    setView("listTicket");
  }

  function authorizeOrder() {
    setCheckoutStep("authorize");
    window.setTimeout(() => setCheckoutStep("confirm"), 420);
  }

  function confirmOrder(source: "primary" | "resale" = "primary", listing?: MarketListing) {
    if (!selectedEvent || !selectedTicketType) {
      return;
    }

    const price = listing?.price ?? selectedTicketType.price;
    const ticketId = `pass_${Math.random().toString(16).slice(2, 8)}`;
    const order: UserOrder = {
      id: `ord_${Math.random().toString(16).slice(2, 9)}`,
      eventId: selectedEvent.id,
      ticketTypeId: selectedTicketType.id,
      side: "Buy",
      status: "Confirmed",
      total: price,
      createdAt: new Date().toISOString(),
    };
    const nextTicket: UserTicket = {
      id: ticketId,
      eventId: selectedEvent.id,
      ticketTypeId: selectedTicketType.id,
      code: `FP-${ticketId.slice(-4).toUpperCase()}`,
      holder: "Demo Fan",
      status: "Active",
      purchasedAt: order.createdAt,
      paid: price,
    };

    setOrders((current) => [order, ...current]);
    setTickets((current) => [nextTicket, ...current]);
    setSelectedTicketId(nextTicket.id);
    setSelectedTicketPreview(nextTicket);
    if (source === "resale" && listing) {
      setListings((current) => current.filter((item) => item.id !== listing.id));
    }
    setCheckoutStep("select");
    setView("ticketDetail");
  }

  async function reviewMarketOrder(event: WebEvent, price: number) {
    const ticketType = event.ticketTypes[0];
    if (!ticketType) {
      return;
    }

    setSelectedEventId(event.id);
    setSelectedTicketTypeId(ticketType.id);
    setCheckoutStep("select");
    setCheckoutIntent({
      kind: "resale",
      price,
      source: "Market orderbook",
    });
    setCheckoutActionStatus("Ready to review resale order.");
    setMarketActionStatus("Resale order ready for checkout");
    setView("checkout");
  }

  async function confirmResaleOrder() {
    if (!selectedEvent || !selectedTicketType || checkoutIntent.kind !== "resale") {
      return;
    }

    const price = Math.min(Math.round(checkoutIntent.price), selectedTicketType.resaleCap);
    const previousTicketIds = new Set(tickets.map((ticket) => ticket.id));
    setCheckoutActionStatus("Re-checking listing and creating buy order...");
    setMarketActionStatus("Creating resale buy order...");

    const result = await createDemoBuyOrder({
      eventId: selectedEvent.id,
      ticketTypeId: selectedTicketType.id,
      price,
    });

    if (!result) {
      setCheckoutActionStatus("API unavailable, completed local resale preview.");
      confirmOrder("resale");
      return;
    }

    const confirmed = result.order.status === "SETTLED" || Boolean(result.trade);
    const createdOrder: UserOrder = {
      id: result.order.id,
      eventId: result.order.eventId,
      ticketTypeId: result.order.ticketTypeId,
      side: "Buy",
      status: confirmed ? "Confirmed" : "Reserved",
      total: result.order.price,
      createdAt: result.order.createdAt,
    };

    const syncedOrders = await loadDemoOrders();
    setOrders((current) => syncedOrders ?? [createdOrder, ...current]);

    const syncedTickets = await loadDemoTickets(events);
    const purchasedTicket = syncedTickets
      ?.find((ticket) => !previousTicketIds.has(ticket.id))
      ?? syncedTickets?.find(
        (ticket) =>
          ticket.eventId === selectedEvent.id &&
          ticket.ticketTypeId === selectedTicketType.id &&
          ticket.status === "Transferred",
      );

    if (syncedTickets?.length) {
      setTickets(syncedTickets);
    }

    setListings((current) =>
      result.trade
        ? current.filter(
            (listing) =>
              listing.id !== result.trade?.sellOrderId &&
              listing.ticketId !== result.trade?.ticketId,
          )
        : current,
    );

    await refreshOrderbook(selectedEvent.id, selectedTicketType.id);
    setCheckoutActionStatus(confirmed ? "Resale transfer completed on API." : "Buy order open on API.");
    setMarketActionStatus(confirmed ? "Resale transfer completed on API" : "Buy order open on API");
    setCheckoutIntent({ kind: "primary", price: null });
    setCheckoutStep("select");

    if (confirmed && purchasedTicket) {
      setSelectedTicketId(purchasedTicket.id);
      setSelectedTicketPreview(purchasedTicket);
      setView("ticketDetail");
      return;
    }

    setView("market");
  }

  async function listTicket(ticket: UserTicket, requestedPrice?: number) {
    const event = events.find((item) => item.id === ticket.eventId);
    const ticketType = event?.ticketTypes.find((item) => item.id === ticket.ticketTypeId);
    if (!event || !ticketType) {
      return;
    }
    const price = Math.min(Math.round(requestedPrice ?? ticket.paid * 1.08), ticketType.resaleCap);
    const listedAt = new Date().toISOString();
    setListingSubmitting(true);
    setListingStatus("Checking ownership and creating sell order...");

    const result = await createDemoSellOrder({ ticket, price });
    const orderId = result?.order.id ?? `ord_${ticket.id}`;
    const createdAt = result?.order.createdAt ?? listedAt;
    const listedPrice = result?.order.price ?? price;
    const settled = result?.order.status === "SETTLED" || Boolean(result?.trade);
    const nextTicketStatus: UserTicket["status"] = settled ? "Transferred" : "Listed";
    const nextOrderStatus: UserOrder["status"] = settled ? "Confirmed" : "Listed";

    setTickets((current) =>
      current.map((item) => (item.id === ticket.id ? { ...item, status: nextTicketStatus } : item)),
    );
    if (!settled) {
      setListings((current) => [
        {
          id: orderId,
          eventId: event.id,
          ticketTypeId: ticketType.id,
          ticketId: ticket.id,
          seller: "You",
          price: listedPrice,
          quantity: 1,
          listedAt: createdAt,
        },
        ...current,
      ]);
    }
    setOrders((current) => [
      {
        id: orderId,
        eventId: event.id,
        ticketTypeId: ticketType.id,
        ticketId: ticket.id,
        side: "Sell",
        status: nextOrderStatus,
        total: listedPrice,
        createdAt,
      },
      ...current,
    ]);
    setSelectedTicketPreview({ ...ticket, status: nextTicketStatus });
    setSelectedEventId(event.id);
    setSelectedTicketTypeId(ticketType.id);
    setListingSubmitting(false);
    setListingStatus(
      result
        ? settled
          ? "Sell order matched on API."
          : "Listing opened on API orderbook."
        : "API unavailable for this ticket, saved locally.",
    );
    await refreshOrderbook(event.id, ticketType.id);
    setMarketActionStatus(settled ? "Sell order matched on API" : result ? "Sell order open on API" : "Local listing preview");
    setView("market");
  }

  async function cancelListing(order: UserOrder) {
    const event = events.find((item) => item.id === order.eventId);
    const ticketId = order.ticketId;
    if (!event || order.side !== "Sell" || order.status !== "Listed") {
      return;
    }

    setCancellingOrderId(order.id);
    setMarketActionStatus("Cancelling listing...");

    const result = await cancelDemoOrder(order.id);
    const restoredStatus: UserTicket["status"] =
      tickets.find((ticket) => ticket.id === ticketId)?.status === "Transferred"
        ? "Transferred"
        : "Active";

    setOrders((current) =>
      current.map((item) =>
        item.id === order.id
          ? {
              ...item,
              status: result ? "Cancelled" : "Cancelled",
            }
          : item,
      ),
    );
    setListings((current) => current.filter((listing) => listing.id !== order.id));

    if (ticketId) {
      setTickets((current) =>
        current.map((ticket) =>
          ticket.id === ticketId ? { ...ticket, status: restoredStatus } : ticket,
        ),
      );
      setSelectedTicketPreview((current) =>
        current?.id === ticketId ? { ...current, status: restoredStatus } : current,
      );
    }

    await refreshOrderbook(order.eventId, order.ticketTypeId);
    setMarketActionStatus(result ? "Listing cancelled on API" : "Local listing cancelled");
    setCancellingOrderId(null);
  }

  const activeNavView = primaryNavViewFor(view, checkoutIntent.kind);

  return (
    <main className="app-shell" data-route={activeNavView}>
      <AppHeader
        activeView={activeNavView}
        apiStatus={apiStatus}
        onNavigate={setView}
      />

      <div className="route-frame" data-active-route={activeNavView}>
        <CommandStrip
          query={query}
          city={city}
          category={category}
          onQueryChange={setQuery}
        />

        {view === "discover" && (
          <DiscoverView
            events={filteredEvents}
            allEvents={events}
            listings={listings}
            tickets={tickets}
            onOpenEvent={openEvent}
            onOpenMarket={(event) => {
              setSelectedEventId(event.id);
              setSelectedTicketTypeId(event.ticketTypes[0]?.id ?? "");
              setView("market");
            }}
          />
        )}

        {view === "event" && selectedEvent && (
          <EventView
            event={selectedEvent}
            listings={selectedListings}
            selectedTicketTypeId={selectedTicketType?.id ?? ""}
            onSelectTicketType={setSelectedTicketTypeId}
            onStartCheckout={startCheckout}
            onOpenMarket={() => setView("market")}
          />
        )}

        {view === "checkout" && selectedEvent && selectedTicketType && (
          <CheckoutView
            event={selectedEvent}
            ticketType={selectedTicketType}
            step={checkoutStep}
            mode={checkoutIntent.kind}
            resalePrice={checkoutIntent.kind === "resale" ? checkoutIntent.price : null}
            actionStatus={checkoutActionStatus}
            onBack={() => setView(checkoutIntent.kind === "resale" ? "market" : "event")}
            onAuthorize={authorizeOrder}
            onConfirm={() => {
              if (checkoutIntent.kind === "resale") {
                void confirmResaleOrder();
                return;
              }
              confirmOrder("primary");
            }}
          />
        )}

        {view === "tickets" && selectedEvent && (
          <PulseConcept
            surface="tickets"
            event={selectedEvent}
            showcase={buildShowcaseEvents(selectedEvent, events)}
            tickets={tickets}
            orders={orders}
            onOpenEvent={openEvent}
            onOpenTicket={openTicketDetail}
            onListTicket={openListingComposer}
            onNavigate={setView}
          />
        )}

        {view === "ticketDetail" && selectedTicketEvent && selectedTicket && selectedTicketDetailType && (
          <TicketDetailView
            event={selectedTicketEvent}
            ticket={selectedTicket}
            ticketType={selectedTicketDetailType}
            relatedOrder={selectedTicketOrder}
            entryCredential={entryCredentials[selectedTicket.id] ?? null}
            proofHistory={proofHistories[selectedTicket.id] ?? null}
            entryCredentialLoading={entryCredentialLoading}
            proofHistoryLoading={proofHistoryLoading}
            onBack={() => setView("tickets")}
            onListTicket={openListingComposer}
            onOpenMarket={() => setView("market")}
            onRefreshEntryCode={refreshSelectedEntryCredential}
          />
        )}

        {view === "listTicket" && selectedTicketEvent && selectedTicket && selectedTicketDetailType && (
          <ResaleListingView
            event={selectedTicketEvent}
            ticket={selectedTicket}
            ticketType={selectedTicketDetailType}
            submitting={listingSubmitting}
            status={listingStatus}
            onBack={() => setView("ticketDetail")}
            onSubmit={(price) => void listTicket(selectedTicket, price)}
            onOpenMarket={() => setView("market")}
          />
        )}

        {view === "market" && selectedEvent && (
          <TerminalConcept
            event={selectedEvent}
            tickets={tickets}
            listings={selectedListings}
            orderbook={orderbook}
            orderbookSource={orderbookSource}
            actionStatus={marketActionStatus}
            sellOrders={selectedSellOrders}
            cancellingOrderId={cancellingOrderId}
            onOpenEvent={openEvent}
            onReviewOrder={reviewMarketOrder}
            onCancelListing={(order) => void cancelListing(order)}
          />
        )}

        {view === "forYou" && (
          <FeatureWorkspace
            kind="forYou"
            events={events}
            tickets={tickets}
            orders={orders}
            listings={listings}
            onOpenEvent={openEvent}
            onNavigate={setView}
          />
        )}

        {(view === "events" || view === "venues" || view === "artists" || view === "collections") && (
          <FeatureWorkspace
            kind={view}
            events={events}
            tickets={tickets}
            orders={orders}
            listings={listings}
            onOpenEvent={openEvent}
            onNavigate={setView}
          />
        )}

        {(view === "wallet" || view === "orders") && selectedEvent && (
          <PulseConcept
            surface={view}
            event={selectedEvent}
            showcase={buildShowcaseEvents(selectedEvent, events)}
            tickets={tickets}
            orders={orders}
            onOpenEvent={openEvent}
            onOpenTicket={openTicketDetail}
            onListTicket={openListingComposer}
            onNavigate={setView}
          />
        )}

        {(view === "analytics" || view === "alerts" || view === "settings") && (
          <FeatureWorkspace
            kind={view}
            events={events}
            tickets={tickets}
            orders={orders}
            listings={listings}
            onOpenEvent={openEvent}
            onNavigate={setView}
          />
        )}
      </div>
    </main>
  );
}

function primaryNavViewFor(view: AppView, checkoutKind: CheckoutIntent["kind"] = "primary"): AppView {
  if (view === "ticketDetail" || view === "listTicket") {
    return "tickets";
  }
  if (view === "event" || view === "checkout") {
    if (view === "checkout" && checkoutKind === "resale") {
      return "market";
    }
    return "discover";
  }
  return view;
}
