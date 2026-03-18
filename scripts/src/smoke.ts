const appUrl = (process.env["APP_URL"] ?? "http://localhost:3000").replace(/\/+$/, "");

async function assertOk(name: string, url: string, validate?: (body: string) => void) {
  const res = await fetch(url, {
    headers: { accept: "application/json, text/html;q=0.9,*/*;q=0.8" },
  });

  if (!res.ok) {
    throw new Error(`${name} failed: ${res.status} ${res.statusText}`);
  }

  const body = await res.text();
  validate?.(body);
  console.log(`[smoke] ${name}: ok`);
}

async function main() {
  console.log(`[smoke] probing ${appUrl}`);

  await assertOk("frontend", appUrl, (body) => {
    if (!body.includes("<div id=\"root\"></div>")) {
      throw new Error("frontend response did not look like the Vite app shell");
    }
  });

  await assertOk("auth user", `${appUrl}/api/auth/user`, (body) => {
    const parsed = JSON.parse(body) as { isAuthenticated?: boolean };
    if (typeof parsed.isAuthenticated !== "boolean") {
      throw new Error("/api/auth/user response did not contain isAuthenticated");
    }
  });
}

main().catch((error) => {
  console.error(`[smoke] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

