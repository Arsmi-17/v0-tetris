# Game Bridge SDK (Platform <-> Game)

This repo supports **host <-> game communication** using `window.postMessage`. It works for:

- **HTML5 games** hosted anywhere (Vercel, itch.io, your CDN) and embedded via `<iframe>`
- **Unity WebGL games** uploaded to this platform (served under `/unity/<slug>/...`)

The same bridge is used by:

- The **public platform** game page embed
- The **dashboard preview** (QA/Preview) + its **Logs/Warnings** panel

The goal: a game developer can integrate once and get fullscreen, logs, and future platform features without platform-specific hacks.

---

## 1) What you must support (today)

### Required

- Your game must be able to run inside an `<iframe>`.
- Your game must not crash when it receives unknown/unsupported bridge messages.

### Strongly recommended (HTML games)

- Implement the **bridge handshake**: host sends `init`, game replies `ready`.
- Forward logs to the host so dashboard preview can show them.
- If your game has an **in-game fullscreen button**, request **platform fullscreen** through the bridge.

### Unity WebGL note (important)

If your Unity WebGL build is uploaded to this platform, the platform/dashboard will **inject a small script into your `index.html` at runtime** that:

- Completes the handshake (`init` -> `ready`) even with no C# changes
- Reports load progress (`gamehub:unity:progress`) and readiness (`gamehub:unity:ready`)
- Forwards runtime errors (`gamehub:unity:error`) + bridge error logs

So Unity "just works" for preview/loading/error visibility. Advanced gameplay events are optional (see Unity section).

---

## 2) Message protocol (v1)

All bridge messages are JSON objects sent via `postMessage`.

- `type` always starts with `gamehub:bridge:`
- `version` is currently `1`
- `ts` is a unix timestamp in milliseconds (`Date.now()`)

### Host -> Game

```ts
{
  type: "gamehub:bridge:init",
  version: 1,
  ts: number,
  role: "platform" | "dashboard-preview" | "dashboard",
  sessionId: string,
  gameId?: string,
  slug?: string,
  embedType?: "html" | "unity-webgl",
  orientation?: "landscape" | "portrait"
}
```

### Game -> Host

```ts
{
  type: "gamehub:bridge:ready",
  version: 1,
  ts: number,
  sdk?: string
}

{
  type: "gamehub:bridge:event",
  version: 1,
  ts: number,
  name: string,
  payload?: any
}

{
  type: "gamehub:bridge:log",
  version: 1,
  ts: number,
  level: "debug" | "info" | "warn" | "error",
  message: string,
  data?: any
}
```

### Security / origin rules

Games SHOULD:

- Verify `event.origin` matches the platform origin (recommended in production).
- Send replies only to the platform origin (avoid `*` in production).

The platform/dashboard also validates the iframe origin before trusting messages.

---

## 3) Handshake lifecycle

1. Host embeds the game in an `<iframe>`.
2. Host sends `gamehub:bridge:init` after the iframe loads.
3. Game replies with `gamehub:bridge:ready`.
4. Host hides the loading overlay after it receives `ready`.

Games should handle multiple inits safely (page reloads, preview relaunch, etc.).

---

## 4) Events (what the platform listens to today)

### `request_fullscreen` (supported now)

If your game has an in-game fullscreen button, emit:

```js
window.GameHubBridge?.requestPlatformFullscreen?.();
// or equivalently:
window.parent?.postMessage({
  type: "gamehub:bridge:event",
  version: 1,
  ts: Date.now(),
  name: "request_fullscreen",
  payload: { from: "my-game" }
}, "*");
```

The platform/dashboard will attempt to fullscreen the game container.

Important browser note:

- Fullscreen often requires a **user gesture**.
- If you emit this event from a click handler, it has the best chance to work.
- Modern browsers may still block fullscreen if they don't consider the message "user activated".

Our HTML helper uses `postMessage(..., { includeUserActivation: true })` where supported.

---

## 5) Logging (recommended)

Send logs so the dashboard preview can show what your game is doing.

```js
window.GameHubBridge?.log?.("info", "Game started");
window.GameHubBridge?.log?.("warn", "Using fallback renderer", { reason: "no-webgl" });
window.GameHubBridge?.log?.("error", "Unexpected error", { code: "E_RUNTIME" });
```

The dashboard treats `level: "error"` as a warning entry for QA.

---

## 6) HTML5 integration

### Recommended: copy our helper

Copy the helper script into your game project:

- `tetris-game/gamehub-bridge.js`

Include it in your `index.html`:

```html
<script src="./gamehub-bridge.js"></script>
```

Then use:

```js
window.GameHubBridge?.emitEvent("game_start");
window.GameHubBridge?.emitEvent("score", { score: 123 });
window.GameHubBridge?.requestPlatformFullscreen?.();
window.GameHubBridge?.log?.("info", "Bridge init received");
```

### Minimal custom integration (if you prefer not to copy a file)

```html
<script>
  (function () {
    var TARGET_ORIGIN = "*"; // set to platform origin in production
    function send(type, body) {
      try {
        if (!window.parent || window.parent === window) return;
        window.parent.postMessage(
          Object.assign({ type: type, version: 1, ts: Date.now() }, body || {}),
          TARGET_ORIGIN
        );
      } catch (e) {}
    }

    window.addEventListener("message", function (ev) {
      var d = ev && ev.data;
      if (!d || typeof d !== "object") return;
      if (d.type === "gamehub:bridge:init") {
        send("gamehub:bridge:ready", { sdk: "html-inline" });
        send("gamehub:bridge:log", { level: "info", message: "Bridge init received" });
      }
    });
  })();
</script>
```

---

## 7) Unity WebGL integration

### "No C# changes" (supported for uploaded builds)

If you upload a Unity WebGL build to this platform, the platform/dashboard injects the bridge automatically so:

- The loading overlay can finish
- Progress/ready/errors show up in the dashboard preview logs

### Emitting gameplay events (advanced)

To emit events from Unity to the host, add a WebGL `.jslib` plugin that calls `window.GameHubBridge` (or `postMessage`).

Conceptual `.jslib`:

```js
mergeInto(LibraryManager.library, {
  GameHubEmitEvent: function (namePtr, jsonPtr) {
    var name = UTF8ToString(namePtr);
    var json = UTF8ToString(jsonPtr || 0);
    var payload = null;
    try { payload = json ? JSON.parse(json) : null; } catch (e) {}
    window.GameHubBridge?.emitEvent?.(name, payload);
  }
});
```

Conceptual C# wrapper:

```csharp
#if UNITY_WEBGL && !UNITY_EDITOR
using System.Runtime.InteropServices;
#endif

public static class GameHubBridge {
  #if UNITY_WEBGL && !UNITY_EDITOR
  [DllImport("__Internal")] private static extern void GameHubEmitEvent(string name, string payloadJson);
  #endif

  public static void Emit(string name, string payloadJson = "{}") {
    #if UNITY_WEBGL && !UNITY_EDITOR
    GameHubEmitEvent(name, payloadJson);
    #endif
  }
}
```

> This is an "advanced integration" and will evolve as we publish a formal Unity package.

---

## 8) Debugging checklist

### Dashboard preview

In the preview/QA step, open the Logs/Warnings panel to see:

- `[platform -> game] ...` messages (init, etc.)
- `[game -> platform] ...` messages (ready, logs, events)

### Common problems

- Game never leaves loading:
  - HTML: you're not replying with `gamehub:bridge:ready`
  - Unity: your build may be missing `Build/` assets or failing at runtime; check `gamehub:unity:error` / console
- Fullscreen request doesn't work:
  - Must be triggered by a user click inside the game
  - Some browsers block fullscreen from cross-window messaging
- Game won't embed:
  - Check `Content-Security-Policy: frame-ancestors ...`
  - Check `X-Frame-Options`

---

## 9) "Future" features (planned)

These are not required today, but the bridge is designed to support them:

- Cloud saves (`save_get` / `save_set`)
- Rewarded ads (`ad_request` / `ad_complete`)
- Purchases (`purchase_request` / `purchase_complete`)
- Auth (`auth_login` / `auth_logout`)
- Achievements / leaderboards
- Remote config and A/B experiments
- Accessibility and safe-area hints

When new host -> game messages are added, games should ignore unknown types and continue running safely.
