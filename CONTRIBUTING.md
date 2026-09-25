# Contributing to opencode-9router

Contributions are welcome! Please follow these guidelines:

## Development Setup

1. Clone repository:
   ```bash
   git clone https://github.com/nadimtuhin/opencode-9router.git
   cd opencode-9router
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Build:
   ```bash
   bun run build
   ```

4. Run tests:
   ```bash
   bun test
   ```

## Pull Request Guidelines

- Ensure `bun test` passes with 100% coverage on new features.
- Avoid introducing external runtime dependencies unless strictly necessary.
- Format code cleanly.
