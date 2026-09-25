# opencode-9router

Unified 9Router provider and model discovery plugin for OpenCode. Replaces `@vheins/opencode-9router`, `@dendaio/opencode-9router-plugin`, and the 9Router bridge in `@benjamolina/pi-kit`.

## Features

- **Automatic discovery** — dynamically queries `/v1/models` from 9Router
- **Smart caching & offline resilience** — file-based cache in `~/.cache/opencode-9router/` with stale fallback
- **Heuristic model enrichment** — context limits, output caps, tool calling, vision, and reasoning detection
- **Multi-instance gateway support** — matches any provider starting with `9router` (e.g. `9router`, `9router-local`, `9router-remote`)
- **Auto-registration** — registers default `9router` provider if none configured

## Installation

Add to `opencode.json` (or `opencode.jsonc`):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "opencode-9router"
  ],
  "provider": {
    "9router": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "9Router",
      "options": {
        "baseURL": "http://127.0.0.1:20128/v1",
        "cacheTTL": 10800000
      }
    }
  }
}
```

## Options

- `baseURL` (default: `http://127.0.0.1:20128/v1`)
- `apiKey` (default: `process.env.NINEROUTER_API_KEY` or empty)
- `cache` (default: `true`)
- `cacheTTL` (default: 3 hours in ms)
- `discoveryTimeout` (default: 10 seconds in ms)
- `staleFallback` (default: `true`)
- `excludePrefixes` (e.g. `["test/"]`)
