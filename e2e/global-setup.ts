import * as fs from "fs";
import * as path from "path";

const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

const AUTH_DIR = path.join(__dirname, ".auth");

interface TokenResponse {
  data: { access_token: string };
}

async function getToken(email: string, password: string): Promise<string> {
  const body = new URLSearchParams({ username: email, password });
  const res = await fetch(`${API_URL}/api/v1/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Login failed for ${email}: ${res.status} ${text}`);
  }
  const json = (await res.json()) as TokenResponse;
  return json.data.access_token;
}

function writeStorageState(filePath: string, token: string): void {
  const state = {
    cookies: [],
    origins: [
      {
        origin: BASE_URL,
        localStorage: [{ name: "geosafe_token", value: token }],
      },
    ],
  };
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
}

export default async function globalSetup(): Promise<void> {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  const adminToken = await getToken("e2e-admin@geosafe.test", "E2ePassw0rd!");
  writeStorageState(path.join(AUTH_DIR, "admin.json"), adminToken);

  const operatorToken = await getToken("e2e-operator@geosafe.test", "E2ePassw0rd!");
  writeStorageState(path.join(AUTH_DIR, "operator.json"), operatorToken);
}
