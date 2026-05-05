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
  getDocs,
  Timestamp,
} from "firebase/firestore";

// Free public STUN + TURN servers (open-relay.metered.ca provides free TURN)
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
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
  iceTransportPolicy: 'all',
  bundlePolicy: 'max-bundle',
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
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;
  const isNegotiatingRef = useRef<Map<string, boolean>>(new Map());
  const processedSignalsRef = useRef<Set<string>>(new Set());
  const startTimeRef = useRef<Timestamp>(Timestamp.now());

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
      await addDoc(collection(db, "signaling"), {
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
      
      // Ensure we have a stream to work with
      const stream = (event.streams && event.streams[0]) || new MediaStream([event.track]);

      if (event.track.kind === "video") {
        callbacksRef.current.onRemoteStream?.(stream);
      }

      // Camera role: play incoming audio from viewer (Talk/Broadcast)
      if (role === "camera" && event.track.kind === "audio") {
        console.log(`[WebRTC] Camera detected incoming audio track from ${remotePeerId}`);
        setIsReceivingAudio(true);
        
        let audioEl = document.getElementById(`audio-${remotePeerId}`) as HTMLAudioElement;
        if (!audioEl) {
          console.log(`[WebRTC] Creating new audio element for talk feature`);
          audioEl = document.createElement("audio");
          audioEl.id = `audio-${remotePeerId}`;
          audioEl.autoplay = true;
          (audioEl as any).playsInline = true;
          audioEl.style.display = "none";
          document.body.appendChild(audioEl);
        }
        
        audioEl.srcObject = stream;
        audioEl.play().catch((e) => {
          console.error("[WebRTC] Audio playback failed. This may require user interaction on the camera device:", e);
        });

        event.track.onunmute = () => {
          console.log("[WebRTC] Audio track unmuted (Viewer is talking)");
          setIsReceivingAudio(true);
        };
        event.track.onmute = () => {
          console.log("[WebRTC] Audio track muted (Viewer stopped talking)");
          setIsReceivingAudio(false);
        };
        event.track.onended = () => {
          console.log("[WebRTC] Audio track ended");
          setIsReceivingAudio(false);
        };
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE connection state → ${pc.iceConnectionState} (peer: ${remotePeerId})`);
      if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
        console.warn(`[WebRTC] ICE ${pc.iceConnectionState} — attempting ICE restart...`);
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
    let negotiationTimeout: any = null;
    pc.onnegotiationneeded = () => {
      if (negotiationTimeout) clearTimeout(negotiationTimeout);
      negotiationTimeout = setTimeout(async () => {
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
      }, 100);
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
            if (data.type === "HEARTBEAT") return; // Skip heartbeat messages
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
      // We also accept signals addressed to our generic role (e.g. "camera")
      if (message.to && message.to !== myId && message.to !== role) return;

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
          console.log(`[Signaling] Received offer from ${message.from}`);
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
          console.log(`[Signaling] Received answer from ${message.from}`);
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
          console.log(`[Signaling] Received ice-candidate from ${message.from}`);
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
          console.log(`[Signaling] Received hangup from ${message.from}`);
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
      collection(db, "signaling"),
      where("deviceId", "==", deviceId)
    );

    const mountTime = Date.now();

    const unsubscribe = onSnapshot(
      signalingQuery,
      { includeMetadataChanges: false },
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type !== "added") return;
          const signalId = change.doc.id;
          if (processedSignalsRef.current.has(signalId)) return;

          const data = change.doc.data() as SignalMessage & { created_at?: any };

          // Skip our own signals
          if (data.from === myId) return;

          // Stale signal guard — reject signals older than 2 minutes
          const signalTime = data.created_at?.toDate?.()?.getTime() || mountTime;
          if (signalTime < mountTime - 120000) {
            console.log(`[Signaling] Ignoring stale ${data.type} from ${data.from}`);
            return;
          }

          processedSignalsRef.current.add(signalId);
          handleSignal(data);

          // Cleanup processed signals directed at us or our role
          if (data.to === myId || data.to === role || (role === "camera" && !data.to)) {
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

    console.log(`[WebRTC] Initiating viewer connection → device: ${deviceId} (attempt ${retryCountRef.current + 1}/${MAX_RETRIES})`);
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

      dc.onopen = () => {
        console.log("[WebRTC] Data channel OPEN");
        retryCountRef.current = 0; // Reset retry counter on successful connection
      };
      dc.onclose = () => console.warn("[WebRTC] Data channel CLOSED");
      dc.onerror = (e) => console.error("[WebRTC] Data channel ERROR:", e);
      dc.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "HEARTBEAT") return; // Skip heartbeat messages
          callbacksRef.current.onDataMessage?.(data);
        } catch (err) {
          console.error("[WebRTC] Error parsing data channel message:", err);
        }
      };

      // onnegotiationneeded will fire automatically from addTransceiver above
      // and handle offer creation via the Perfect Negotiation pattern.
      // Do NOT manually create an offer here — it would cause dual-offer glare.

      // Auto-retry if no connection in 20 seconds (with max retry limit)
      retryTimeoutRef.current = window.setTimeout(() => {
        const anyConnected = Array.from(pcsRef.current.values()).some(
          (p) => p.connectionState === "connected"
        );
        if (!anyConnected) {
          retryCountRef.current += 1;
          if (retryCountRef.current >= MAX_RETRIES) {
            console.error(`[WebRTC] Max retries (${MAX_RETRIES}) reached — giving up.`);
            setConnectionState("failed");
            return;
          }
          console.warn(`[WebRTC] No connection after 20s — retry ${retryCountRef.current}/${MAX_RETRIES}...`);
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
    retryCountRef.current = 0;
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

      let needsNegotiation = false;

      pc.getTransceivers().forEach((transceiver) => {
        const kind = transceiver.sender.track?.kind || transceiver.receiver.track?.kind;
        
        if (kind === "audio") {
          if (audioTrack && transceiver.sender.track !== audioTrack) {
            console.log(`[WebRTC] Adding audio track for talk feature (${remotePeerId})`);
            if (transceiver.direction === "recvonly") {
              transceiver.direction = "sendrecv";
              needsNegotiation = true;
            }
            transceiver.sender.replaceTrack(audioTrack).catch(e => console.warn(e));
          } else if (!audioTrack && transceiver.sender.track) {
            console.log(`[WebRTC] Removing audio track (talk ended)`);
            if (transceiver.direction === "sendrecv") {
              transceiver.direction = "recvonly";
              needsNegotiation = true;
            }
            transceiver.sender.replaceTrack(null).catch(e => console.warn(e));
          }
        } else if (kind === "video") {
          if (videoTrack && transceiver.sender.track !== videoTrack) {
            transceiver.sender.replaceTrack(videoTrack).catch(e => console.warn(e));
          }
        }
      });
      
      if (needsNegotiation && role === 'viewer') {
         console.log(`[WebRTC] Explicitly triggering renegotiation for ${remotePeerId}...`);
         // We must directly call the logic because dispatchEvent may not trigger the onnegotiationneeded property
         pc.createOffer().then(offer => {
           return pc.setLocalDescription(offer).then(() => {
             sendSignal({ type: "offer", payload: offer, from: myId, to: remotePeerId });
           });
         }).catch(e => console.error("[WebRTC] Manual negotiation failed:", e));
      }
    });
  }, [localStream, role, myId, sendSignal]);


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

  // ── Data Channel Heartbeat ───────────────────────────────────────────────
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      dataChannelsRef.current.forEach((dc) => {
        if (dc.readyState === "open") {
          try {
            dc.send(JSON.stringify({ type: "HEARTBEAT", timestamp: Date.now() }));
          } catch (e) {
            console.warn("[WebRTC] Heartbeat send failed:", e);
          }
        }
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [isConnected]);

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

/**
 * Purge all stale signaling documents for a given deviceId.
 * Call this on camera mount to clear leftover signals from previous sessions.
 */
export const purgeStaleSignals = async (deviceId: string) => {
  try {
    const q = query(collection(db, "signaling"), where("deviceId", "==", deviceId));
    const snap = await getDocs(q);
    const deletes = snap.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(deletes);
    console.log(`[Signaling] Purged ${snap.size} stale signals for device ${deviceId}`);
  } catch (e) {
    console.error("[Signaling] Purge failed:", e);
  }
};
