// /functions/api/register.js

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { name, email, variation_id, variation_version, notes } = body;

    if (!name || !email || !variation_id || !variation_version) {
      return json({ success: false, error: "Missing required fields." }, 400);
    }

    const SQUARE_TOKEN = env.SQUARE_ACCESS_TOKEN;
    const LOCATION_ID = "LPQCJMZ045EAK";
    const TEAM_MEMBER_ID = "TMhH7OxpbqelTfZe";

    // -----------------------------
    // 1. SEARCH FOR EXISTING CUSTOMER
    // -----------------------------
    const searchRes = await fetch(
      "https://connect.squareup.com/v2/customers/search",
      {
        method: "POST",
        headers: squareHeaders(SQUARE_TOKEN),
        body: JSON.stringify({
          query: {
            filter: {
              email_address: {
                exact: email,
              },
            },
          },
        }),
      }
    );

    const searchData = await searchRes.json();
    let customerId;

    if (searchData.customers && searchData.customers.length > 0) {
      customerId = searchData.customers[0].id;
    } else {
      // -----------------------------
      // 2. CREATE CUSTOMER
      // -----------------------------
      const createRes = await fetch(
        "https://connect.squareup.com/v2/customers",
        {
          method: "POST",
          headers: squareHeaders(SQUARE_TOKEN),
          body: JSON.stringify({
            given_name: name,
            email_address: email,
            note: notes || "",
          }),
        }
      );

      const createData = await createRes.json();

      if (!createData.customer) {
        return json(
          {
            success: false,
            error: "Could not create customer",
            details: createData,
          },
          500
        );
      }

      customerId = createData.customer.id;
    }

    // -----------------------------
    // 3. CREATE BOOKING
    // -----------------------------
    // Compute next available session: (we already have fixed weekly schedule)
    // We compute next session automatically for the variation.
    const startAt = computeNextSession(variation_id);

    if (!startAt) {
      return json({
        success: false,
        error: "Could not compute next session time.",
      });
    }

    const bookingRes = await fetch(
      "https://connect.squareup.com/v2/bookings",
      {
        method: "POST",
        headers: squareHeaders(SQUARE_TOKEN),
        body: JSON.stringify({
          booking: {
            start_at: startAt,
            location_id: LOCATION_ID,
            customer_id: customerId,
            customer_note: notes || "",
            appointment_segments: [
              {
                team_member_id: TEAM_MEMBER_ID,
                service_variation_id: variation_id,
                service_variation_version: Number(variation_version),
                duration_minutes: 55,
              },
            ],
          },
        }),
      }
    );

    const bookingData = await bookingRes.json();

    if (bookingData.errors) {
      return json(
        { success: false, error: bookingData.errors },
        500
      );
    }

    return json({
      success: true,
      message: "Booking confirmed",
      booking: bookingData.booking,
    });

  } catch (err) {
    return json(
      { success: false, error: err.toString() },
      500
    );
  }
}

function squareHeaders(token) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "Square-Version": "2023-12-13",
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Compute next weekly recurring session time for a given variation_id.
 * NOTE: Replace schedule map with real data from Claude's JSON.
 */
function computeNextSession(variation_id) {
  const schedule = {
    // Variation → { dayIndex: 1–6, time: "15:00" }
    DDBSAMHIEGVV57JAG7I4D3IV: { day: 1, time: "15:00" }, // Parenting Autistic Kids
    ISXKIIC4F4ISR67PP4YQ6PBZ: { day: 2, time: "15:00" }, // Parenting Teens
    I6L5QQ6KT5FL245W542SX4HX: { day: 3, time: "15:00" }, // Parents of Trans
    KFTRZLGAILOA4IXZCZR26B62: { day: 4, time: "15:00" }, // Grief Group
    CUOERZXZ4AT7LYIJCP2HYC2W: { day: 5, time: "15:00" }, // Suicide survivors
    ENO736PHXSMLRMCK6VEI7C2H: { day: 6, time: "14:00" }, // Fatherhood
    M5HDIVID6XWIFSC5PPEEEGUW: { day: 6, time: "15:00" }, // Motherhood
    FRY5CM4YE5GNYLWOSB4WYALC: { day: 6, time: "16:00" }, // Live stream
    "4H5YY6NEJKWO3Z3NFLKLA7KE": { day: 6, time: "13:00" }, // Insight Series
    AQESH2V7RLSLIACONOSEK6IG: { day: 4, time: "20:00" }, // Men in 20s
  };

  const item = schedule[variation_id];
  if (!item) return null;

  const now = new Date();
  let target = new Date(now);

  const currentDay = now.getDay(); // Sun=0
  const neededDay = item.day; // Mon=1

  let diff = neededDay - currentDay;
  if (diff <= 0) diff += 7;

  target.setDate(now.getDate() + diff);

  const [hour, minute] = item.time.split(":").map(Number);
  target.setHours(hour);
  target.setMinutes(minute);
  target.setSeconds(0);
  target.setMilliseconds(0);

  return target.toISOString();
}
