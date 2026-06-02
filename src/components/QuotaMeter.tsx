// © 2026 HGUARD Elite by Successpartner10. All rights reserved.
import { useEffect, useRef } from "react";
import { useQuotaTracker } from "@/hooks/useQuotaTracker";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, RefreshCw, ExternalLink, Database, Brain, Server
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface MeterBarProps {
  label: string;
  pct: number;
  used: number;
  limit: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

function MeterBar({ label, pct, used, limit, icon: Icon, color, bgColor }: MeterBarProps) {
  const barColor =
    pct >= 90 ? "bg-red-500" :
    pct >= 70 ? "bg-orange-500" :
    pct >= 50 ? "bg-yellow-500" :
    "bg-primary";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
        <div className="flex items-center gap-1.5">
          <Icon className={cn("h-3 w-3", color)} />
          <span className="text-foreground/80">{label}</span>
        </div>
        <span className={cn(pct >= 70 ? "text-orange-400" : "text-muted-foreground")}>
          {used.toLocaleString()} / {limit}
          <span className="ml-1.5 opacity-70">({pct}%)</span>
        </span>
      </div>
      <div className={cn("h-2 rounded-full overflow-hidden", bgColor)}>
        <motion.div
          className={cn("h-full rounded-full transition-all", barColor)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

export default function QuotaMeter() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const {
    writes, reads, aiCalls,
    writePct, readPct, aiPct,
    breachedThresholds, loading, refreshQuota
  } = useQuotaTracker(isAdmin);

  const notifiedRef = useRef<Set<string>>(new Set());

  // Fire toast notifications for threshold breaches — once per level per session
  useEffect(() => {
    if (!isAdmin || loading) return;

    breachedThresholds.forEach(threshold => {
      const key = `quota_${threshold}`;
      if (!notifiedRef.current.has(key)) {
        notifiedRef.current.add(key);
        const isHigh = threshold >= 70;
        toast({
          title: `⚠️ Firebase Quota at ${threshold}%`,
          description: isHigh
            ? `You are at ${threshold}% of today's free tier limits. Consider upgrading to Firebase Blaze or enabling Gemini billing.`
            : `Heads up — HGUARD has used ${threshold}% of today's Firebase free tier quota.`,
          variant: isHigh ? "destructive" : "default",
          duration: isHigh ? 12000 : 7000,
        });
      }
    });
  }, [breachedThresholds, isAdmin, loading, toast]);

  if (!isAdmin || loading) return null;

  const maxPct = Math.max(writePct, readPct, aiPct);
  const statusColor =
    maxPct >= 90 ? "border-red-500/40 bg-red-500/5" :
    maxPct >= 70 ? "border-orange-500/40 bg-orange-500/5" :
    maxPct >= 50 ? "border-yellow-500/30 bg-yellow-500/5" :
    "border-border bg-muted/20";

  const headerColor =
    maxPct >= 90 ? "text-red-400" :
    maxPct >= 70 ? "text-orange-400" :
    maxPct >= 50 ? "text-yellow-400" :
    "text-muted-foreground";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("rounded-2xl border p-4 space-y-4", statusColor)}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              "h-8 w-8 rounded-xl flex items-center justify-center",
              maxPct >= 70 ? "bg-orange-500/15 text-orange-400" :
              maxPct >= 50 ? "bg-yellow-500/15 text-yellow-400" :
              "bg-primary/10 text-primary"
            )}>
              <Database className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-foreground">Quota Monitor</p>
              <p className={cn("text-[9px] font-bold uppercase", headerColor)}>
                {maxPct >= 90 ? "⚠️ CRITICAL — Action Required" :
                 maxPct >= 70 ? "⚠️ High — Upgrade Recommended" :
                 maxPct >= 50 ? "Medium — Monitor Closely" :
                 "Normal — All Systems Within Limits"}
              </p>
            </div>
          </div>
          <button
            onClick={refreshQuota}
            className="h-7 w-7 rounded-lg bg-muted/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh quota stats"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Bars */}
        <div className="space-y-3">
          <MeterBar
            label="Firestore Writes"
            pct={writePct}
            used={writes}
            limit="20,000/day"
            icon={Server}
            color="text-primary"
            bgColor="bg-primary/10"
          />
          <MeterBar
            label="Firestore Reads"
            pct={readPct}
            used={reads}
            limit="50,000/day"
            icon={Database}
            color="text-blue-400"
            bgColor="bg-blue-500/10"
          />
          <MeterBar
            label="AI API Calls (Gemini)"
            pct={aiPct}
            used={aiCalls}
            limit="~1,500/day"
            icon={Brain}
            color="text-purple-400"
            bgColor="bg-purple-500/10"
          />
        </div>

        {/* Action row — shown when >= 50% */}
        <AnimatePresence>
          {maxPct >= 50 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="pt-2 border-t border-border/40 flex flex-col sm:flex-row gap-2"
            >
              <Button
                asChild
                size="sm"
                className={cn(
                  "h-8 text-[10px] font-black rounded-xl flex-1 gap-1.5",
                  maxPct >= 70
                    ? "bg-orange-500 hover:bg-orange-600 text-white"
                    : "bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/30"
                )}
              >
                <a href="https://console.firebase.google.com/project/_/usage" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" />
                  Upgrade Firebase to Blaze
                </a>
              </Button>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-8 text-[10px] font-black rounded-xl flex-1 gap-1.5 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
              >
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" />
                  Raise Gemini API Quota
                </a>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Threshold legend */}
        <div className="flex items-center gap-3 flex-wrap pt-1">
          {[
            { pct: 50, label: "50%", color: "bg-yellow-500" },
            { pct: 70, label: "70%", color: "bg-orange-500" },
            { pct: 90, label: "90%", color: "bg-red-500" },
          ].map(t => (
            <div key={t.pct} className="flex items-center gap-1">
              <div className={cn(
                "h-2 w-2 rounded-full",
                maxPct >= t.pct ? t.color : "bg-muted/60"
              )} />
              <span className={cn(
                "text-[9px] font-black uppercase",
                maxPct >= t.pct ? "text-foreground/70" : "text-muted-foreground/40"
              )}>
                {t.label} {maxPct >= t.pct ? "✓" : ""}
              </span>
            </div>
          ))}
          <span className="text-[9px] text-muted-foreground/40 ml-auto">Resets midnight UTC</span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
