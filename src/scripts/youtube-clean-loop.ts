/**
 * Seamless loop for YouTube "loop" videos in project galleries.
 *
 * YouTube's own loop (loop=1&playlist=id) lets the video end and restart,
 * and every restart flashes the title, controls and play icon. Instead,
 * this talks to the player through its postMessage API (enablejsapi=1 —
 * no external script, so the CSP stays strict) and rewinds a moment
 * before the end, so the video never reaches "ended".
 *
 * It also keeps the video invisible until it's actually playing, hiding
 * the brief load/spinner state.
 */
const YOUTUBE_ORIGIN = "https://www.youtube-nocookie.com";
/** Rewind this many seconds before the end — progress updates arrive every ~0.25s. */
const REWIND_BEFORE_END = 0.35;
/** If the player never reports "playing" (blocked, offline), show it anyway. */
const REVEAL_FALLBACK_MS = 5000;
const PLAYING = 1;
const ENDED = 0;

interface PlayerInfo {
	currentTime?: number;
	duration?: number;
	playerState?: number;
}

interface LoopPlayer {
	iframe: HTMLIFrameElement;
	wrapper: HTMLElement;
	duration: number;
	rewinding: boolean;
}

let players: LoopPlayer[] = [];
let revealTimers: number[] = [];

function send(player: LoopPlayer, message: Record<string, unknown>) {
	player.iframe.contentWindow?.postMessage(JSON.stringify({ ...message, channel: "widget" }), YOUTUBE_ORIGIN);
}

function command(player: LoopPlayer, func: string, args: unknown[] = []) {
	send(player, { event: "command", func, args });
}

function reveal(player: LoopPlayer) {
	player.wrapper.classList.add("is-playing");
}

function rewind(player: LoopPlayer) {
	if (player.rewinding) return;
	player.rewinding = true;
	command(player, "seekTo", [0, true]);
	command(player, "playVideo");
	// Progress keeps reporting the old time for a moment after the seek.
	window.setTimeout(() => (player.rewinding = false), 1000);
}

function onMessage(event: MessageEvent) {
	if (event.origin !== YOUTUBE_ORIGIN || typeof event.data !== "string") return;
	const player = players.find((p) => p.iframe.contentWindow === event.source);
	if (!player) return;

	let data: { event?: string; info?: PlayerInfo };
	try {
		data = JSON.parse(event.data);
	} catch {
		return;
	}
	const info = data.info;
	if (!info) return;

	if (typeof info.duration === "number" && info.duration > 0) player.duration = info.duration;
	if (info.playerState === PLAYING) reveal(player);
	if (info.playerState === ENDED) {
		rewind(player);
		return;
	}
	if (
		typeof info.currentTime === "number" &&
		player.duration > 0 &&
		info.currentTime >= player.duration - REWIND_BEFORE_END
	) {
		rewind(player);
	}
}

function listen(player: LoopPlayer) {
	// Tells the player to start sending state/progress updates here.
	send(player, { event: "listening", id: players.indexOf(player) + 1 });
}

export function initYouTubeCleanLoops() {
	cleanupYouTubeCleanLoops();
	players = Array.from(
		document.querySelectorAll<HTMLElement>(".gallery-video--loop[data-provider='youtube']"),
	).flatMap((wrapper) => {
		const iframe = wrapper.querySelector("iframe");
		return iframe ? [{ iframe, wrapper, duration: 0, rewinding: false }] : [];
	});
	if (!players.length) return;

	window.addEventListener("message", onMessage);
	players.forEach((player) => {
		// The iframe may already be loaded, or load later (loading="lazy").
		listen(player);
		player.iframe.addEventListener("load", () => {
			listen(player);
			revealTimers.push(window.setTimeout(() => reveal(player), REVEAL_FALLBACK_MS));
		});
	});
}

export function cleanupYouTubeCleanLoops() {
	window.removeEventListener("message", onMessage);
	revealTimers.forEach((timer) => window.clearTimeout(timer));
	revealTimers = [];
	players = [];
}
