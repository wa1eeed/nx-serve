# @nxserve/realtime

The Socket.IO gateway (docs/14, ADR-0006). Stateless, scaled out via the Redis adapter.

- **Auth**: the access JWT is verified at the handshake; the socket is bound to its tenant and actor.
- **Rooms**: staff join their tenant ops room, customers and agents their own room; order rooms are
  joined on authorized subscription in later phases.
- **Event bridge**: subscribes to the worker's Redis channel (`nx:events`) and fans each event out
  to its rooms (`roomsForEvent` in `@nxserve/contracts`). Apps reconcile over HTTP on reconnect, so a
  missed socket event is never relied upon.

Live location streaming, presence and the ops map ship with the orders phase (docs/15 Phase 4 and 5).

## Run

`pnpm --filter @nxserve/realtime dev` (port 3002, needs Redis). `pnpm --filter @nxserve/realtime test`
runs unit tests for the handshake auth and room routing.
