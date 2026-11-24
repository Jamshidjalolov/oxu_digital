const assert = require("node:assert/strict");
const base = process.env.OXU_SMOKE_API || "http://localhost:5173/api";
async function get(route, token) {
  const response = await fetch(base + route, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, 200, route);
  return response.json();
}
async function main() {
  assert.equal((await get("/health")).ok, true);
  for (const [role, phone, routes] of [
    [
      "admin",
      "900000000",
      [
        "/admin/users",
        "/admin/groups",
        "/admin/subjects",
        "/admin/lessons?weekStart=2026-11-09",
        "/admin/workload?weekStart=2026-11-09",
      ],
    ],
    [
      "teacher",
      "901000001",
      [
        "/teacher/schedule?weekStart=2026-11-09",
        "/teacher/stats?weekStart=2026-11-09",
      ],
    ],
    [
      "student",
      "931000001",
      ["/student/schedule?weekStart=2026-11-09", "/student/attendance"],
    ],
  ]) {
    const response = await fetch(base + "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password: "123456" }),
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(response.status, 200, `${role} login`);
    const { token, user } = await response.json();
    assert.equal(user.role, role);
    assert.equal((await get("/auth/me", token)).user.role, role);
    for (const route of [...routes, "/notifications"]) await get(route, token);
    console.log(
      `OK ${role}: login, profile, schedule, statistics, notifications`,
    );
  }
  for (const url of ["http://localhost:5173", "http://localhost:8081"]) {
    assert.equal(
      (await fetch(url, { signal: AbortSignal.timeout(15000) })).status,
      200,
      url,
    );
    console.log(`OK ${url}`);
  }
}
main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
