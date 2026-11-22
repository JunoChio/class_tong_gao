import { ClassBoardData } from "@/types/board";

const CHANNEL_NAME = "classboard_live_sync_v1";

export interface LiveSyncMessage {
  type: "board_update";
  data: ClassBoardData;
  sentAt: number;
}

export function broadcastBoardUpdate(data: ClassBoardData): void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
  try {
    const ch = new BroadcastChannel(CHANNEL_NAME);
    const msg: LiveSyncMessage = {
      type: "board_update",
      data,
      sentAt: performance.now(),
    };
    ch.postMessage(msg);
    ch.close();
  } catch {
    // ignore
  }
}

export function subscribeBoardUpdates(
  onReceive: (data: ClassBoardData, latencyMs: number) => void
): () => void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return () => {};
  }
  try {
    const ch = new BroadcastChannel(CHANNEL_NAME);
    ch.onmessage = (ev: MessageEvent<LiveSyncMessage>) => {
      if (ev.data && ev.data.type === "board_update" && ev.data.data) {
        const latency = Math.max(0, Math.round(performance.now() - (ev.data.sentAt || 0)));
        onReceive(ev.data.data, latency);
      }
    };
    return () => {
      ch.close();
    };
  } catch {
    return () => {};
  }
}
