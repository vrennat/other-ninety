# Pi Chrome browser

Global Pi extension providing `browser_*` tools through a pinned `chrome-devtools-mcp` dependency.

## Behavior

- Uses the dedicated persistent profile `~/.pi/browser-profile`.
- Starts Chrome lazily on the first browser tool call.
- Shares Chrome across concurrent Pi sessions through `127.0.0.1:9223`; every session can see the same tabs, cookies, and storage.
- Enables MCP page-ID routing so concurrent sessions can target explicit tabs.
- Stops each session's MCP subprocess on shutdown but leaves shared Chrome running.
- Preserves cookies and logins without exposing the normal Chrome profile.
- Disables MCP usage statistics, update checks, CrUX lookups, and sensitive network headers.
- Omits performance, Lighthouse, screencast, heap, extension-management, third-party, and WebMCP tools.

Use `/browser-status` to inspect the profile, Chrome endpoint, and MCP connection. Set `PI_CHROME_PATH` when Chrome is installed in a nonstandard location.

## Security boundary

Any local process can connect to a Chrome remote-debugging port, and every Pi session shares this browser's authenticated state. Only authenticate the dedicated profile to accounts all local Pi sessions may control, and close the dedicated Chrome window when browser access is not needed.

To reset retained cookies and storage, close the dedicated Chrome window and delete `~/.pi/browser-profile` manually.

## Development

From `pi/`:

```bash
bun install
bun run check
bun test
```
