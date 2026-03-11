export interface Vote {
  username: string;
  address: string;
  timestamp: number;
  serviceName: string;
}

export interface VotifierOptions {
  host: string;
  port: number;
  token: string;
  vote: Vote;
}

// Cache keys to avoid repeated imports
const keyCache = new Map<string, CryptoKey>();

async function getHmacKey(token: string): Promise<CryptoKey> {
  const cached = keyCache.get(token);
  if (cached) return cached;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(token);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  keyCache.set(token, key);
  return key;
}

async function createMessage(
  header: string,
  vote: Vote,
  token: string,
): Promise<Uint8Array> {
  const data = header.split(" ");
  if (data.length !== 3) {
    throw new Error("Not a Votifier v2 protocol server");
  }

  const challenge = data[2].trim();
  const voteWithChallenge = { ...vote, challenge };
  const voteAsJson = JSON.stringify(voteWithChallenge);

  const encoder = new TextEncoder();
  const signData = encoder.encode(voteAsJson);
  const key = await getHmacKey(token);
  const signature = await crypto.subtle.sign("HMAC", key, signData);

  // Convert signature to base64
  const sigBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

  const messageStr = JSON.stringify({ payload: voteAsJson, signature: sigBase64 });
  const messageData = encoder.encode(messageStr);

  const buffer = new Uint8Array(4 + messageData.length);
  const view = new DataView(buffer.buffer);
  view.setUint16(0, 0x733a);
  view.setUint16(2, messageData.length);
  buffer.set(messageData, 4);

  return buffer;
}

export async function sendVote(options: VotifierOptions): Promise<void> {
  const { host, port, token, vote } = options;

  if (!host || !port || !token || !vote) {
    throw new Error("missing host, port, token, or vote");
  }

  if (!vote.username || !vote.address || !vote.timestamp || !vote.serviceName) {
    throw new Error("missing username, address, timestamp, or serviceName in 'vote'");
  }

  let conn: Deno.Conn | null = null;
  const timeoutMs = 2000;
  const timeoutId = setTimeout(() => {
    if (conn) {
      conn.close();
      conn = null;
    }
  }, timeoutMs);

  try {
    conn = await Deno.connect({ hostname: host, port });
    const reader = conn.readable.getReader();
    const writer = conn.writable.getWriter();

    // Read handshake
    const { value: handshakeValue } = await reader.read();
    if (!handshakeValue) throw new Error("Connection closed during handshake");
    const header = new TextDecoder().decode(handshakeValue);

    // Create and send message
    const message = await createMessage(header, vote, token);
    await writer.write(message);

    // Read response
    const { value: respValue } = await reader.read();
    if (!respValue) throw new Error("Connection closed waiting for response");
    const resp = JSON.parse(new TextDecoder().decode(respValue));

    if (resp.status === "error") {
      throw new Error(`${resp.cause}: ${resp.errorMessage}`);
    }

    reader.releaseLock();
    writer.releaseLock();
  } catch (e) {
    if (e instanceof Deno.errors.Interrupted || (e instanceof Error && e.message === "Connection closed waiting for response")) {
        throw new Error("Socket timeout or closed");
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
    if (conn) {
      conn.close();
    }
  }
}
