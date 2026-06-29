import { useCallback, useEffect, useState } from "react";
import { isTicketEntryEligible } from "../lib/ticketLifecycle";
import {
  loadTicketProofHistory,
  refreshTicketEntryCredential,
} from "../services/fanpassApi";
import type {
  AppView,
  EntryCredentialPreview,
  TicketProofHistoryItem,
  UserTicket,
} from "../types";

const ENTRY_CREDENTIAL_REFRESH_LEAD_MS = 5_000;
const ENTRY_CREDENTIAL_MAX_REFRESH_DELAY_MS = 25_000;

export function useTicketDetailEvidence(view: AppView, selectedTicket: UserTicket | null | undefined) {
  const [entryCredentials, setEntryCredentials] = useState<Record<string, EntryCredentialPreview | null>>({});
  const [proofHistories, setProofHistories] = useState<Record<string, TicketProofHistoryItem[] | null>>({});
  const [entryCredentialLoading, setEntryCredentialLoading] = useState(false);
  const [proofHistoryLoading, setProofHistoryLoading] = useState(false);
  const selectedEntryCredential = selectedTicket ? entryCredentials[selectedTicket.id] : null;

  useEffect(() => {
    let cancelled = false;

    if (view !== "ticketDetail" || !selectedTicket) {
      setEntryCredentialLoading(false);
      setProofHistoryLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const ticket = selectedTicket;
    setProofHistoryLoading(true);
    void loadTicketProofHistory(ticket.id).then((items) => {
      if (cancelled) {
        return;
      }
      setProofHistories((current) => ({ ...current, [ticket.id]: items }));
      setProofHistoryLoading(false);
    });

    if (!isTicketEntryEligible(ticket)) {
      setEntryCredentials((current) => ({ ...current, [ticket.id]: null }));
      setEntryCredentialLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setEntryCredentialLoading(true);
    void refreshTicketEntryCredential(ticket).then((credential) => {
      if (cancelled) {
        return;
      }
      setEntryCredentials((current) => ({ ...current, [ticket.id]: credential }));
      setEntryCredentialLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedTicket?.id, selectedTicket?.status, view]);

  useEffect(() => {
    if (
      view !== "ticketDetail" ||
      !selectedTicket ||
      !isTicketEntryEligible(selectedTicket) ||
      !selectedEntryCredential?.expiresAt
    ) {
      return;
    }

    let cancelled = false;
    const refreshDelay = nextRefreshDelay(selectedEntryCredential.expiresAt);
    const refreshTimeout = window.setTimeout(() => {
      setEntryCredentialLoading(true);
      void refreshTicketEntryCredential(selectedTicket).then((credential) => {
        if (cancelled) {
          return;
        }
        setEntryCredentials((current) => ({ ...current, [selectedTicket.id]: credential }));
        setEntryCredentialLoading(false);
      });
    }, refreshDelay);

    return () => {
      cancelled = true;
      window.clearTimeout(refreshTimeout);
    };
  }, [
    selectedEntryCredential?.expiresAt,
    selectedTicket?.id,
    selectedTicket?.status,
    view,
  ]);

  const refreshSelectedEntryCredential = useCallback(async () => {
    if (!selectedTicket || !isTicketEntryEligible(selectedTicket)) {
      return;
    }

    setEntryCredentialLoading(true);
    const credential = await refreshTicketEntryCredential(selectedTicket);
    setEntryCredentials((current) => ({ ...current, [selectedTicket.id]: credential }));
    setEntryCredentialLoading(false);
  }, [selectedTicket]);

  return {
    entryCredentials,
    proofHistories,
    entryCredentialLoading,
    proofHistoryLoading,
    refreshSelectedEntryCredential,
  };
}

function nextRefreshDelay(expiresAt: string) {
  const remaining = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(remaining)) {
    return ENTRY_CREDENTIAL_MAX_REFRESH_DELAY_MS;
  }

  return Math.min(
    ENTRY_CREDENTIAL_MAX_REFRESH_DELAY_MS,
    Math.max(1_000, remaining - ENTRY_CREDENTIAL_REFRESH_LEAD_MS),
  );
}
