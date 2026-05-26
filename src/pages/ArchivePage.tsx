import { useEffect, useState } from "react";
import { googleDrive } from "@/lib/googleDrive";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Play, 
  Trash2, 
  Download, 
  Video, 
  Clock, 
  HardDrive,
  Calendar,
  ChevronLeft,
  Loader2,
  ExternalLink,
  RefreshCcw
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Recording {
  id: string;
  name: string;
  size: string;
  createdTime: string;
}

const ArchivePage = () => {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<{ id: string, url: string } | null>(null);
  const [buffering, setBuffering] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchArchive = async () => {
    setLoading(true);
    const token = localStorage.getItem("google_drive_token");
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const folderId = await googleDrive.ensureFolder("camera files", token);
      if (folderId) {
        const files = await googleDrive.listFiles(token, folderId);
        setRecordings(files as Recording[]);
      }
    } catch (e) {
      toast({ title: "Archive Error", description: "Failed to fetch recordings.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchive();
  }, []);

  const playVideo = async (id: string) => {
    const token = localStorage.getItem("google_drive_token");
    if (!token) return;

    setBuffering(true);
    try {
      const url = await googleDrive.getFileUrl(id, token);
      if (url) {
        setSelectedVideo({ id, url });
      } else {
        toast({ title: "Playback Error", description: "Could not retrieve video stream." });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setBuffering(false);
    }
  };

  const deleteVideo = async (id: string) => {
    const token = localStorage.getItem("google_drive_token");
    if (!token) return;

    if (!confirm("Are you sure you want to delete this recording?")) return;

    try {
      const success = await googleDrive.deleteFile(id, token);
      if (success) {
        setRecordings(prev => prev.filter(r => r.id !== id));
        if (selectedVideo?.id === id) setSelectedVideo(null);
        toast({ title: "Recording Deleted" });
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete file.", variant: "destructive" });
    }
  };

  const formatSize = (bytes: string) => {
    const b = parseInt(bytes);
    if (isNaN(b)) return "N/A";
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <h1 className="text-2xl font-bold tracking-tight text-white">Events</h1>
          <Button onClick={fetchArchive} variant="ghost" size="icon" className="rounded-full text-white/70 hover:text-white hover:bg-white/10">
            <RefreshCcw className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-4">
          <div className="bg-black/40 border border-white/10 backdrop-blur-xl rounded-[2rem] overflow-hidden">
            <div className="p-0">
              <div className="p-6 border-b border-white/5 bg-white/[0.02]">
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4 text-primary" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Recent Clips</span>
                  </div>
                </div>
                
                <div className="max-h-[60vh] overflow-auto">
                  {loading ? (
                    <div className="p-12 flex flex-col items-center justify-center gap-4 opacity-40">
                      <Loader2 className="h-8 w-8 animate-spin" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Indexing Drive...</span>
                    </div>
                  ) : recordings.length === 0 ? (
                    <div className="p-12 text-center opacity-30">
                      <HardDrive className="h-12 w-12 mx-auto mb-4" />
                      <p className="text-xs font-bold uppercase tracking-widest">No Recordings Found</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {recordings.map((rec) => (
                        <div key={rec.id} className="flex flex-col gap-2 p-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                          <button
                            onClick={() => playVideo(rec.id)}
                            className="flex items-start gap-4 text-left group w-full"
                          >
                            <div className="relative h-20 w-32 bg-black/50 rounded-lg overflow-hidden border border-white/10 flex-shrink-0 group-hover:border-primary/50 transition-colors">
                              <div className="absolute inset-0 flex items-center justify-center">
                                <Play className="h-8 w-8 text-white/50 group-hover:text-primary transition-colors" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0 py-1">
                              <h3 className="text-sm font-semibold text-white truncate">{rec.name.replace('.webm', '').replace('hguard_', 'Event ')}</h3>
                              <p className="text-xs text-white/50 mt-1">{formatDate(rec.createdTime)}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className="text-[9px] border-white/10 text-white/40">{formatSize(rec.size)}</Badge>
                                <Badge variant="outline" className="text-[9px] border-primary/20 text-primary/80 bg-primary/5">Motion</Badge>
                              </div>
                            </div>
                          </button>
                          
                          {/* Expanded Player */}
                          <AnimatePresence>
                            {selectedVideo?.id === rec.id && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="w-full mt-2 rounded-xl overflow-hidden bg-black border border-white/10 relative"
                              >
                                <video src={selectedVideo.url} controls autoPlay className="w-full aspect-video" />
                                <div className="p-3 bg-white/[0.02] flex items-center justify-between border-t border-white/5">
                                  <a href={selectedVideo.url} download={rec.name} className="flex items-center gap-2 text-xs text-primary hover:underline">
                                    <Download className="h-4 w-4" /> Save to device
                                  </a>
                                  <Button size="sm" variant="ghost" onClick={() => deleteVideo(rec.id)} className="text-red-400 hover:text-red-300 hover:bg-red-400/10 h-8 px-3">
                                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                                  </Button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default ArchivePage;
