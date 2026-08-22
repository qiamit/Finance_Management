import { authenticator } from "otplib";
import { decryptText } from "../lib/crypto";

export type AngelCredentials = {
  apiKey: string;
  clientCode: string;
  totpSecret: string;
  pin?: string;
  password?: string;
};

type HoldingRow = {
  tradingsymbol?: string;
  isin?: string;
  quantity?: number;
  averageprice?: number;
  ltp?: number;
  product?: string;
};

export async function angelLogin(creds: AngelCredentials): Promise<{ jwtToken: string; feedToken?: string }> {
  const totp = authenticator.generate(creds.totpSecret);
  const res = await fetch("https://apiconnect.angelone.in/rest/auth/angelbroking/user/v1/loginByPassword", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-UserType": "USER",
      "X-SourceID": "WEB",
      "X-ClientLocalIP": "127.0.0.1",
      "X-ClientPublicIP": "127.0.0.1",
      "X-MACAddress": "00:00:00:00:00:00",
      "X-PrivateKey": creds.apiKey,
    },
    body: JSON.stringify({
      clientcode: creds.clientCode,
      password: creds.pin || creds.password,
      totp,
    }),
  });
  const json = (await res.json()) as {
    status?: boolean;
    message?: string;
    data?: { jwtToken?: string; feedToken?: string };
  };
  if (!json.status || !json.data?.jwtToken) {
    throw new Error(json.message || "Angel One login failed");
  }
  return { jwtToken: json.data.jwtToken, feedToken: json.data.feedToken };
}

export async function fetchAngelHoldings(creds: AngelCredentials) {
  const session = await angelLogin(creds);
  const res = await fetch(
    "https://apiconnect.angelone.in/rest/secure/angelbroking/portfolio/v1/getAllHolding",
    {
      headers: {
        Authorization: `Bearer ${session.jwtToken}`,
        Accept: "application/json",
        "X-UserType": "USER",
        "X-SourceID": "WEB",
        "X-ClientLocalIP": "127.0.0.1",
        "X-ClientPublicIP": "127.0.0.1",
        "X-MACAddress": "00:00:00:00:00:00",
        "X-PrivateKey": creds.apiKey,
      },
    },
  );
  const json = (await res.json()) as {
    status?: boolean;
    message?: string;
    data?: { holdings?: HoldingRow[] };
  };
  if (!json.status) throw new Error(json.message || "Failed to fetch Angel One holdings");
  return json.data?.holdings || [];
}

export function parseStoredCredentials(encrypted: string): AngelCredentials {
  return JSON.parse(decryptText(encrypted)) as AngelCredentials;
}
