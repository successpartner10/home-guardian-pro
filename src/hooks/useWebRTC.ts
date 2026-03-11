import { useRef, useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
  iceCandidatePoolSize: 10,
};

type SignalMessage = {
  type: "offer" | "answer" | "ice-candidate" | "ice-candidates" | "hangup";
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
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const dataChannelsRef = useRef<Map<string, RTCDataChannel>>(new Map());
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");
  const [isConnected, setIsConnected] = useState(false);
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  const myId = useRef(`${role}-${Math.random().toString(36).slice(2, 8)}`).current;
  const signalingChannel = `webrtc-signal-${deviceId}`;

  const createPeerConnection = useCallback((remotePeerId: string) => {
    console.log(`Creating peer connection for ${remotePeerId}`);
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "signal",
          payload: {
            type: "ice-candidate",
            payload: event.candidate.toJSON(),
            from: myId,
            to: remotePeerId,
          } as SignalMessage,
        });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams[0]) {
        onRemoteStream?.(event.streams[0]);

        if (role === "camera" && event.track.kind === "audio") {
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
          audioEl.play().catch(e => console.warn("Auto-play blocked:", e));
        }
      }
    };

    pc.onconnectionstatechange = () => {
      if (role === "viewer") {
        setConnectionState(pc.connectionState);
        setIsConnected(pc.connectionState === "connected");
      }
      onConnectionStateChange?.(pc.connectionState);

      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        pcsRef.current.delete(remotePeerId);
        dataChannelsRef.current.delete(remotePeerId);
      }
    };

    if (role === "camera") {
      const dc = pc.createDataChannel("ai-telemetry");
      dc.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onDataMessage?.(data);
        } catch (e) {
          console.error("Error parsing datachannel message", e);
        }
      };
      dataChannelsRef.current.set(remotePeerId, dc);
    } else {
      pc.ondatachannel = (event) => {
        const dc = event.channel;
        dc.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            onDataMessage?.(data);
          } catch (e) {
            console.error("Error parsing datachannel message", e);
          }
        };
        dataChannelsRef.current.set(remotePeerId, dc);
      };
    }

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    pcsRef.current.set(remotePeerId, pc);
    return pc;
  }, [localStream, onRemoteStream, onConnectionStateChange, myId, role, onDataMessage]);

  const handleSignal = useCallback(
    async (message: SignalMessage) => {
      if (message.from === myId) return; // Ignore own messages
      if (message.to && message.to !== myId) return; // Ignore signals not for us

      let pc = pcsRef.current.get(message.from);

      switch (message.type) {
        case "offer": {
          if (role !== "camera") return;
          if (!pc) pc = createPeerConnection(message.from);

          await pc.setRemoteDescription(new RTCSessionDescription(message.payload));

          const candidates = pendingCandidatesRef.current.get(message.from) || [];
          for (const candidate of candidates) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
          pendingCandidatesRef.current.delete(message.from);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          channelRef.current?.send({
            type: "broadcast",
            event: "signal",
            payload: {
              type: "answer",
              payload: answer,
              from: myId,
              to: message.from,
            } as SignalMessage,
          });
          break;
        }

        case "answer": {
          if (role !== "viewer" || !pc) return;
          await pc.setRemoteDescription(new RTCSessionDescription(message.payload));

          const candidates = pendingCandidatesRef.current.get(message.from) || [];
          for (const candidate of candidates) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
          pendingCandidatesRef.current.delete(message.from);
          break;
        }

        case "ice-candidate": {
          try {
            if (!pc || !pc.remoteDescription) {
              const list = pendingCandidatesRef.current.get(message.from) || [];
              list.push(message.payload);
              pendingCandidatesRef.current.set(message.from, list);
            } else {
              await pc.addIceCandidate(new RTCIceCandidate(message.payload));
            }
          } catch (e) {
            console.warn("Failed to add ICE candidate:", e);
          }
          break;
        }

        case "hangup": {
          if (pc) {
            pc.close();
            pcsRef.current.delete(message.from);
            dataChannelsRef.current.delete(message.from);
            if (role === "viewer") {
              setConnectionState("closed");
              setIsConnected(false);
            }
          }
          break;
        }
      }
    },
    [role, myId, createPeerConnection]
  );

  const [isChannelReady, setIsChannelReady] = useState(false);
  const hasInitiatedConnection = useRef(false);

  // Set up signaling channel
  useEffect(() => {
    if (!deviceId) return;

    const channel = supabase.channel(signalingChannel, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "signal" }, ({ payload }) => {
        handleSignal(payload as SignalMessage);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setIsChannelReady(true);
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      setIsChannelReady(false);
    };
  }, [deviceId, signalingChannel, handleSignal]);

  // Viewer initiates connection by sending an offer
  const connect = useCallback(async () => {
    if (role !== "viewer" || hasInitiatedConnection.current) return;
    hasInitiatedConnection.current = true;
    setConnectionState("connecting");

    try {
      const pc = createPeerConnection("camera");
      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      channelRef.current?.send({
        type: "broadcast",
        event: "signal",
        payload: {
          type: "offer",
          payload: offer,
          from: myId,
        } as SignalMessage,
      });
    } catch (e) {
      console.error("Error creating connection:", e);
      setConnectionState("failed");
      hasInitiatedConnection.current = false;
    }
  }, [role, createPeerConnection, myId]);

  const disconnect = useCallback(() => {
    channelRef.current?.send({
      type: "broadcast",
      event: "signal",
      payload: {
        type: "hangup",
        payload: null,
        from: myId,
      } as SignalMessage,
    });
    pcsRef.current.forEach(pc => pc.close());
    pcsRef.current.clear();
    dataChannelsRef.current.clear();
    setConnectionState("closed");
    setIsConnected(false);
    hasInitiatedConnection.current = false;
  }, [myId]);

  const sendData = useCallback((data: any) => {
    dataChannelsRef.current.forEach(dc => {
      if (dc.readyState === "open") {
        dc.send(JSON.stringify(data));
      }
    });
  }, []);

  return {
    connectionState,
    isConnected,
    isChannelReady,
    connect,
    disconnect,
    sendData,
  };
};
