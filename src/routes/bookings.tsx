import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { ChevronLeft, ChevronRight, Calendar, X } from "lucide-react";

export const Route = createFileRoute("/bookings")({
  head: () => ({ meta: [{ title: "Room Booking Calendar · BLX Realty CRM" }] }),
  component: RoomBookingCalendar,
});

/* ═══════════════════════════════════════════════════════════════
   Color System — exact matches from the reference image
   ═══════════════════════════════════════════════════════════════ */
const STATUS_STYLES: Record<string, { bg: string; dot: string; label: string; text: string }> = {
  checked_out:        { bg: "#6b7280", dot: "#6b7280", label: "Checked Out",      text: "#fff" },
  today_check_out:    { bg: "#f43f5e", dot: "#f43f5e", label: "Today's Check Out", text: "#fff" },
  checked_in:         { bg: "#22c55e", dot: "#22c55e", label: "Checked In",       text: "#fff" },
  today_check_in:     { bg: "#a855f7", dot: "#a855f7", label: "Today's Check In", text: "#fff" },
  booking:            { bg: "#f97316", dot: "#f97316", label: "Booking",           text: "#fff" },
  hold_booking:       { bg: "#0ea5e9", dot: "#0ea5e9", label: "Hold Booking",     text: "#fff" },
  room_hold:          { bg: "#3b82f6", dot: "#3b82f6", label: "Room Hold",        text: "#fff" },
  weekend:            { bg: "#eab308", dot: "#eab308", label: "Weekend (Fri–Sat)", text: "#fff" },
  long_weekend:       { bg: "#f97316", dot: "#f97316", label: "Long weekend",     text: "#fff" },
};

/* ═══════════════════════════════════════════════════════════════
   Mock Data — Room Types + Bookings
   ═══════════════════════════════════════════════════════════════ */
const ROOM_TYPES = [
  {
    name: "BQT/Dayout",
    rooms: [{ num: "—" }],
  },
  {
    name: "Deluxe Room",
    rooms: [
      { num: 1 },
      { num: 2 },
      { num: 3 },
      { num: 4 },
      { num: 5 },
    ],
  },
  {
    name: "Suite",
    rooms: [
      { num: 1 },
      { num: 2 },
      { num: 3 },
    ],
  },
];

// Each booking: { roomType, roomNum, guestName, status, startDay (0-indexed from window start), span (days) }
const MOCK_BOOKINGS = [
  // BQT Dayout
  { roomType: "BQT/Dayout", roomNum: "—", guestName: "Ms. Manjula",           status: "booking",          startDay: 3,  span: 1 },
  // Deluxe Room 1
  { roomType: "Deluxe Room", roomNum: 1,   guestName: "Mr. Madhu",             status: "checked_in",       startDay: 0,  span: 1 },
  { roomType: "Deluxe Room", roomNum: 1,   guestName: "Mr. Abhinav",           status: "hold_booking",     startDay: 1,  span: 1 },
  { roomType: "Deluxe Room", roomNum: 1,   guestName: "Ashwin S",              status: "booking",          startDay: 3,  span: 3 },
  { roomType: "Deluxe Room", roomNum: 1,   guestName: "Ms. Hitha Chandrashekar", status: "checked_in",    startDay: 6,  span: 2 },
  { roomType: "Deluxe Room", roomNum: 1,   guestName: "Mr. Sanket A P",        status: "today_check_out",  startDay: 8,  span: 2 },
  { roomType: "Deluxe Room", roomNum: 1,   guestName: "Ms. Harshit...",        status: "checked_out",      startDay: 11, span: 2 },
  // Deluxe Room 2
  { roomType: "Deluxe Room", roomNum: 2,   guestName: "Vinod Sada...",         status: "hold_booking",     startDay: 0,  span: 1 },
  { roomType: "Deluxe Room", roomNum: 2,   guestName: "Mr. Abhinav",           status: "hold_booking",     startDay: 1,  span: 1 },
  { roomType: "Deluxe Room", roomNum: 2,   guestName: "Mrs. Manjula",          status: "booking",          startDay: 2,  span: 1 },
  { roomType: "Deluxe Room", roomNum: 2,   guestName: "Ms. Hitha Chandrashekar", status: "checked_in",    startDay: 6,  span: 2 },
  { roomType: "Deluxe Room", roomNum: 2,   guestName: "Mr. Sanket A P",        status: "today_check_out",  startDay: 8,  span: 2 },
  { roomType: "Deluxe Room", roomNum: 2,   guestName: "Ms. Harshit...",        status: "checked_out",      startDay: 11, span: 2 },
  // Deluxe Room 3
  { roomType: "Deluxe Room", roomNum: 3,   guestName: "Vinod Sada...",         status: "hold_booking",     startDay: 0,  span: 1 },
  { roomType: "Deluxe Room", roomNum: 3,   guestName: "Mr. Abhinav",           status: "hold_booking",     startDay: 1,  span: 1 },
  { roomType: "Deluxe Room", roomNum: 3,   guestName: "Mrs. Manjula",          status: "booking",          startDay: 2,  span: 1 },
  { roomType: "Deluxe Room", roomNum: 3,   guestName: "Ms. Hitha Chandrashekar", status: "checked_in",    startDay: 6,  span: 2 },
  { roomType: "Deluxe Room", roomNum: 3,   guestName: "Mr. Sanket A P",        status: "today_check_out",  startDay: 8,  span: 2 },
  { roomType: "Deluxe Room", roomNum: 3,   guestName: "Ms. Harshit...",        status: "checked_out",      startDay: 11, span: 2 },
  // Deluxe Room 4
  { roomType: "Deluxe Room", roomNum: 4,   guestName: "Aneesh",                status: "checked_in",       startDay: 0,  span: 1 },
  { roomType: "Deluxe Room", roomNum: 4,   guestName: "Mr. Abhinav",           status: "hold_booking",     startDay: 1,  span: 1 },
  { roomType: "Deluxe Room", roomNum: 4,   guestName: "Mrs. Manjula",          status: "booking",          startDay: 2,  span: 1 },
  { roomType: "Deluxe Room", roomNum: 4,   guestName: "Ms. Hitha Chandrashekar", status: "checked_in",    startDay: 6,  span: 2 },
  { roomType: "Deluxe Room", roomNum: 4,   guestName: "Mr. Sanket A P",        status: "today_check_out",  startDay: 8,  span: 2 },
  { roomType: "Deluxe Room", roomNum: 4,   guestName: "Ms. Harshit...",        status: "checked_out",      startDay: 11, span: 2 },
  // Deluxe Room 5
  { roomType: "Deluxe Room", roomNum: 5,   guestName: "Mr. Vinay B...",        status: "today_check_in",   startDay: 0,  span: 1 },
  { roomType: "Deluxe Room", roomNum: 5,   guestName: "Mr. Abhinav",           status: "hold_booking",     startDay: 1,  span: 1 },
  { roomType: "Deluxe Room", roomNum: 5,   guestName: "Mrs. Manjula",          status: "booking",          startDay: 2,  span: 1 },
  { roomType: "Deluxe Room", roomNum: 5,   guestName: "Mr. Sanket A P",        status: "today_check_out",  startDay: 8,  span: 2 },
  { roomType: "Deluxe Room", roomNum: 5,   guestName: "Ms. Harshit...",        status: "checked_out",      startDay: 11, span: 2 },
  // Suite 1
  { roomType: "Suite",       roomNum: 1,   guestName: "Mr. Rajesh K",          status: "booking",          startDay: 0,  span: 2 },
  { roomType: "Suite",       roomNum: 1,   guestName: "Ms. Priya S",           status: "checked_in",       startDay: 5,  span: 3 },
  { roomType: "Suite",       roomNum: 1,   guestName: "Mr. Sanket",            status: "today_check_out",  startDay: 9,  span: 2 },
  // Suite 2
  { roomType: "Suite",       roomNum: 2,   guestName: "Mrs. Kavya",            status: "hold_booking",     startDay: 1,  span: 2 },
  { roomType: "Suite",       roomNum: 2,   guestName: "Mr. Ajay P",            status: "booking",          startDay: 6,  span: 2 },
  { roomType: "Suite",       roomNum: 2,   guestName: "Ms. Rekha",             status: "checked_out",      startDay: 10, span: 2 },
  // Suite 3
  { roomType: "Suite",       roomNum: 3,   guestName: "Mr. Deepak",            status: "checked_in",       startDay: 0,  span: 3 },
  { roomType: "Suite",       roomNum: 3,   guestName: "Mrs. Sunita",           status: "booking",          startDay: 7,  span: 2 },
];

// Per-day financials (mock)
const DAY_FINANCIALS = [
  { coll: "₹55K", due: "₹5K"  },
  { coll: "₹30K", due: "₹30K" },
  { coll: "₹35K", due: "₹0"   },
  { coll: "₹10K", due: "₹10K" },
  { coll: "₹10K", due: "₹10K" },
  { coll: "₹60K", due: "₹0"   },
  { coll: "₹60K", due: "₹0"   },
  { coll: "₹59K", due: "₹59K" },
  { coll: "₹59K", due: "₹59K" },
  { coll: "₹25K", due: "₹85K" },
  { coll: "₹0",   due: "₹0"   },
  { coll: "₹0",   due: "₹0"   },
  { coll: "₹0",   due: "₹0"   },
  { coll: "₹0",   due: "₹0"   },
  { coll: "₹0",   due: "₹0"   },
];

const DAYS_IN_WINDOW = 15;
const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function isWeekend(d: Date) {
  return d.getDay() === 5 || d.getDay() === 6; // Fri or Sat
}
function isToday(d: Date, today: Date) {
  return d.toDateString() === today.toDateString();
}

function getWindowStart(anchorDate: Date, offset: number): Date {
  const d = new Date(anchorDate);
  d.setDate(d.getDate() + offset * DAYS_IN_WINDOW);
  return d;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */
function RoomBookingCalendar() {
  const today = useMemo(() => new Date(), []);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedBooking, setSelectedBooking] = useState<typeof MOCK_BOOKINGS[0] | null>(null);

  // Build array of 15 Date objects starting from window
  const windowStart = useMemo(() => {
    const base = new Date(today);
    base.setDate(base.getDate() + weekOffset * DAYS_IN_WINDOW);
    return base;
  }, [today, weekOffset]);

  const days = useMemo(() =>
    Array.from({ length: DAYS_IN_WINDOW }, (_, i) => addDays(windowStart, i)),
    [windowStart]
  );

  // Find bookings for a given room at a given day index
  function getBookingsForCell(roomType: string, roomNum: number | string, dayIdx: number) {
    return MOCK_BOOKINGS.filter(
      (b) =>
        b.roomType === roomType &&
        b.roomNum === roomNum &&
        dayIdx >= b.startDay &&
        dayIdx < b.startDay + b.span
    );
  }

  // Only render pill at the start day
  function getBookingStartsAt(roomType: string, roomNum: number | string, dayIdx: number) {
    return MOCK_BOOKINGS.filter(
      (b) =>
        b.roomType === roomType &&
        b.roomNum === roomNum &&
        b.startDay === dayIdx
    );
  }

  const COL_WIDTH = 108; // px per day column
  const FREEZE_COL_W = 140; // room type+num frozen column

  return (
    <AppShell
      title="Room Booking Calendar"
      subtitle="15-day view of bookings by room. Tap a booking for guest details and check-in / check-out."
    >
      {/* ── Header Card ── */}
      <div
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f2044 100%)",
          borderRadius: 14,
          padding: "20px 24px 0 24px",
          marginBottom: 0,
          boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
        }}
      >
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div>
            <p style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", margin: 0 }}>
              BLX REALTY CRM
            </p>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#f8fafc", margin: "2px 0 4px" }}>
              Room Booking
            </h1>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
              15-day view of bookings by room. Tap a booking for guest details and check-in / check-out.
            </p>
          </div>

          {/* Navigation */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => setWeekOffset((o) => o - 1)}
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8,
                color: "#f1f5f9",
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <ChevronLeft size={14} /> Week
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8,
                color: "#f1f5f9",
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Today
            </button>
            <button
              onClick={() => setWeekOffset((o) => o + 1)}
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8,
                color: "#f1f5f9",
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              Week <ChevronRight size={14} />
            </button>
            <div
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 8,
                color: "#f1f5f9",
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Calendar size={13} style={{ opacity: 0.7 }} />
              Date {today.toLocaleDateString("en-GB").replace(/\//g, "-")}
            </div>
          </div>
        </div>

        {/* ── Legend ── */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "6px 14px",
            padding: "12px 0 14px",
            borderTop: "1px solid rgba(255,255,255,0.07)",
            marginTop: 10,
          }}
        >
          {Object.entries(STATUS_STYLES).map(([key, s]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: s.dot,
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 500 }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Calendar Grid ── */}
      <div
        style={{
          overflowX: "auto",
          borderRadius: "0 0 14px 14px",
          border: "1px solid rgba(99,116,143,0.18)",
          borderTop: "none",
          background: "var(--background)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
          marginTop: 0,
        }}
      >
        <div style={{ minWidth: FREEZE_COL_W + COL_WIDTH * DAYS_IN_WINDOW }}>

          {/* ── Column Headers (Day names + date + financials) ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `${FREEZE_COL_W}px repeat(${DAYS_IN_WINDOW}, ${COL_WIDTH}px)`,
              position: "sticky",
              top: 0,
              zIndex: 10,
              background: "var(--background)",
              borderBottom: "2px solid rgba(99,116,143,0.18)",
            }}
          >
            {/* Frozen header cell */}
            <div
              style={{
                padding: "10px 12px",
                fontSize: 10,
                fontWeight: 700,
                color: "var(--muted-foreground)",
                textTransform: "uppercase",
                letterSpacing: 1,
                borderRight: "2px solid rgba(99,116,143,0.18)",
                background: "var(--background)",
                display: "flex",
                alignItems: "center",
              }}
            >
              ROOM TYPE &nbsp;
              <span style={{ opacity: 0.5 }}>#</span>
            </div>

            {/* Day columns */}
            {days.map((day, idx) => {
              const isWknd = isWeekend(day);
              const isTdy = isToday(day, today);
              const fin = DAY_FINANCIALS[idx] || { coll: "₹0", due: "₹0" };

              return (
                <div
                  key={idx}
                  style={{
                    borderRight: "1px solid rgba(99,116,143,0.12)",
                    background: isTdy
                      ? "rgba(99,179,237,0.08)"
                      : isWknd
                      ? "rgba(234,179,8,0.06)"
                      : "transparent",
                    padding: "6px 4px 6px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: 1,
                      color: isWknd ? "#eab308" : "var(--muted-foreground)",
                      textTransform: "uppercase",
                    }}
                  >
                    {DAY_NAMES[day.getDay()]}
                  </div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      color: isTdy ? "#60a5fa" : isWknd ? "#ca8a04" : "var(--foreground)",
                      lineHeight: 1.1,
                    }}
                  >
                    {day.getDate()}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginBottom: 2 }}>
                    {MONTH_NAMES[day.getMonth()]}
                  </div>
                  <div style={{ fontSize: 9, color: "#22c55e", fontWeight: 600 }}>
                    Coll {fin.coll}
                  </div>
                  <div style={{ fontSize: 9, color: fin.due === "₹0" ? "var(--muted-foreground)" : "#f43f5e", fontWeight: 600 }}>
                    Due {fin.due}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Room Rows ── */}
          {ROOM_TYPES.map((rt) =>
            rt.rooms.map((room, rIdx) => {
              const isFirstRoomInGroup = rIdx === 0;
              const totalRooms = rt.rooms.length;

              return (
                <div
                  key={`${rt.name}-${room.num}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: `${FREEZE_COL_W}px repeat(${DAYS_IN_WINDOW}, ${COL_WIDTH}px)`,
                    borderBottom: "1px solid rgba(99,116,143,0.10)",
                    minHeight: 52,
                  }}
                >
                  {/* Frozen left: Room Type + Room Number */}
                  <div
                    style={{
                      borderRight: "2px solid rgba(99,116,143,0.18)",
                      display: "flex",
                      alignItems: "center",
                      background: "var(--background)",
                      position: "sticky",
                      left: 0,
                      zIndex: 5,
                      padding: "0 0 0 0",
                    }}
                  >
                    {/* Room type label (shown on first room of each group) */}
                    <div
                      style={{
                        width: 68,
                        padding: "0 8px",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--foreground)",
                        opacity: isFirstRoomInGroup ? 1 : 0,
                        lineHeight: 1.2,
                        userSelect: "none",
                        borderRight: "1px solid rgba(99,116,143,0.10)",
                        minHeight: 52,
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {rt.name}
                    </div>
                    {/* Room number */}
                    <div
                      style={{
                        flex: 1,
                        textAlign: "center",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--muted-foreground)",
                        padding: "0 6px",
                      }}
                    >
                      {room.num}
                    </div>
                  </div>

                  {/* Day cells */}
                  {days.map((day, dayIdx) => {
                    const isWknd = isWeekend(day);
                    const isTdy = isToday(day, today);
                    const startsHere = getBookingStartsAt(rt.name, room.num, dayIdx);
                    const occupied = getBookingsForCell(rt.name, room.num, dayIdx).length > 0;

                    return (
                      <div
                        key={dayIdx}
                        style={{
                          borderRight: "1px solid rgba(99,116,143,0.10)",
                          background: isTdy
                            ? "rgba(99,179,237,0.04)"
                            : isWknd
                            ? "rgba(234,179,8,0.04)"
                            : "transparent",
                          position: "relative",
                          minHeight: 52,
                          display: "flex",
                          alignItems: "center",
                          padding: "4px 3px",
                          overflow: "visible",
                        }}
                      >
                        {startsHere.map((booking, bIdx) => {
                          const style = STATUS_STYLES[booking.status] || STATUS_STYLES.booking;
                          const pillWidth = booking.span * COL_WIDTH - 6;

                          return (
                            <button
                              key={bIdx}
                              onClick={() => setSelectedBooking(booking)}
                              title={`${booking.guestName} — ${style.label}`}
                              style={{
                                position: "absolute",
                                left: 3,
                                top: "50%",
                                transform: "translateY(-50%)",
                                width: pillWidth,
                                maxWidth: pillWidth,
                                background: style.bg,
                                color: style.text,
                                borderRadius: 6,
                                padding: "4px 7px",
                                fontSize: 11,
                                fontWeight: 700,
                                border: "none",
                                cursor: "pointer",
                                zIndex: 3,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                textAlign: "left",
                                boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                                transition: "filter 0.15s, transform 0.15s",
                                lineHeight: 1.3,
                              }}
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.15)";
                                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-53%)";
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.filter = "";
                                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-50%)";
                              }}
                            >
                              {booking.guestName}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Booking Detail Modal ── */}
      {selectedBooking && (
        <div
          onClick={() => setSelectedBooking(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: 28,
              minWidth: 340,
              maxWidth: 420,
              boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
              position: "relative",
            }}
          >
            {/* Status pill */}
            <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span
                style={{
                  background: STATUS_STYLES[selectedBooking.status]?.bg,
                  color: "#fff",
                  borderRadius: 6,
                  padding: "4px 12px",
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {STATUS_STYLES[selectedBooking.status]?.label}
              </span>
              <button
                onClick={() => setSelectedBooking(null)}
                style={{
                  background: "rgba(99,116,143,0.15)",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  padding: "4px 6px",
                  display: "flex",
                  alignItems: "center",
                  color: "var(--foreground)",
                }}
              >
                <X size={16} />
              </button>
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--foreground)", margin: "0 0 4px" }}>
              {selectedBooking.guestName}
            </h2>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "0 0 20px" }}>
              {selectedBooking.roomType} — Room {selectedBooking.roomNum}
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              {[
                { label: "Room Type", value: selectedBooking.roomType },
                { label: "Room Number", value: String(selectedBooking.roomNum) },
                { label: "Check-in Day", value: `Day +${selectedBooking.startDay}` },
                { label: "Duration", value: `${selectedBooking.span} night${selectedBooking.span > 1 ? "s" : ""}` },
              ].map((row) => (
                <div
                  key={row.label}
                  style={{
                    background: "var(--muted)",
                    borderRadius: 8,
                    padding: "10px 12px",
                  }}
                >
                  <div style={{ fontSize: 10, color: "var(--muted-foreground)", fontWeight: 600, marginBottom: 2 }}>
                    {row.label}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>{row.value}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 20, display: "flex", gap: 8 }}>
              <button
                onClick={() => setSelectedBooking(null)}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--foreground)",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
              <button
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 8,
                  border: "none",
                  background: STATUS_STYLES[selectedBooking.status]?.bg,
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                View Full Details
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
