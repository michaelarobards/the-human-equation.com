// Handle GET requests to /api/register (browser tests)
export const onRequestGet = () => {
  return new Response(
    JSON.stringify({
      ok: true,
      message: "The Human Equation booking API is live. Use POST to register."
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }
  );
};


// Handle POST requests (actual booking logic)
export const onRequestPost = async (context) => {
  try {
    const req = context.request;
    const env = context.env;
    const {
      name,
      email,
      context: userContext,
      variation_id,
      duration,
      day,
      time
    } = await req.json();

    // Basic validation
    if (!name || !email || !variation_id || !day || !time) {
      return json({ error: true, message: "Missing required fields." }, 400);
    }

    // Compute next session datetime
    const startAt = computeNextSessionISO(day, time);

    // Claude MCP booking payload
    const bookingPayload = {
      task: "create_square_booking",
      customer: { email, name },
      booking: {
        location_id: "LPQCJMZ045EAK",
        start_at: startAt,
        service_variation_id: variation_id,
        duration_minutes: parseInt(duration, 10),
        team_member_id: "TMhH7OxpbqelTfZe",
        notes: userContext || ""
      }
    };

    const result = await env.CLAUDE.run("square.createBooking", bookingPayload);

    if (result?.error) {
      return json({
        error: true,
        message: "Booking failed.",
        details: result.error
      }, 500);
    }

    return json({
      success: true,
      message: "You are registered! Check your email for confirmation.",
      booking: result
    });

  } catch (err) {
    return json({ error: true, message: "Server error." }, 500);
  }
};


// ------- Helpers ---------

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}


function computeNextSessionISO(weekdayName, timeString) {
  const days = {
    Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
    Thursday: 4, Friday: 5, Saturday: 6
  };

  const target = days[weekdayName];
  const now = new Date();
  const today = now.getDay();

  let delta = target - today;
  if (delta < 0) delta += 7;

  const date = new Date(now);
  date.setDate(now.getDate() + delta);

  const [hours, minutes] = timeString.split(":").map(Number);
  date.setHours(hours, minutes, 0, 0);

  return date.toISOString();
}
