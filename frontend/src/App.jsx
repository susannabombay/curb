import React, { useEffect, useState } from "react";
import LoginScreen from "./components/LoginScreen.jsx";
import MapScreen from "./components/MapScreen.jsx";
import MallDetail from "./components/MallDetail.jsx";
import BookingForm from "./components/BookingForm.jsx";
import ConfirmationScreen from "./components/ConfirmationScreen.jsx";
import ReservationPanel from "./components/ReservationPanel.jsx";
import ProfileScreen from "./components/ProfileScreen.jsx";
import TabBar from "./components/TabBar.jsx";
import ExtendModal from "./components/ExtendModal.jsx";
import { RESERVATION_WINDOW_MIN, EXTEND_MIN, MAX_EXTENDS, BOOKING_FEE_CENTS } from "./mockData";
import { timeStringToDate, minutesUntil } from "./time";
import { getHistory, addToHistory } from "./history";
import { getReliability, recordNoShow, isSuspended } from "./reliability";
import { getStoredAuth, setStoredAuth } from "./auth";
import {
  fetchMe,
  fetchActiveReservation,
  fetchHistory,
  createReservation,
  extendReservation,
  dismissPromptApi,
  cancelReservationApi,
  arriveReservationApi,
  mapReservationFromApi,
  mapHistoryEntryFromApi,
} from "./api";

// -----------------------------------------------------------------------
// Overall flow:
//   login -> map (search/pins) -> detail (current + predicted availability)
//   -> checkout (name/plate/times/payment) -> confirmation -> booking
//   (live countdown, with a pop-up 5 min before the hold expires)
// Map and Profile are also reachable at any time via the bottom tab bar.
//
// Two parallel reservation backends, same shape everywhere else:
//   - Guest: purely local (makeReservation + direct state updates below),
//     nothing survives a real reload -- there's no account to tie it to.
//   - Real account (signed up/logged in): every mutation calls the backend
//     (see ./api.js) and the response is mapped into the exact same
//     reservation shape, so ReservationPanel/ExtendModal/ProfileScreen/etc
//     never need to know which one they're looking at. This is what lets a
//     booking survive a full reload -- e.g. returning from the Maps app.
// -----------------------------------------------------------------------

// Builds a purely local (guest) reservation record. Everything time-related
// is stored as a real Date (holdExpiresAt), not a countdown number -- that's
// what lets the UI stay accurate against the real clock instead of drifting
// if a tick is missed.
function makeReservation(mall, details) {
  const arriveDate = timeStringToDate(details.arriveTime);
  const holdExpiresAt = new Date(arriveDate.getTime() + RESERVATION_WINDOW_MIN * 60000);
  return {
    carpark_name: mall.name,
    lat: mall.lat,
    lon: mall.lng,
    name: details.name,
    plate: details.plate,
    arriveTime: details.arriveTime,
    leaveTime: details.leaveTime,
    lotType: details.lotType || "standard",
    paymentMethod: details.paymentMethod || "card",
    fee_cents: BOOKING_FEE_CENTS,
    status: "active", // "active" | "extended" | "cancelled" | "arrived"
    holdExpiresAt,
    extendDismissed: false,
    extendCount: 0,
  };
}

// Turns the stored reservation + "now" into everything the screens need
// to render: how much time is left, whether the hold has quietly expired,
// and whether the 5-minute pop-up should be showing. Recomputing this
// every tick (rather than trusting a decremented counter) is what "connects
// the clock" -- expiry is always the truth as of the current timestamp.
function deriveReservationView(reservation, now) {
  if (!reservation) return null;

  if (["cancelled", "arrived"].includes(reservation.status)) {
    return { ...reservation, effectiveStatus: reservation.status, secondsRemaining: 0, isUrgent: false, showExtendPrompt: false };
  }

  const msRemaining = reservation.holdExpiresAt.getTime() - now;
  if (msRemaining <= 0) {
    return { ...reservation, effectiveStatus: "expired", secondsRemaining: 0, isUrgent: false, showExtendPrompt: false };
  }

  const secondsRemaining = Math.round(msRemaining / 1000);
  const isUrgent = secondsRemaining <= 300; // last 5 minutes
  const canExtend = reservation.extendCount < MAX_EXTENDS;
  return {
    ...reservation,
    effectiveStatus: reservation.status,
    secondsRemaining,
    isUrgent,
    canExtend,
    showExtendPrompt: isUrgent && !reservation.extendDismissed,
  };
}

// screen: "login" | "map" | "detail" | "checkout" | "confirmation" | "booking" | "profile"
export default function App() {
  const [screen, setScreen] = useState("login");
  const [user, setUser] = useState(null);
  const [auth, setAuth] = useState(null); // { token, email } for a real account, null for guest
  const [authChecked, setAuthChecked] = useState(false);
  const [apiError, setApiError] = useState(null);

  const [selectedMall, setSelectedMall] = useState(null);
  const [pendingArriveTime, setPendingArriveTime] = useState(null);
  const [reservation, setReservation] = useState(null);
  const [history, setHistory] = useState(() => getHistory());
  const [reliability, setReliability] = useState(() => getReliability());

  // On first load, silently try to restore a real-account session from its
  // saved token -- this is what lets a booking survive a full page reload
  // instead of just a tab switch. Guests have no token, so this is a no-op
  // for them and they land on the login screen as before.
  useEffect(() => {
    const stored = getStoredAuth();
    if (!stored) {
      setAuthChecked(true);
      return;
    }
    fetchMe(stored.token)
      .then(async (me) => {
        setAuth(stored);
        setUser({ email: me.email, guest: false });
        const [activeRes, hist] = await Promise.all([
          fetchActiveReservation(stored.token).catch(() => null),
          fetchHistory(stored.token).catch(() => []),
        ]);
        setHistory(hist.map(mapHistoryEntryFromApi));
        if (activeRes) {
          setReservation(mapReservationFromApi(activeRes));
          setScreen("booking");
        } else {
          setScreen("map");
        }
      })
      .catch(() => setStoredAuth(null))
      .finally(() => setAuthChecked(true));
  }, []);

  // Ticks once a second while there's a live reservation, purely to force
  // a re-render so deriveReservationView recomputes against the current
  // time. We don't store "seconds remaining" as state -- that's the part
  // that would drift.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!reservation || ["cancelled", "arrived"].includes(reservation.status)) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [reservation, reservation?.status]);

  const view = deriveReservationView(reservation, now);
  // A driver with a live hold shouldn't be able to book a second lot and
  // silently lose track of the first.
  const hasActiveReservation = view && ["active", "extended"].includes(view.effectiveStatus);
  const suspendedUntil = isSuspended(reliability) ? reliability.suspendedUntil : null;

  function handleLogin(loggedInUser) {
    if (loggedInUser.guest) {
      setUser(loggedInUser);
      setAuth(null);
      setStoredAuth(null);
      setHistory(getHistory());
      setReliability(getReliability());
      setScreen("map");
      return;
    }

    const authInfo = { token: loggedInUser.token, email: loggedInUser.email };
    setAuth(authInfo);
    setStoredAuth(authInfo);
    setUser({ email: loggedInUser.email, guest: false });
    setScreen("map");
    Promise.all([
      fetchActiveReservation(authInfo.token).catch(() => null),
      fetchHistory(authInfo.token).catch(() => []),
    ]).then(([activeRes, hist]) => {
      setReservation(activeRes ? mapReservationFromApi(activeRes) : null);
      setHistory(hist.map(mapHistoryEntryFromApi));
    });
  }

  function handleLogout() {
    if (auth) {
      // A real account's reservation lives on the server and will be
      // restored correctly the next time that account logs in -- clearing
      // it here just stops it from leaking into a subsequent guest session.
      setReservation(null);
    }
    // Guest reservations have nowhere else to live, so they're deliberately
    // left in place -- continuing as guest again should still show it.
    setAuth(null);
    setStoredAuth(null);
    setUser(null);
    setSelectedMall(null);
    setPendingArriveTime(null);
    setScreen("login");
  }

  function handleSelectMall(mall) {
    setSelectedMall(mall);
    setScreen("detail");
  }

  function handleBook(mall, arriveTime) {
    setPendingArriveTime(arriveTime);
    setScreen("checkout");
  }

  async function handleConfirmBooking(details) {
    if (auth) {
      try {
        setApiError(null);
        const mall = selectedMall;
        const created = await createReservation(auth.token, {
          carpark_id: mall.id,
          carpark_name: mall.name,
          lat: mall.lat,
          lon: mall.lng,
          eta_minutes: minutesUntil(timeStringToDate(details.arriveTime)),
          name: details.name,
          plate: details.plate,
          arrive_time: details.arriveTime,
          leave_time: details.leaveTime,
          lot_type: details.lotType,
          payment_method: details.paymentMethod,
          fee_cents: BOOKING_FEE_CENTS,
        });
        setReservation(mapReservationFromApi(created));
        setScreen("confirmation");
      } catch (err) {
        setApiError(err.message);
      }
      return;
    }
    setReservation(makeReservation(selectedMall, details));
    setScreen("confirmation");
  }

  async function handleExtend() {
    if (auth && reservation?.id) {
      try {
        setApiError(null);
        setReservation(mapReservationFromApi(await extendReservation(auth.token, reservation.id)));
      } catch (err) {
        setApiError(err.message);
      }
      return;
    }
    setReservation((r) => {
      if (r.extendCount >= MAX_EXTENDS) return r;
      return {
        ...r,
        status: "extended",
        holdExpiresAt: new Date(r.holdExpiresAt.getTime() + EXTEND_MIN * 60000),
        extendDismissed: false,
        extendCount: r.extendCount + 1,
      };
    });
  }

  async function handleDismissPrompt() {
    if (auth && reservation?.id) {
      try {
        setReservation(mapReservationFromApi(await dismissPromptApi(auth.token, reservation.id)));
      } catch {
        setReservation((r) => ({ ...r, extendDismissed: true }));
      }
      return;
    }
    setReservation((r) => ({ ...r, extendDismissed: true }));
  }

  async function handleCancelReservation() {
    if (auth && reservation?.id) {
      try {
        setApiError(null);
        setReservation(mapReservationFromApi(await cancelReservationApi(auth.token, reservation.id)));
      } catch (err) {
        setApiError(err.message);
      }
      return;
    }
    setReservation((r) => ({ ...r, status: "cancelled" }));
  }

  async function handleArrive() {
    if (auth && reservation?.id) {
      try {
        setApiError(null);
        setReservation(mapReservationFromApi(await arriveReservationApi(auth.token, reservation.id)));
      } catch (err) {
        setApiError(err.message);
      }
      return;
    }
    setReservation((r) => ({ ...r, status: "arrived" }));
  }

  function resetToMap() {
    // A hold that ran all the way to "expired" was never checked into and
    // never cancelled either -- that's a no-show, distinct from a driver
    // who proactively cancelled or actually arrived. Logged here (rather
    // than the moment it silently expires) so it's recorded exactly once,
    // when the driver acknowledges it via "Done". Reliability tracking
    // stays local to this browser either way -- it isn't part of the
    // account-persistence work.
    if (view) {
      if (view.effectiveStatus === "expired") setReliability(recordNoShow());
      const entry = {
        carpark_name: view.carpark_name,
        finishedAt: new Date().toISOString(),
        finalStatus: view.effectiveStatus,
        fee_cents: view.fee_cents,
        arriveTime: view.arriveTime,
        plate: view.plate,
      };
      // A real account's reservation row already carries its final status
      // server-side (set by the arrive/cancel call, or lazily by the
      // backend once expired) -- no need to persist the entry again here,
      // just reflect it in the UI immediately.
      if (auth) setHistory((h) => [entry, ...h]);
      else setHistory(addToHistory(entry));
    }
    setScreen("map");
    setSelectedMall(null);
    setPendingArriveTime(null);
    setReservation(null);
  }

  const showTabBar = screen !== "login";

  if (!authChecked) {
    return (
      <div className="app">
        <div className="screen">
          <p className="muted">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {screen === "login" && <LoginScreen onLogin={handleLogin} />}

      {screen === "map" && <MapScreen onSelectMall={handleSelectMall} />}

      {screen === "detail" && selectedMall && (
        <MallDetail
          mall={selectedMall}
          onBack={() => setScreen("map")}
          onBook={handleBook}
          activeReservation={hasActiveReservation ? view : null}
          onViewReservation={() => setScreen("booking")}
          suspendedUntil={suspendedUntil}
        />
      )}

      {screen === "checkout" && selectedMall && (
        <BookingForm
          mall={selectedMall}
          arriveTime={pendingArriveTime}
          onBack={() => setScreen("detail")}
          onConfirm={handleConfirmBooking}
        />
      )}

      {screen === "confirmation" && reservation && (
        <ConfirmationScreen reservation={reservation} onTrack={() => setScreen("booking")} />
      )}

      {screen === "booking" && view && (
        <ReservationPanel
          reservation={view}
          onExtend={handleExtend}
          onCancel={handleCancelReservation}
          onArrive={handleArrive}
          onDone={resetToMap}
        />
      )}

      {screen === "profile" && (
        <ProfileScreen
          user={user}
          reservation={view}
          history={history}
          reliability={reliability}
          onTrack={() => setScreen("booking")}
          onLogout={handleLogout}
        />
      )}

      {showTabBar && (
        <TabBar active={screen === "profile" ? "profile" : "map"} onChange={setScreen} />
      )}

      {/* Global pop-up: shows over whatever screen the driver is on the
          moment the hold gets within 5 minutes of expiring and they
          haven't checked in yet. */}
      {view?.showExtendPrompt && (
        <ExtendModal
          mall={reservation.carpark_name}
          canExtend={view.canExtend}
          onExtend={handleExtend}
          onCancel={handleCancelReservation}
          onDismiss={handleDismissPrompt}
        />
      )}

      {apiError && (
        <div className="api-error-toast" onClick={() => setApiError(null)}>
          {apiError}
        </div>
      )}
    </div>
  );
}
