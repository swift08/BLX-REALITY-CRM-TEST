import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useDevelopers,
  addDeveloper,
  updateDeveloper,
  uploadProjectFile,
} from "@/lib/queries";
import { useAuth } from "@/hooks/use-auth";
import { can } from "@/lib/permissions";
import { toast } from "sonner";
import {
  Building2,
  Plus,
  Phone,
  MapPin,
  ExternalLink,
  Calendar,
  Pencil,
  Trash2,
  Paperclip,
  FileText,
  Image,
  Link2,
  X,
  Download,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/developers")({
  head: () => ({ meta: [{ title: "Developers · BLX Realty CRM" }] }),
  component: DevelopersPage,
});

// ── Helpers for File Types ──────────────────────────────────────
function getFileType(url: string, name?: string): "image" | "pdf" | "external" {
  if (!url) return "external";
  if (url.startsWith("data:image/")) return "image";
  if (url.startsWith("data:application/pdf")) return "pdf";
  const lower = url.toLowerCase().split("?")[0];
  if (lower.match(/\.(png|jpg|jpeg|webp|gif|svg)$/)) return "image";
  if (lower.match(/\.pdf$/)) return "pdf";
  if (name) {
    const nameLower = name.toLowerCase();
    if (nameLower.endsWith(".pdf")) return "pdf";
    if (nameLower.match(/\.(png|jpg|jpeg|webp|gif|svg)$/)) return "image";
  }
  return "external";
}

function googleDocsViewerUrl(fileUrl: string): string {
  return `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`;
}

// ── File Preview Modal ─────────────────────────────────────────
function FilePreviewModal({
  file,
  onClose,
}: {
  file: { name: string; url: string; size: number } | null;
  onClose: () => void;
}) {
  const [pdfLoading, setPdfLoading] = useState(true);

  if (!file) return null;

  const fileType = getFileType(file.url, file.name);
  const displayUrl = file.url.startsWith("http") ? file.url : "https://" + file.url;

  const pdfViewerSrc = file.url.startsWith("data:")
    ? file.url
    : googleDocsViewerUrl(displayUrl);

  const openUploadedFile = () => {
    fetch(file.url)
      .then((r) => r.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, "_blank");
      })
      .catch(() => {
        const newTab = window.open();
        if (newTab) {
          newTab.document.write(
            `<html><head><title>${file.name}</title></head><body style="margin:0"><iframe src="${file.url}" width="100%" height="100%" style="border:none"></iframe></body></html>`,
          );
          newTab.document.close();
        }
      });
  };

  return (
    <Dialog open={!!file} onOpenChange={(open) => { if (!open) { onClose(); setPdfLoading(true); } }}>
      <DialogContent className="max-w-4xl w-full p-0 overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2 min-w-0">
            {fileType === "image" ? (
              <Image className="h-4 w-4 text-emerald-500 shrink-0" />
            ) : fileType === "pdf" ? (
              <FileText className="h-4 w-4 text-red-400 shrink-0" />
            ) : (
              <Link2 className="h-4 w-4 text-primary shrink-0" />
            )}
            <span className="font-semibold text-sm text-foreground truncate">{file.name}</span>
            <span className="text-[10px] text-muted-foreground font-medium shrink-0">
              ({file.size} MB)
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {file.url.startsWith("data:") ? (
              <>
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={openUploadedFile}>
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open File
                </Button>
                <a href={file.url} download={file.name}>
                  <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </Button>
                </a>
              </>
            ) : (
              <a href={displayUrl} target="_blank" rel="noreferrer">
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open Link
                </Button>
              </a>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { onClose(); setPdfLoading(true); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="px-5 py-2.5 bg-muted/20 border-b border-border/60 flex items-center gap-2">
          <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
            {file.url.startsWith("data:") ? "Source:" : "URL:"}
          </span>
          <span className="text-xs text-primary font-medium truncate break-all select-all">
            {file.url.startsWith("data:")
              ? `Uploaded file — ${file.name}`
              : displayUrl}
          </span>
        </div>

        <div className="relative bg-background" style={{ minHeight: "480px" }}>
          {fileType === "image" && (
            <div className="flex items-center justify-center p-4" style={{ minHeight: "480px" }}>
              <img
                src={file.url}
                alt={file.name}
                className="max-w-full max-h-[580px] object-contain rounded-lg shadow-md border border-border/40"
              />
            </div>
          )}

          {fileType === "pdf" && (
            <div className="relative" style={{ height: "580px" }}>
              {pdfLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-muted/20 z-10">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-10 w-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
                    <p className="text-xs font-semibold text-muted-foreground">Loading PDF viewer…</p>
                  </div>
                </div>
              )}
              <iframe
                key={pdfViewerSrc}
                src={pdfViewerSrc}
                title={file.name}
                className="w-full h-full border-0"
                onLoad={() => setPdfLoading(false)}
                style={{ opacity: pdfLoading ? 0 : 1, transition: "opacity 0.3s" }}
              />
            </div>
          )}

          {fileType === "external" && (
            <div className="relative" style={{ height: "580px" }}>
              <iframe
                src={displayUrl}
                title={file.name}
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation"
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────

function DevelopersPage() {
  const qc = useQueryClient();
  const { data: developers = [], isLoading } = useDevelopers();
  const { role } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    contact: "",
    location: "",
  });

  // Edit / Document catalog states
  const [editOpen, setEditOpen] = useState(false);
  const [selectedDev, setSelectedDev] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: "", contact: "", location: "" });

  // File upload & document adder states
  const [newFileName, setNewFileName] = useState("");
  const [newFileCategory, setNewFileCategory] = useState<
    "brochures" | "agreements" | "pricelists" | "documents"
  >("brochures");
  const [newFileUrl, setNewFileUrl] = useState("");
  const [fileSizeMb, setFileSizeMb] = useState<number>(0);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  // File preview modal state
  const [previewFile, setPreviewFile] = useState<{
    name: string;
    url: string;
    size: number;
  } | null>(null);

  // Upload local file to Supabase Storage
  const handleLocalFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeInMb = file.size / (1024 * 1024);
    if (sizeInMb > 50) {
      toast.error("File size cannot exceed 50 MB.");
      return;
    }

    const roundedSize = Math.round(sizeInMb * 100) / 100;
    setFileSizeMb(roundedSize);
    setUploadedFileName(file.name);
    if (!newFileName.trim()) {
      setNewFileName(file.name.split(".").slice(0, -1).join("."));
    }

    setIsUploadingFile(true);
    toast.loading(`Uploading "${file.name}"…`, { id: "dev-file-upload" });

    try {
      const base64: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const result = await uploadProjectFile(
        base64,
        file.name,
        file.type || "application/octet-stream",
        selectedDev?.id || "developer-assets",
      );

      setNewFileUrl(result.url);
      toast.success(`"${file.name}" uploaded! Click Attach to save.`, { id: "dev-file-upload" });
    } catch (err: any) {
      toast.error(err.message || "Upload failed", { id: "dev-file-upload" });
      setUploadedFileName("");
      setNewFileUrl("");
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await addDeveloper(form);
      toast.success("Developer added to catalog!");
      qc.invalidateQueries({ queryKey: ["developers"] });
      setOpen(false);
      setForm({ name: "", contact: "", location: "" });
    } catch (err: any) {
      toast.error(err.message || "Failed to add developer");
    } finally {
      setBusy(false);
    }
  };

  const handleEditOpen = (dev: any) => {
    setSelectedDev(dev);
    setEditForm({
      name: dev.name,
      contact: dev.contact || "",
      location: dev.location || "",
    });
    setNewFileName("");
    setNewFileUrl("");
    setUploadedFileName("");
    setFileSizeMb(0);
    setEditOpen(true);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDev) return;
    setBusy(true);
    try {
      await updateDeveloper(selectedDev.id, editForm);
      toast.success("Developer profile updated!");
      qc.invalidateQueries({ queryKey: ["developers"] });
      setEditOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setBusy(false);
    }
  };

  const handleAddFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDev || !newFileName.trim() || !newFileUrl.trim()) {
      toast.error("Please fill in file name and upload a file.");
      return;
    }

    setBusy(true);
    try {
      const categoryList = selectedDev[newFileCategory] || [];
      const updatedList = [
        ...categoryList,
        {
          name: newFileName.trim(),
          url: newFileUrl.trim(),
          size: fileSizeMb || 1.5,
        },
      ];

      await updateDeveloper(selectedDev.id, {
        [newFileCategory]: updatedList,
      });

      setSelectedDev((prev: any) => ({
        ...prev,
        [newFileCategory]: updatedList,
      }));

      toast.success("Document cataloged successfully!");
      setNewFileName("");
      setNewFileUrl("");
      setUploadedFileName("");
      setFileSizeMb(0);
      qc.invalidateQueries({ queryKey: ["developers"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to catalog document");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteFile = async (category: string, idxToRemove: number) => {
    if (!selectedDev || !confirm("Are you sure you want to remove this cataloged file?")) return;

    setBusy(true);
    try {
      const categoryList = selectedDev[category] || [];
      const updatedList = categoryList.filter((_: any, idx: number) => idx !== idxToRemove);

      await updateDeveloper(selectedDev.id, {
        [category]: updatedList,
      });

      setSelectedDev((prev: any) => ({
        ...prev,
        [category]: updatedList,
      }));

      toast.success("Document link removed.");
      qc.invalidateQueries({ queryKey: ["developers"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to delete file link");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell
      title="Developers Directory"
      subtitle="Consolidated database of associated real estate developers"
    >
      {/* File Preview Modal */}
      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />

      <div className="flex flex-row items-center justify-between pb-2 flex-wrap gap-4">
        <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider font-display">
          Registered builders
        </h3>
        {can(role).createDeveloper() && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 font-bold">
                <Plus className="h-4 w-4" /> Add Developer
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl p-6 border bg-card shadow-2xl">
              <DialogHeader>
                <DialogTitle className="font-display font-bold text-lg">
                  Add Developer Profile
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="dname">Developer / Builder Name *</Label>
                  <Input
                    id="dname"
                    required
                    placeholder="e.g. Prestige Estates"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dcontact">Contact Desk Info</Label>
                  <Input
                    id="dcontact"
                    placeholder="e.g. Sales Desk (+91 99999 00000)"
                    value={form.contact}
                    onChange={(e) => setForm({ ...form, contact: e.target.value })}
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dloc">Headquarters Location</Label>
                  <Input
                    id="dloc"
                    placeholder="e.g. Bangalore, Karnataka"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="h-10 rounded-xl"
                  />
                </div>
                <DialogFooter className="pt-2">
                  <Button type="submit" disabled={busy} className="rounded-xl font-bold h-10 px-6">
                    {busy ? "Saving..." : "Save Profile"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading developers...</p>
        ) : developers.length === 0 ? (
          <p className="text-sm text-muted-foreground col-span-full text-center py-12">
            No developers registered in system catalog yet.
          </p>
        ) : (
          developers.map((d) => (
            <Card
              key={d.id}
              className="border-border/60 hover:shadow-md transition-shadow relative overflow-hidden group rounded-2xl"
            >
              <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary transform scale-y-0 group-hover:scale-y-100 transition-transform duration-250" />
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-xl text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-sm font-bold font-display text-foreground">
                    {d.name}
                  </CardTitle>
                </div>
                {can(role).editDeveloper() && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
                    onClick={() => handleEditOpen(d)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-left">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  <span>{d.contact || "—"}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{d.location || "—"}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground border-t border-dashed pt-3 mt-1 justify-between flex-wrap">
                  <span className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Partnered: {new Date(d.created_at).toLocaleDateString()}</span>
                  </span>
                  <span className="text-[10px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10">
                    {(d.brochures?.length || 0) +
                      (d.agreements?.length || 0) +
                      (d.pricelists?.length || 0) +
                      (d.documents?.length || 0)}{" "}
                    Files
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit & Document Catalog Workspace Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl bg-card rounded-2xl border border-border shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold font-display text-foreground flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> {selectedDev?.name} Directory Workspace
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="profile" className="w-full mt-4">
            <TabsList className="grid w-full grid-cols-2 bg-muted p-1 rounded-xl">
              <TabsTrigger value="profile" className="rounded-lg text-xs font-bold">Profile Details</TabsTrigger>
              <TabsTrigger value="documents" className="rounded-lg text-xs font-bold">Files & Document Catalog</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-4 py-4 text-left">
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edname">Developer / Builder Name *</Label>
                  <Input
                    id="edname"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edcontact">Contact Desk Info</Label>
                  <Input
                    id="edcontact"
                    value={editForm.contact}
                    onChange={(e) => setEditForm({ ...editForm, contact: e.target.value })}
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edloc">Headquarters Location</Label>
                  <Input
                    id="edloc"
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={busy} className="rounded-xl font-bold h-10 px-6">
                    {busy ? "Updating..." : "Save Profile Details"}
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="documents" className="space-y-4 py-4 text-left">
              {/* Document Adder Form with Document Upload */}
              <form
                onSubmit={handleAddFile}
                className="bg-muted/30 p-4 rounded-2xl border border-border/60 space-y-3"
              >
                <div className="font-bold text-xs text-foreground flex items-center justify-between">
                  <span>Upload & Catalog Developer Document</span>
                  <span className="text-[10px] font-normal text-muted-foreground">
                    Max file size: 50 MB
                  </span>
                </div>

                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-12 md:col-span-6 space-y-1">
                    <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                      Document Name *
                    </Label>
                    <Input
                      required
                      placeholder="e.g. Phase 2 Price List"
                      value={newFileName}
                      onChange={(e) => setNewFileName(e.target.value)}
                      className="h-9 text-xs rounded-xl bg-background font-medium"
                    />
                  </div>

                  <div className="col-span-12 md:col-span-6 space-y-1">
                    <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                      Category Target
                    </Label>
                    <select
                      value={newFileCategory}
                      onChange={(e: any) => setNewFileCategory(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl border bg-background text-xs focus:outline-none font-semibold"
                    >
                      <option value="brochures">Brochure & Collateral</option>
                      <option value="agreements">Agreement / Contract</option>
                      <option value="pricelists">Price List</option>
                      <option value="documents">General Document</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                    Choose Local File to Upload *
                  </Label>
                  <Input
                    type="file"
                    onChange={handleLocalFileUpload}
                    disabled={isUploadingFile}
                    className="text-xs h-9 rounded-xl cursor-pointer bg-background"
                  />

                  {uploadedFileName && (
                    <div className="text-[11px] font-medium text-emerald-600 flex items-center gap-1.5 mt-1">
                      <span>✓ Uploaded: {uploadedFileName}</span>
                      <span className="text-[10px] text-muted-foreground">({fileSizeMb} MB)</span>
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  size="sm"
                  disabled={busy || isUploadingFile || !newFileUrl}
                  className="w-full h-9 text-xs font-bold gap-1.5 rounded-xl mt-1"
                >
                  <Paperclip className="h-4 w-4" />
                  {isUploadingFile
                    ? "Uploading to Storage…"
                    : busy
                      ? "Attaching…"
                      : "Attach Document to Catalog"}
                </Button>
              </form>

              {/* Roster of Cataloged Files */}
              <div className="space-y-3 mt-4 max-h-64 overflow-y-auto pr-1">
                {["brochures", "agreements", "pricelists", "documents"].map((cat) => {
                  const files = selectedDev?.[cat] || [];
                  if (files.length === 0) return null;
                  return (
                    <div key={cat} className="space-y-1.5">
                      <h4 className="text-[10px] uppercase font-bold tracking-wider text-primary border-b pb-1 font-display">
                        {cat}
                      </h4>
                      {files.map((f: any, idx: number) => (
                        <div
                          key={idx}
                          onClick={() => setPreviewFile(f)}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-card border text-xs font-medium hover:border-primary/50 transition-colors cursor-pointer group"
                        >
                          <span className="flex items-center gap-2 text-foreground font-semibold truncate">
                            <FileText className="h-4 w-4 text-primary shrink-0 group-hover:scale-110 transition-transform" />
                            <span className="truncate">{f.name}</span>
                            <span className="text-[10px] font-normal text-muted-foreground shrink-0">
                              ({f.size || 1.2} MB)
                            </span>
                          </span>
                          <span className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-primary hover:bg-primary/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewFile(f);
                              }}
                              title="Preview Document"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:bg-destructive/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteFile(cat, idx);
                              }}
                              title="Delete File"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })}

                {!selectedDev?.brochures?.length &&
                  !selectedDev?.agreements?.length &&
                  !selectedDev?.pricelists?.length &&
                  !selectedDev?.documents?.length && (
                    <p className="text-xs text-muted-foreground text-center py-6">
                      No documents cataloged under this developer profile.
                    </p>
                  )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
