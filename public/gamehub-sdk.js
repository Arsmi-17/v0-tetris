(function () {
  "use strict";

  var BRIDGE_INIT = "gamehub:bridge:init";
  var BRIDGE_READY = "gamehub:bridge:ready";
  var BRIDGE_EVENT = "gamehub:bridge:event";
  var BRIDGE_LOG = "gamehub:bridge:log";

  function isObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function GameHubSDK(options) {
    options = options || {};
    this.sessionId = null;
    this.targetOrigin = options.targetOrigin || "*";
    this.debug = !!options.debug;
    this.capabilities = {
      challenge: !!(options.capabilities && options.capabilities.challenge),
      pocketConsole: !!(options.capabilities && options.capabilities.pocketConsole),
      fullscreen: !options.capabilities || options.capabilities.fullscreen !== false,
      mute: !options.capabilities || options.capabilities.mute !== false,
    };
    this.handlers = {};
    this.destroyed = false;
    this._onMessage = this._onMessage.bind(this);
    window.addEventListener("message", this._onMessage);

    var self = this;
    this.challenge = {
      ready: function (payload) { self.emit("gamehub:challenge:ready", payload || {}); },
      updateState: function (payload) { self.emit("gamehub:challenge:state", payload || {}); },
      submitResult: function (payload) { self.emit("gamehub:challenge:result", payload || {}); },
      onStart: function (handler) { return self.on("gamehub:challenge:start", handler); },
      onLeaderboard: function (handler) { return self.on("gamehub:challenge:leaderboard", handler); },
      onEnd: function (handler) { return self.on("gamehub:challenge:end", handler); },
    };
    this.pocket = {
      ready: function (payload) { self.emit("gamehub:pocket:ready", payload || {}); },
      setControllerSchema: function (payload) { self.emit("gamehub:pocket:schema", payload || {}); },
      onInput: function (handler) { return self.on("gamehub:pocket:input", handler); },
      onPlayerJoined: function (handler) { return self.on("gamehub:pocket:player_joined", handler); },
      onPlayerReconnected: function (handler) { return self.on("gamehub:pocket:player_reconnected", handler); },
      onPlayerLeft: function (handler) { return self.on("gamehub:pocket:player_left", handler); },
    };
  }

  GameHubSDK.create = function (options) {
    return new GameHubSDK(options);
  };

  GameHubSDK.prototype.destroy = function () {
    this.destroyed = true;
    this.handlers = {};
    window.removeEventListener("message", this._onMessage);
  };

  GameHubSDK.prototype.on = function (type, handler) {
    if (!this.handlers[type]) this.handlers[type] = [];
    this.handlers[type].push(handler);
    var list = this.handlers[type];
    return function () {
      var index = list.indexOf(handler);
      if (index >= 0) list.splice(index, 1);
    };
  };

  GameHubSDK.prototype.emit = function (event, payload) {
    this._send(BRIDGE_EVENT, { event: event, name: event, payload: payload || {} });
  };

  GameHubSDK.prototype.log = function (level, message, data) {
    this._send(BRIDGE_LOG, { level: level, message: message, data: data || null });
  };

  GameHubSDK.prototype.requestPlatformFullscreen = function (orientation) {
    this.emit("fullscreen_request", { orientation: orientation || "auto" });
  };

  GameHubSDK.prototype.setMuted = function (muted) {
    this.emit("audio_muted", { muted: !!muted });
  };

  GameHubSDK.prototype.getSessionId = function () {
    return this.sessionId;
  };

  GameHubSDK.prototype._onMessage = function (event) {
    var data = event.data;
    if (this.destroyed || !isObject(data) || typeof data.type !== "string") return;
    if (data.type === BRIDGE_INIT) {
      if (typeof data.sessionId === "string") this.sessionId = data.sessionId;
      this._send(BRIDGE_READY, {
        sdk: "@gamehub/sdk",
        version: "0.1.0",
        capabilities: this.capabilities,
      });
      this.log("info", "GameHub SDK ready");
      return;
    }
    var eventType = data.type === BRIDGE_EVENT && typeof data.event === "string" ? data.event : data.type;
    var payload = data.type === BRIDGE_EVENT && isObject(data.payload) ? data.payload : data;
    this._dispatch(eventType, payload);
  };

  GameHubSDK.prototype._dispatch = function (type, payload) {
    if (this.debug && console && console.debug) console.debug("[GameHubSDK] recv", type, payload);
    var list = this.handlers[type] || [];
    list.slice().forEach(function (handler) { handler(payload); });
  };

  GameHubSDK.prototype._send = function (type, payload) {
    if (!window.parent) return;
    var message = Object.assign({ type: type, sessionId: this.sessionId || undefined }, payload || {});
    if (this.debug && console && console.debug) console.debug("[GameHubSDK] send", message);
    window.parent.postMessage(message, this.targetOrigin);
  };

  window.GameHubSDK = GameHubSDK;
  window.GameHubBridge = window.GameHubBridge || GameHubSDK.create({ debug: false });
})();
