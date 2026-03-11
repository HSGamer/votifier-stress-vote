const PORT = 8193;
const listener = Deno.listen({ port: PORT });
console.log(`Mock Votifier server listening on 0.0.0.0:${PORT}`);

async function handleConn(conn: Deno.Conn) {
  try {
    const reader = conn.readable.getReader();
    const writer = conn.writable.getWriter();

    // Send Votifier V2 handshake
    const handshake = new TextEncoder().encode("VOTIFIER 2.0 challenge\n");
    await writer.write(handshake);

    // Read vote data
    const { value: data } = await reader.read();
    if (data) {
      // For mock purposes, we just log that we received something
      // and respond with success
      const response = new TextEncoder().encode(JSON.stringify({ status: "ok" }));
      await writer.write(response);
    }

    reader.releaseLock();
    writer.releaseLock();
  } catch (err) {
    if (!(err instanceof Deno.errors.BadResource)) {
      console.error("Error handling connection:", err);
    }
  } finally {
    conn.close();
  }
}

for await (const conn of listener) {
  handleConn(conn);
}
