import { homedir } from "node:os";
import { join } from "node:path";

export const DEBUG_HOST = "127.0.0.1";
export const DEBUG_PORT = 9223;
export const DEBUG_URL = `http://${DEBUG_HOST}:${DEBUG_PORT}`;
export const PROFILE_DIR = join(homedir(), ".pi", "browser-profile");
export const STARTUP_LOCK_DIR = join(PROFILE_DIR, ".startup-lock");
export const STARTUP_TIMEOUT_MS = 30_000;
export const TOOL_PREFIX = "browser_";

const SAFE_ENVIRONMENT_KEYS = [
	"COMSPEC",
	"DBUS_SESSION_BUS_ADDRESS",
	"DISPLAY",
	"HOME",
	"LANG",
	"LC_ALL",
	"LOCALAPPDATA",
	"PATH",
	"PATHEXT",
	"SystemRoot",
	"TEMP",
	"TMP",
	"TMPDIR",
	"USERPROFILE",
	"WAYLAND_DISPLAY",
	"WINDIR",
	"XDG_RUNTIME_DIR",
] as const;

const EXCLUDED_TOOL_PATTERNS = [
	/^performance_/,
	/^lighthouse_/,
	/^screencast_/,
	/heapsnapshot/,
	/(^|_)extension(s)?$/,
	/_3p_/,
	/webmcp/,
];

export function shouldExcludeTool(name: string): boolean {
	return EXCLUDED_TOOL_PATTERNS.some((pattern) => pattern.test(name.toLowerCase()));
}

export function prefixToolName(name: string): string {
	return name.startsWith(TOOL_PREFIX) ? name : `${TOOL_PREFIX}${name}`;
}

export function getSafeProcessEnvironment(
	source: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
	return Object.fromEntries(
		SAFE_ENVIRONMENT_KEYS.flatMap((key) => source[key] === undefined ? [] : [[key, source[key]] as [string, string]]),
	);
}

export function getChromeCandidates(
	platform = process.platform,
	home = homedir(),
	override = process.env.PI_CHROME_PATH,
): string[] {
	if (override) return [override];

	if (platform === "darwin") {
		return [
			"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
			join(home, "Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
			"/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta",
		];
	}

	if (platform === "win32") {
		return [
			join(process.env.PROGRAMFILES ?? "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe"),
			join(process.env["PROGRAMFILES(X86)"] ?? "C:\\Program Files (x86)", "Google", "Chrome", "Application", "chrome.exe"),
			join(process.env.LOCALAPPDATA ?? join(home, "AppData", "Local"), "Google", "Chrome", "Application", "chrome.exe"),
			"chrome.exe",
		];
	}

	return ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"];
}

export function getChromeArguments(): string[] {
	return [
		`--remote-debugging-address=${DEBUG_HOST}`,
		`--remote-debugging-port=${DEBUG_PORT}`,
		`--user-data-dir=${PROFILE_DIR}`,
		"--no-first-run",
		"--no-default-browser-check",
		"--disable-background-networking",
		"--disable-component-update",
		"--disable-crash-reporter",
		"--disable-sync",
		"--no-pings",
		"about:blank",
	];
}

export function getMcpArguments(serverPath: string): string[] {
	return [
		serverPath,
		`--browser-url=${DEBUG_URL}`,
		"--category-performance=false",
		"--no-performance-crux",
		"--no-usage-statistics",
		"--redact-network-headers",
		"--experimental-page-id-routing",
		"--screenshot-format=jpeg",
		"--screenshot-quality=80",
		"--screenshot-max-width=1600",
		"--screenshot-max-height=1200",
	];
}
