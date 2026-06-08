import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { X, Share2, Printer, FileDown, Paperclip, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listImages, deleteImage, type ImageRow } from "@/lib/images.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/images")({
  head: () => ({ meta: [{ title: "Images — Personal OS" }] }),
  component: ImagesPage,
});

function ImagesPage() {
  const list = useServerFn(listImages);
  const del = useServerFn(deleteImage);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: images = [], isLoading } = useQuery({
    queryKey: ["images"],
    queryFn: () => list(),
    staleTime: 50 * 60 * 1000,
  });

  const [preview, setPreview] = useState<ImageRow | null>(null);

  useEffect(() => {
    const ch = supabase
      .channel("images-stream")
      .on("postgres_changes", { event: "*", schema: "public", table: "images" }, () => {
        qc.invalidateQueries({ queryKey: ["images"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const deleteMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Image deleted");
      qc.invalidateQueries({ queryKey: ["images"] });
      setPreview(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleShare = async (img: ImageRow) => {
    try {
      const res = await fetch(img.signed_url);
      const blob = await res.blob();
      const file = new File([blob], `image-${img.id}.${(img.mime_type ?? "image/jpeg").split("/")[1]}`, { type: img.mime_type ?? "image/jpeg" });
      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: img.caption ?? "Image" });
      } else if (navigator.share) {
        await navigator.share({ url: img.signed_url, title: img.caption ?? "Image" });
      } else {
        await navigator.clipboard.writeText(img.signed_url);
        toast.success("Link copied — paste into your app");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        toast.error("Couldn't share");
      }
    }
  };

  const handlePrint = (img: ImageRow) => {
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) { toast.error("Pop-up blocked"); return; }
    w.document.write(`<html><head><title>Print image</title><style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh}img{max-width:100%;max-height:100%}</style></head><body><img src="${img.signed_url}" onload="setTimeout(()=>{window.print();window.close()},100)"/></body></html>`);
    w.document.close();
  };

  const handlePdf = async (img: ImageRow) => {
    try {
      const res = await fetch(img.signed_url);
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      const dims = await new Promise<{ w: number; h: number }>((resolve) => {
        const im = new Image();
        im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight });
        im.onerror = () => resolve({ w: 800, h: 600 });
        im.src = dataUrl;
      });
      const orientation = dims.w >= dims.h ? "landscape" : "portrait";
      const pdf = new jsPDF({ orientation, unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const maxW = pageW - margin * 2;
      const maxH = pageH - margin * 2;
      const ratio = Math.min(maxW / dims.w, maxH / dims.h);
      const w = dims.w * ratio;
      const h = dims.h * ratio;
      const fmt = (img.mime_type ?? "image/jpeg").includes("png") ? "PNG" : "JPEG";
      pdf.addImage(dataUrl, fmt, (pageW - w) / 2, (pageH - h) / 2, w, h);
      pdf.save(`image-${img.id}.pdf`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF failed");
    }
  };

  const handleAttach = (img: ImageRow) => {
    try {
      const existing = JSON.parse(sessionStorage.getItem("email-attachments") || "[]") as string[];
      if (!existing.includes(img.id)) existing.push(img.id);
      sessionStorage.setItem("email-attachments", JSON.stringify(existing));
      toast.success("Attached — opening compose");
      navigate({ to: "/email" });
    } catch {
      toast.error("Couldn't attach");
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-cyan-200 to-teal-400 flex items-center justify-center">
          <ImageIcon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Images</h1>
          <p className="text-sm text-muted-foreground">Photos you send to the Telegram bot land here. Share, print, save as PDF, or attach to an email.</p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : images.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-muted-foreground">No images yet. Send a photo to your Telegram bot to see it here.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {images.map((img) => (
            <Card key={img.id} className="group relative overflow-hidden rounded-2xl p-0">
              <button
                onClick={() => setPreview(img)}
                className="block w-full aspect-square bg-muted"
                aria-label="Preview"
              >
                {img.signed_url ? (
                  <img src={img.signed_url} alt={img.caption ?? ""} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">No preview</div>
                )}
              </button>
              <button
                onClick={() => {
                  if (confirm("Delete this image?")) deleteMut.mutate(img.id);
                }}
                className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-red-500"
                aria-label="Delete"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="p-2 space-y-1.5">
                {img.caption && <p className="text-xs line-clamp-1">{img.caption}</p>}
                <p className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(img.created_at), { addSuffix: true })}
                </p>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handleShare(img)} title="Share">
                    <Share2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handlePrint(img)} title="Print">
                    <Printer className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handlePdf(img)} title="Save as PDF">
                    <FileDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handleAttach(img)} title="Attach to email">
                    <Paperclip className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {preview && (
        <div
          onClick={() => setPreview(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6"
        >
          <img src={preview.signed_url} alt={preview.caption ?? ""} className="max-w-full max-h-full rounded-lg shadow-2xl" />
          <button
            onClick={(e) => { e.stopPropagation(); setPreview(null); }}
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white text-black flex items-center justify-center"
          >
            <X className="h-5 w-5" />
          </button>
          {preview.caption && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm rounded-md px-3 py-2 max-w-lg">
              {preview.caption}
            </div>
          )}
          <div className="absolute bottom-6 right-6 text-white text-xs">
            {format(new Date(preview.created_at), "PPp")}
          </div>
        </div>
      )}
    </div>
  );
}
