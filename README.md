# opencode-9router

Unified 9Router provider and model discovery plugin for OpenCode. Replaces `@vheins/opencode-9router`, `@dendaio/opencode-9router-plugin`, and the 9Router bridge in `@benjamolina/pi-kit`.

## Features

- **Automatic discovery** — dynamically queries `/v1/models` from 9Router
- **Smart caching & offline resilience** — file-based cache in `~/.cache/opencode-9router/` with stale fallback
- **Heuristic model enrichment** — context limits, output caps, tool calling, vision, and reasoning detection
- **Multi-instance gateway support** — matches any provider starting with `9router` (e.g. `9router`, `9router-local`, `9router-remote`)
- **Auto-registration** — registers default `9router` provider if none configured

## Installation

> **Note:** the npm package named `opencode-9router` is published by a different
> author and is not this project. Do not add `"opencode-9router"` to your
> `plugin` list expecting this code. Install from source instead:

```bash
git clone https://github.com/nadimtuhin/opencode-9router.git
cd opencode-9router
bun install
bun run build
```

Then point opencode at the cloned directory (absolute path; opencode loads
`dist/index.js` through the package's `main` field) in `opencode.json` (or
`opencode.jsonc`):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "/absolute/path/to/opencode-9router"
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

If your 9Router instance requires a key, export it before starting opencode:

```bash
export NINEROUTER_API_KEY=your-key
```

The plugin adds `"env": ["NINEROUTER_API_KEY"]` to each `9router*` provider
that has no `env` set, so opencode sends the key on chat requests as well as
during model discovery.

## Options

- `baseURL` (default: `http://127.0.0.1:20128/v1`)
- `apiKey` (default: `process.env.NINEROUTER_API_KEY` or empty)
- `cache` (default: `true`)
- `cacheTTL` (default: 3 hours in ms)
- `discoveryTimeout` (default: 10 seconds in ms)
- `staleFallback` (default: `true`)
- `excludePrefixes` (e.g. `["test/"]`)
