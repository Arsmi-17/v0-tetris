# Realtime Challenge, Friends, and Pocket Console

This is the first implementation layer for realtime features. The durable database layer can be added after the protocol is stable.

## Projects

- `apps/realtime-server`: WebSocket gateway for presence, challenge rooms, friends events, and pocket-console pairing.
- `apps/mobile-console`: mobile web controller that joins a game screen with a six digit code.
- `apps/gamehub-sdk`: game SDK for HTML games and Unity WebGL builds.

## Local Run

```bash
npm run dev:realtime
npm run dev:platform
npm run dev:mobile
```

Set `NEXT_PUBLIC_REALTIME_WS_URL=ws://localhost:3010/ws` for browser clients.
The platform header uses this same env var to open a Pocket Console host session and display the joining ID.
Prefer app-local env files:
- `apps/platform/.env.local` for the platform host page.
- `apps/mobile-console/.env.local` for the mobile controller app.

## Pocket Console Routing

The game screen owns a private `platformSessionId`. The realtime server creates a short public `joinCode` for that exact session.

```txt
mobile code -> realtime server -> platformSessionId -> platform page -> game iframe
```

The game never uses the join code. HTML and Unity games talk to the parent platform page through `GameHubSDK`; the platform page is responsible for forwarding mobile input to the correct iframe.

## WebSocket Message Types

### Presence

- `client_register`: `{ userId, displayName }`
- `presence_active_users`: returns online users.

### Pocket Console

- `host_register`: `{ platformSessionId, gameId, maxPlayers, hostUserId }`
- `host_renew_code`: creates a fresh code for the same host session.
- `game_ready`: `{ maxPlayers, controllerSchema }`
- `controller_join`: `{ joinCode, userId?, displayName? }`
- `controller_reconnect`: `{ controllerToken }`
- `controller_input`: `{ input, sequence? }`

### Challenge

- `challenge_create`: `{ gameId, maxPlayers, inviteUserIds? }`
- `challenge_accept`: `{ challengeId }`
- `challenge_decline`: `{ challengeId }`
- `challenge_cancel`: `{ challengeId }`
- `challenge_state`: `{ challengeId, score?, rankScore?, state? }`
- `challenge_result`: `{ challengeId, score?, result?, completed? }`

### Friends

- `friend_request_create`: `{ receiverId }`
- `friend_request_accept`: `{ requestId }`
- `friend_request_reject`: `{ requestId }`
- `friends_list`: returns friend summaries with online status.

## Game SDK

HTML games can load `apps/gamehub-sdk/web/gamehub-sdk.js` or import `@gamehub/sdk`.

```js
const sdk = GameHubSDK.create({
  capabilities: { challenge: true, pocketConsole: true },
});

sdk.pocket.ready({ maxPlayers: 4, layout: "dpad-buttons" });
sdk.pocket.onInput(({ playerSlot, input }) => {
  // apply input to playerSlot
});

sdk.challenge.ready({ maxPlayers: 2, mode: "ranked", ranked: true });
sdk.challenge.onStart(({ challengeId, players, seed }) => {
  // start deterministic match
});
sdk.challenge.updateState({ score: 1200, progress: 0.8 });
sdk.challenge.submitResult({ score: 1400, completed: true, result: "won" });
```

Unity WebGL games copy:

- `apps/gamehub-sdk/unity/GameHubBridge.cs`
- `apps/gamehub-sdk/unity/GameHubBridge.jslib`

Then attach `GameHubBridge` to a scene object and call:

```csharp
GameHubBridge.Instance.PocketReady(4, "dpad-buttons");
GameHubBridge.Instance.ChallengeReady(2, "ranked", true);
GameHubBridge.Instance.ChallengeState("{\"score\":1200}");
```

Override the `OnGameHub...` methods or route those callbacks into game systems.

## Next Step

Wire `apps/platform/components/GameEmbed.tsx` to `apps/realtime-server` so SDK events from the iframe are forwarded to realtime rooms, and incoming realtime messages are posted back into the iframe.
