// © 2026 HGUARD Elite by Successpartner10. All rights reserved.
// Tracks daily Firebase quota usage and signals admin threshold warnings.

import { useEffect, useRef, useState, useCallback } from "react";
import { db } from "@/lib/firebase";
import {
  doc, getDoc, setDoc, updateDoc, increment, serverTimestamp
} from "firebase/firestore";

const FREE_TIER_DAILY_WRITES = 20_000;
const FREE_TIER_DAILY_READS  = 50_000;
const GEMINI_FREE_RPM        = 15;   // requests per minute ceiling
const GEMINI_FREE_DAILY      = 1_500; // rough daily request limit at 15rpm over 24h

const THRESHOLDS = [50, 70, 90]; // percent levels that trigger alerts

export interface QuotaState {
  writes:       number;
  reads:        number;
  aiCalls:      number;
  writePct:     number;
  readPct:      number;
  aiPct:        number;
  breachedThresholds: number[]; // which thresholds have been crossed TODAY
  loading:      boolean;
  refreshQuota: () => void;
  trackWrite:   () => void;
  trackRead:    () => void;
  trackAiCall:  () => void;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function useQuotaTracker(isAdmin: boolean): QuotaState {
  const [writes, setWrites]   = useState(0);
  const [reads, setReads]     = useState(0);
  const [aiCalls, setAiCalls] = useState(0);
  const [loading, setLoading] = useState(true);
  const [breachedThresholds, setBreached] = useState<number[]>([]);
  const notifiedRef = useRef<Set<string>>(new Set());

  const quotaDocRef = doc(db, "system_metrics", todayKey());

  const loadQuota = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const snap = await getDoc(quotaDocRef);
      if (snap.exists()) {
        const data = snap.data();
        setWrites(data.writes   || 0);
        setReads(data.reads     || 0);
        setAiCalls(data.ai_calls || 0);
      } else {
        setWrites(0); setReads(0); setAiCalls(0);
      }
    } catch (_) {
      // silently fail — quota doc may not exist yet
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  // Poll every 90 seconds to keep the dashboard fresh
  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    loadQuota();
    const interval = setInterval(loadQuota, 90_000);
    return () => clearInterval(interval);
  }, [isAdmin, loadQuota]);

  // Compute which thresholds have been newly breached
  useEffect(() => {
    const pcts = {
      writes: Math.round((writes / FREE_TIER_DAILY_WRITES) * 100),
      reads:  Math.round((reads  / FREE_TIER_DAILY_READS)  * 100),
      ai:     Math.round((aiCalls / GEMINI_FREE_DAILY)      * 100),
    };
    const maxPct = Math.max(pcts.writes, pcts.reads, pcts.ai);
    const hit = THRESHOLDS.filter(t => maxPct >= t);
    setBreached(hit);
    // track which ones have been notified this session
    hit.forEach(t => notifiedRef.current.add(String(t)));
  }, [writes, reads, aiCalls]);

  /** Increment writes count in Firestore (call after every Firestore write in the app) */
  const trackWrite = useCallback(async () => {
    try {
      await setDoc(quotaDocRef, { writes: increment(1), updated_at: serverTimestamp() }, { merge: true });
      setWrites(prev => prev + 1);
    } catch (_) {}
  }, []);

  const trackRead = useCallback(async () => {
    try {
      await setDoc(quotaDocRef, { reads: increment(1), updated_at: serverTimestamp() }, { merge: true });
      setReads(prev => prev + 1);
    } catch (_) {}
  }, []);

  const trackAiCall = useCallback(async () => {
    try {
      await setDoc(quotaDocRef, { ai_calls: increment(1), updated_at: serverTimestamp() }, { merge: true });
      setAiCalls(prev => prev + 1);
    } catch (_) {}
  }, []);

  const writePct = Math.min(100, Math.round((writes / FREE_TIER_DAILY_WRITES) * 100));
  const readPct  = Math.min(100, Math.round((reads  / FREE_TIER_DAILY_READS)  * 100));
  const aiPct    = Math.min(100, Math.round((aiCalls / GEMINI_FREE_DAILY)     * 100));

  return {
    writes, reads, aiCalls,
    writePct, readPct, aiPct,
    breachedThresholds,
    loading,
    refreshQuota: loadQuota,
    trackWrite, trackRead, trackAiCall,
  };
}
