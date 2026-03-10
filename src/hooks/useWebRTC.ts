import { useRef, useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

type SignalMessage = {
  type: "offer" | "answer" | "ice-candidate" | "hangup";
  payload: any;
  from: string;
};

interface UseWebRTCOptions {
  deviceId: string;
  role: "camera" | "viewer";
  localStream?: MediaStream | null;
  onRemoteStream?: (stream: MediaStream) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
}

export const useWebRTC = ({
  deviceId,
  role,
  localStream,
  onRemoteStream,
  onConnectionStateChange,
}: UseWebRTCOptions) => {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");
  const [isConnected, setIsConnected] = useState(false);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const peerId = useRef(`${role}-${Math.random().toString(36).slice(2, 8)}`).current;
  const signalingChannel = `webrtc-signal-${deviceId}`;

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "signal",
          payload: {
            type: "ice-candidate",
            payload: event.candidate.toJSON(),
            from: peerId,
          } as SignalMessage,
        });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams[0]) {
        onRemoteStream?.(event.streams[0]);
      }
    };

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
      setIsConnected(pc.connectionState === "connected");
      onConnectionStateChange?.(pc.connectionState);
    };

    // Add local tracks if available
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    pcRef.current = pc;
    return pc;
  }, [localStream, onRemoteStream, onConnectionStateChange, peerId]);

  const handleSignal = useCallback(
    async (message: SignalMessage) => {
      if (message.from === peerId) return; // Ignore own messages

      let pc = pcRef.current;

      switch (message.type) {
        case "offer": {
          if (role !== "camera") return; // Only cameras answer offers
          if (!pc) pc = createPeerConnection();

          await pc.setRemoteDescription(new RTCSessionDescription(message.payload));

          // Apply pending candidates
          for (const candidate of pendingCandidatesRef.current) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
          pendingCandidatesRef.current = [];

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          channelRef.current?.send({
            type: "broadcast",
            event: "signal",
            payload: {
              type: "answer",
              payload: answer,
              from: peerId,
            } as SignalMessage,
          });
          break;
        }

        case "answer": {
          if (role !== "viewer" || !pc) return;
          await pc.setRemoteDescription(new RTCSessionDescription(message.payload));

          // Apply pending candidates
          for (const candidate of pendingCandidatesRef.current) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
          pendingCandidatesRef.current = [];
          break;
        }

        case "ice-candidate": {
          if (!pc || !pc.remoteDescription) {
            pendingCandidatesRef.current.push(message.payload);
          } else {
            await pc.addIceCandidate(new RTCIceCandidate(message.payload));
          }
          break;
        }

        case "hangup": {
          pc?.close();
          pcRef.current = null;
          setConnectionState("closed");
          setIsConnected(false);
          break;
        }
      }
    },
    [role, peerId, createPeerConnection]
  );

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
        if (status === "SUBSCRIBED" && role === "camera" && localStream) {
          // Camera is ready, waiting for viewer offers
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [deviceId, signalingChannel, handleSignal, role, localStream]);

  // Viewer initiates connection by sending an offer
  const connect = useCallback(async () => {
    if (role !== "viewer") return;

    const pc = createPeerConnection();
    // Add transceiver for receiving video/audio even without local stream
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
        from: peerId,
      } as SignalMessage,
    });
  }, [role, createPeerConnection, peerId]);

  const disconnect = useCallback(() => {
    channelRef.current?.send({
      type: "broadcast",
      event: "signal",
      payload: {
        type: "hangup",
        payload: null,
        from: peerId,
      } as SignalMessage,
    });
    pcRef.current?.close();
    pcRef.current = null;
    setConnectionState("closed");
    setIsConnected(false);
  }, [peerId]);

  return {
    connectionState,
    isConnected,
    connect,
    disconnect,
  };
};
