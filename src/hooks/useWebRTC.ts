import { useRef, useState, useCallback, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";

// Free public STUN + TURN servers (open-relay.metered.ca provides free TURN)
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
    // Free TURN relay — critical for mobile / symmetric NAT
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
  iceCandidatePoolSize: 10,
};

type SignalMessage = {
  type: "offer" | "answer" | "ice-candidate" | "hangup";
  payload: any;
  from: string;
  to?: string;
};

interface UseWebRTCOptions {
  deviceId: string;
  role: "camera" | "viewer";
  localStream?: MediaStream | null;
  onRemoteStream?: (stream: MediaStream) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onDataMessage?: (data: any) => void;
}

export const useWebRTC = ({
  deviceId,
  role,
  localStream,
  onRemoteStream,
  onConnectionStateChange,
  onDataMessage,
}: UseWebRTCOptions) => {
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const dataChannelsRef = useRef<Map<string, RTCDataChannel>>(new Map());
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");
  const [isConnected, setIsConnected] = useState(false);
  const [isReceivingAudio, setIsReceivingAudio] = useState(false);
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const retryTimeoutRef = useRef<number | null>(null);
  const isNegotiatingRef = useRef<Map<string, boolean>>(new Map());

  const callbacksRef = useRef({ onRemoteStream, onConnectionStateChange, onDataMessage });
  const localStreamRef = useRef(localStream);

  useEffect(() => {
    callbacksRef.current = { onRemoteStream, onConnectionStateChange, onDataMessage };
  }, [onRemoteStream, onConnectionStateChange, onDataMessage]);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // Stable unique ID for this peer session
  const myId = useRef(`${role}-${Math.random().toString(36).slice(2, 10)}`).current;

  const sendSignal = useCallback(async (message: SignalMessage) => {
    try {
      await addDoc(collection(db, "signaling_v2"), {
        ...message,
        deviceId,
        created_at: serverTimestamp(),
      });
    } catch (e) {
      console.error("[WebRTC] Failed to send signal:", e);
    }
  }, [deviceId]);

  const createPeerConnection = useCallback((remotePeerId: string) => {
    console.log(`[WebRTC] Creating peer connection → ${remotePeerId}`);

    // Close any existing stale PC for this peer
    const existing = pcsRef.current.get(remotePeerId);
    if (existing && existing.connectionState !== "closed") {
      existing.close();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    isNegotiatingRef.current.set(remotePeerId, false);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const type = event.candidate.type || "host";
        console.log(`[ICE] Local candidate (${type}): ${event.candidate.candidate.substring(0, 60)}...`);
        sendSignal({
          type: "ice-candidate",
          payload: event.candidate.toJSON(),
          from: myId,
          to: remotePeerId,
        });
      } else {
        console.log("[ICE] Gathering complete.");
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log(`[ICE] Gathering state: ${pc.iceGatheringState}`);
    };

    pc.ontrack = (event) => {
      console.log(`[WebRTC] ontrack: kind=${event.track.kind}, streams=${event.streams.length}`);
      if (event.streams && event.streams[0]) {
        callbacksRef.current.onRemoteStream?.(event.streams[0]);

        if (role === "camera" && event.track.kind === "audio") {
          setIsReceivingAudio(true);
          let audioEl = document.getElementById(`audio-${remotePeerId}`) as HTMLAudioElement;
          if (!audioEl) {
            audioEl = document.createElement("audio");
            audioEl.id = `audio-${remotePeerId}`;
            audioEl.autoplay = true;
            (audioEl as any).playsInline = true;
            audioEl.style.display = "none";
            document.body.appendChild(audioEl);
          }
          audioEl.srcObject = event.streams[0];
          audioEl.play().catch((e) => console.warn("[WebRTC] Audio autoplay blocked:", e));

          event.track.onended = () => setIsReceivingAudio(false);
          event.track.onmute = () => setIsReceivingAudio(false);
          event.track.onunmute = () => setIsReceivingAudio(true);
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE connection state → ${pc.iceConnectionState} (peer: ${remotePeerId})`);
      if (pc.iceConnectionState === "failed") {
        console.warn("[WebRTC] ICE failed — attempting ICE restart...");
        if (role === "viewer" && pc.signalingState === "stable") {
          pc.restartIce();
          pc.createOffer({ iceRestart: true })
            .then((offer) => {
              pc.setLocalDescription(offer);
              sendSignal({ type: "offer", payload: offer, from: myId, to: remotePeerId });
            })
            .catch((e) => console.error("[WebRTC] ICE restart offer failed:", e));
        }
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`[WebRTC] Connection state → ${state} (peer: ${remotePeerId})`);

      if (role === "viewer") {
        setConnectionState(state);
        setIsConnected(state === "connected");
      } else {
        const anyConnected = Array.from(pcsRef.current.values()).some(
          (p) => p.connectionState === "connected"
        );
        setIsConnected(anyConnected);
        setConnectionState(anyConnected ? "connected" : state === "failed" ? "failed" : "new");
      }

      callbacksRef.current.onConnectionStateChange?.(state);

      if (state === "failed" || state === "closed") {
        pcsRef.current.delete(remotePeerId);
        dataChannelsRef.current.delete(remotePeerId);
        isNegotiatingRef.current.delete(remotePeerId);
        // Cleanup audio element
        const audioEl = document.getElementById(`audio-${remotePeerId}`);
        if (audioEl) audioEl.remove();
      }
    };

    // Perfect Negotiation pattern — prevents glare/collision
    pc.onnegotiationneeded = async () => {
      // Only the viewer initiates offers
      if (role !== "viewer") return;
      // Guard against re-entrant negotiation
      if (isNegotiatingRef.current.get(remotePeerId)) return;
      if (pc.signalingState !== "stable") return;

      isNegotiatingRef.current.set(remotePeerId, true);
      try {
        console.log(`[WebRTC] Negotiation needed → creating offer for ${remotePeerId}`);
        const offer = await pc.createOffer();
        if (pc.signalingState !== "stable") return; // Check again after async
        await pc.setLocalDescription(offer);
        sendSignal({ type: "offer", payload: offer, from: myId, to: remotePeerId });
      } catch (e) {
        console.error("[WebRTC] onnegotiationneeded failed:", e);
      } finally {
        isNegotiatingRef.current.set(remotePeerId, false);
      }
    };

    // Camera side: receive data channel created by viewer
    if (role === "camera") {
      pc.ondatachannel = (event) => {
        const dc = event.channel;
        console.log(`[WebRTC] Camera received data channel: ${dc.label}`);
        dataChannelsRef.current.set(remotePeerId, dc);
        dc.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            callbacksRef.current.onDataMessage?.(data);
          } catch (err) {
            console.error("[WebRTC] Error parsing data channel message:", err);
          }
        };
        dc.onopen = () => console.log(`[WebRTC] Camera data channel open (${remotePeerId})`);
        dc.onclose = () => console.warn(`[WebRTC] Camera data channel closed (${remotePeerId})`);
      };
    }

    // Add local media tracks immediately if available
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        console.log(`[WebRTC] Adding local ${track.kind} track to PC`);
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pcsRef.current.set(remotePeerId, pc);
    return pc;
  }, [myId, role, sendSignal]);

  const handleSignal = useCallback(
    async (message: SignalMessage) => {
      if (message.from === myId) return;

      // Filter out signals not addressed to us
      // Camera accepts signals with no `to` (broadcast offers from viewers)
      // Viewer accepts signals to its specific myId
      if (message.to && message.to !== myId) return;

      console.log(`[Signaling] ← ${message.type} from ${message.from}`);
      let pc = pcsRef.current.get(message.from);

      // Remap generic "camera" PC key to the actual sender ID (viewer side)
      if (!pc && role === "viewer" && pcsRef.current.has("camera")) {
        const storedPc = pcsRef.current.get("camera");
        if (storedPc) {
          pc = storedPc;
          pcsRef.current.set(message.from, pc);
          pcsRef.current.delete("camera");
          // Remap data channel key too
          const dc = dataChannelsRef.current.get("camera");
          if (dc) {
            dataChannelsRef.current.set(message.from, dc);
            dataChannelsRef.current.delete("camera");
          }
          isNegotiatingRef.current.set(message.from, false);
          isNegotiatingRef.current.delete("camera");
        }
      }

      switch (message.type) {
        case "offer": {
          // Perfect negotiation: camera is the "polite" peer
          const isPolite = role === "camera";
          const offerCollision =
            pc &&
            (isNegotiatingRef.current.get(message.from) ||
              pc.signalingState !== "stable");

          if (offerCollision && !isPolite) {
            console.warn("[WebRTC] Offer collision, impolite peer ignoring.");
            return;
          }

          // Closed PC — recreate
          if (pc && pc.signalingState === "closed") {
            pcsRef.current.delete(message.from);
            pc = undefined;
          }

          if (!pc) pc = createPeerConnection(message.from);

          try {
            if (offerCollision && isPolite) {
              await pc.setLocalDescription({ type: "rollback" });
            }

            await pc.setRemoteDescription(new RTCSessionDescription(message.payload));

            // Flush pending ICE candidates
            const pending = pendingCandidatesRef.current.get(message.from) || [];
            for (const c of pending) {
              await pc.addIceCandidate(new RTCIceCandidate(c)).catch((e) =>
                console.warn("[ICE] Pending candidate error:", e)
              );
            }
            pendingCandidatesRef.current.delete(message.from);

            // Camera adds its video/audio tracks before answering
            if (role === "camera" && localStreamRef.current) {
              const senders = pc.getSenders();
              localStreamRef.current.getTracks().forEach((track) => {
                const alreadyAdded = senders.some((s) => s.track?.id === track.id);
                if (!alreadyAdded) {
                  console.log(`[WebRTC] Camera adding ${track.kind} track before answer`);
                  pc!.addTrack(track, localStreamRef.current!);
                }
              });
            }

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            console.log(`[Signaling] → answer to ${message.from}`);
            sendSignal({
              type: "answer",
              payload: answer,
              from: myId,
              to: message.from,
            });
          } catch (e) {
            console.error("[WebRTC] Failed to handle offer:", e);
            pcsRef.current.delete(message.from);
          }
          break;
        }

        case "answer": {
          if (!pc) {
            console.warn("[WebRTC] Received answer but no PC found for", message.from);
            return;
          }
          if (pc.signalingState !== "have-local-offer") {
            console.warn("[WebRTC] Received answer in wrong state:", pc.signalingState);
            return;
          }
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(message.payload));
            console.log(`[WebRTC] Remote description set for ${message.from}`);

            // Flush pending ICE candidates
            const pending = pendingCandidatesRef.current.get(message.from) || [];
            for (const c of pending) {
              await pc.addIceCandidate(new RTCIceCandidate(c)).catch((e) =>
                console.warn("[ICE] Pending candidate error:", e)
              );
            }
            pendingCandidatesRef.current.delete(message.from);
          } catch (e) {
            console.error("[WebRTC] Failed to handle answer:", e);
          }
          break;
        }

        case "ice-candidate": {
          if (!message.payload || !message.payload.candidate) break;
          try {
            if (!pc || !pc.remoteDescription) {
              // Queue until remote description is set
              const list = pendingCandidatesRef.current.get(message.from) || [];
              list.push(message.payload);
              pendingCandidatesRef.current.set(message.from, list);
            } else {
              await pc.addIceCandidate(new RTCIceCandidate(message.payload));
            }
          } catch (e) {
            console.warn("[ICE] Failed to add candidate:", e);
          }
          break;
        }

        case "hangup": {
          if (pc) {
            pc.close();
            pcsRef.current.delete(message.from);
            dataChannelsRef.current.delete(message.from);
            isNegotiatingRef.current.delete(message.from);
            if (role === "viewer") {
              setConnectionState("closed");
              setIsConnected(false);
            }
          }
          break;
        }
      }
    },
    [role, myId, createPeerConnection, sendSignal]
  );

  const [isChannelReady, setIsChannelReady] = useState(false);

  // ── Signaling listener (Firestore) ──────────────────────────────────────────
  useEffect(() => {
    if (!deviceId) return;

    const signalingQuery = query(
      collection(db, "signaling_v2"),
      where("deviceId", "==", deviceId)
    );

    const processedSignals = new Set<string>();
    const mountTime = Date.now();

    const unsubscribe = onSnapshot(
      signalingQuery,
      { includeMetadataChanges: false },
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type !== "added") return;
          const signalId = change.doc.id;
          if (processedSignals.has(signalId)) return;

          const data = change.doc.data() as SignalMessage & { created_at?: any };

          // Skip our own signals
          if (data.from === myId) return;

          // Stale signal guard — reject signals older than 10 minutes
          // (very generous window to handle Firestore clock drift)
          const signalTime = data.created_at?.toDate?.()?.getTime();
          if (signalTime && signalTime < mountTime - 600000) {
            console.log(`[Signaling] Ignoring stale ${data.type} from ${data.from}`);
            return;
          }

          processedSignals.add(signalId);
          handleSignal(data);

          // Cleanup processed signals directed at us
          if (data.to === myId || (role === "camera" && !data.to)) {
            deleteDoc(change.doc.ref).catch(() => {});
          }
        });
      },
      (err) => {
        console.error("[Signaling] Snapshot error:", err);
      }
    );

    setIsChannelReady(true);

    return () => {
      unsubscribe();
      setIsChannelReady(false);
    };
  }, [deviceId, handleSignal, myId, role]);

  // ── Viewer: initiate connection ─────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (role !== "viewer") return;

    if (retryTimeoutRef.current) {
      window.clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    console.log(`[WebRTC] Initiating viewer connection → device: ${deviceId}`);
    setConnectionState("connecting");
    setIsConnected(false);

    // Close stale connections
    pcsRef.current.forEach((pc) => pc.close());
    pcsRef.current.clear();
    dataChannelsRef.current.clear();
    pendingCandidatesRef.current.clear();
    isNegotiatingRef.current.clear();

    try {
      const pc = createPeerConnection("camera");

      // Declare we want to receive video and send+receive audio
      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "sendrecv" });

      // Create the bi-directional data channel (viewer always creates it)
      const dc = pc.createDataChannel("hguard-channel", { ordered: true });
      dataChannelsRef.current.set("camera", dc);

      dc.onopen = () => console.log("[WebRTC] Data channel OPEN");
      dc.onclose = () => console.warn("[WebRTC] Data channel CLOSED");
      dc.onerror = (e) => console.error("[WebRTC] Data channel ERROR:", e);
      dc.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          callbacksRef.current.onDataMessage?.(data);
        } catch (err) {
          console.error("[WebRTC] Error parsing data channel message:", err);
        }
      };

      // onnegotiationneeded will fire and create the offer automatically
      // But we also manually create one to ensure it fires
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log(`[Signaling] → offer (broadcast to camera role)`);
      sendSignal({ type: "offer", payload: offer, from: myId });

      // Auto-retry if no connection in 20 seconds
      retryTimeoutRef.current = window.setTimeout(() => {
        const anyConnected = Array.from(pcsRef.current.values()).some(
          (p) => p.connectionState === "connected"
        );
        if (!anyConnected) {
          console.warn("[WebRTC] No connection after 20s — retrying...");
          connect();
        }
      }, 20000);
    } catch (e) {
      console.error("[WebRTC] Connection initiation failed:", e);
      setConnectionState("failed");
    }
  }, [role, createPeerConnection, myId, sendSignal, deviceId]);

  const disconnect = useCallback(() => {
    if (retryTimeoutRef.current) {
      window.clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    sendSignal({ type: "hangup", payload: null, from: myId });
    pcsRef.current.forEach((pc) => pc.close());
    pcsRef.current.clear();
    dataChannelsRef.current.clear();
    pendingCandidatesRef.current.clear();
    isNegotiatingRef.current.clear();
    setConnectionState("closed");
    setIsConnected(false);
  }, [myId, sendSignal]);

  // ── Sync local media tracks into existing PCs (hot-swap) ───────────────────
  useEffect(() => {
    pcsRef.current.forEach((pc, remotePeerId) => {
      if (pc.connectionState === "closed") return;
      const audioTrack = localStream?.getAudioTracks()[0];
      const videoTrack = localStream?.getVideoTracks()[0];

      pc.getTransceivers().forEach((transceiver) => {
        if (!transceiver.sender) return;
        const kind = transceiver.sender.track?.kind || transceiver.receiver.track?.kind;
        const newTrack = kind === "audio" ? audioTrack : videoTrack;

        if (newTrack && transceiver.sender.track !== newTrack) {
          console.log(`[WebRTC] Hot-swapping ${kind} track (${remotePeerId})`);
          transceiver.sender.replaceTrack(newTrack).catch((e) =>
            console.warn(`[WebRTC] replaceTrack failed:`, e)
          );
        } else if (!newTrack && role === "viewer" && kind === "audio" && transceiver.sender.track) {
          transceiver.sender.replaceTrack(null).catch(() => {});
        }
      });
    });
  }, [localStream, role]);

  // ── Cleanup on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) window.clearTimeout(retryTimeoutRef.current);
      pcsRef.current.forEach((pc) => pc.close());
    };
  }, []);

  const sendData = useCallback((data: any) => {
    let sent = false;
    const jsonStr = JSON.stringify(data);
    dataChannelsRef.current.forEach((dc, key) => {
      if (dc.readyState === "open") {
        try {
          dc.send(jsonStr);
          sent = true;
        } catch (e) {
          console.error(`[WebRTC] Send failed on channel ${key}:`, e);
        }
      }
    });
    if (!sent) {
      console.warn("[WebRTC] sendData dropped — no open channels.", data);
    }
  }, []);

  return {
    connectionState,
    isConnected,
    isChannelReady,
    connect,
    disconnect,
    sendData,
    isReceivingAudio,
  };
};
