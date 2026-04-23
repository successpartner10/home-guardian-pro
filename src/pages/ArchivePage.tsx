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
  ExternalLink
} from "lucide-react";
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate("/dashboard")}
              className="rounded-full bg-white/5 border border-white/10"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tight text-white">Elite Archive</h1>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">Surveillance Repository</p>
            </div>
          </div>
          <Button onClick={fetchArchive} variant="outline" className="rounded-full border-white/10 h-10 px-6 font-bold uppercase tracking-widest text-[10px]">
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* List Section */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="bg-black/40 border-white/10 backdrop-blur-xl rounded-[2rem] overflow-hidden">
              <CardContent className="p-0">
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
                        <button
                          key={rec.id}
                          onClick={() => playVideo(rec.id)}
                          className={cn(
                            "w-full p-4 flex items-center gap-4 transition-all hover:bg-white/5 text-left group",
                            selectedVideo?.id === rec.id ? "bg-primary/10 border-l-4 border-primary" : "border-l-4 border-transparent"
                          )}
                        >
                          <div className="h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Play className={cn("h-5 w-5", selectedVideo?.id === rec.id ? "text-primary fill-primary" : "text-white/40")} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-white truncate">{rec.name}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-[9px] font-black text-white/30 uppercase flex items-center gap-1">
                                <Clock className="h-3 w-3" /> {formatDate(rec.createdTime)}
                              </span>
                              <span className="text-[9px] font-black text-white/30 uppercase">
                                {formatSize(rec.size)}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Player Section */}
          <div className="lg:col-span-8">
            <div className="relative aspect-video rounded-[3rem] overflow-hidden bg-black border-4 border-white/5 shadow-2xl group">
              <AnimatePresence mode="wait">
                {selectedVideo ? (
                  <motion.div
                    key={selectedVideo.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full w-full"
                  >
                    <video
                      src={selectedVideo.url}
                      controls
                      autoPlay
                      className="h-full w-full object-contain"
                    />
                    <div className="absolute top-6 right-6 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        size="icon" 
                        variant="destructive" 
                        onClick={() => deleteVideo(selectedVideo.id)}
                        className="rounded-full shadow-2xl"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center gap-6 bg-zinc-900/50">
                    <div className="h-24 w-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/10">
                      <Video className="h-10 w-10" />
                    </div>
                    <div className="text-center space-y-2">
                      <h3 className="text-xl font-black text-white/40 uppercase tracking-widest">Select a Recording</h3>
                      <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.4em]">Choose a file from the list to preview</p>
                    </div>
                  </div>
                )}
              </AnimatePresence>

              {buffering && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center gap-4 z-50">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <span className="text-[10px] font-black text-primary uppercase tracking-[0.5em]">Buffering Stream...</span>
                </div>
              )}
            </div>

            {selectedVideo && (
              <div className="mt-8 flex items-center justify-between p-6 bg-white/[0.03] border border-white/10 rounded-[2rem]">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-white uppercase tracking-tight">
                      {recordings.find(r => r.id === selectedVideo.id)?.name || "Recording"}
                    </h4>
                    <p className="text-xs font-bold text-white/40 uppercase tracking-widest">
                      Recorded on {formatDate(recordings.find(r => r.id === selectedVideo.id)?.createdTime || "")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                   <a 
                    href={selectedVideo.url} 
                    download={recordings.find(r => r.id === selectedVideo.id)?.name}
                    className="flex h-12 px-6 items-center gap-2 rounded-2xl bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest"
                   >
                     <Download className="h-4 w-4" /> Download
                   </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default ArchivePage;
