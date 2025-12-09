export const onRequestPost = async (context) => {
  try {
    const req = context.request;
    const env = context.env;
    const body = await req.json();

    const {
      name,
      email,
      context: userContext,
      variation_id,
      duration,
      day,
      time
    } = body;

    if (!name || !email || !variation_id || !day || !time) {
      return json({ error: true, message: "Missing fields." }, 400);
    }

    const startAt = computeNextSessionISO(day, time);

    const bookingPayload = {
      task: "create_square_booking",
      customer: {
        email,
        name
      },
      booking: {
        location_id: "LPQCJMZ045EAK",
        start_at: startAt,
        service_variation_id: variation_id,
        duration_minutes: parseInt(duration, 10),
        team_member_id: "TMhH7OxpbqelTfZe",
        notes: userContext || ""
      }
    };

    const aiResponse = await env.CLAUDE.run(
      "square.createBooking",
      bookingPayload
    );

    if (aiResponse?.error) {
      return json(
        {
          error: true,
          message: "Unable to create booking.",
          details: aiResponse.error,
        },
        500
      );
    }

    return json({
      success: true,
      message: "You're registered! Check email for confirmation.",
      start_at: startAt,
      booking: aiResponse,
    });
  } catch (err) {
    return json({ error: true, message: "Internal error." }, 500);
  }
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function computeNextSessionISO(weekdayName, timeString) {
  const weekdayMap = {
    Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
    Thursday: 4, Friday: 5, Saturday: 6
  };

  const targetDow = weekdayMap[weekdayName];
  const now = new Date();
  const todayDow = now.getDay();

  let delta = targetDow - todayDow;
  if (delta < 0) delta += 7;

  const date = new Date(now);
  date.setDate(now.getDate() + delta);

  const [hr, min] = timeString.split(":").map(Number);
  date.setHours(hr);
  date.setMinutes(min);
  date.setSeconds(0);

  return date.toISOString();
}
