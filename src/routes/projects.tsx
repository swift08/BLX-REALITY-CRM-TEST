import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProjects, useDevelopers, addProject, updateProject } from "@/lib/queries";
import { useAuth } from "@/hooks/use-auth";
import { can } from "@/lib/permissions";
import { toast } from "sonner";
import {
  FolderGit2,
  Plus,
  Building2,
  MapPin,
  Grid,
  Tag,
  Pencil,
  Trash2,
  Paperclip,
  FileText,
  ExternalLink,
  Image,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/projects")({
  head: () => ({ meta: [{ title: "Projects · BLX Realty CRM" }] }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const qc = useQueryClient();
  const { data: projects = [], isLoading } = useProjects();
  const { data: developers = [] } = useDevelopers();
  const { role } = useAuth();

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    developer_id: "",
    location: "",
    total_units: 100,
    available_units: 100,
    price_range: "",
  });

  // Edit / File catalog states
  const [editOpen, setEditOpen] = useState(false);
  const [selectedProj, setSelectedProj] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    developer_id: "",
    location: "",
    total_units: 100,
    available_units: 100,
    price_range: "",
  });

  // File upload state
  const [newFileName, setNewFileName] = useState("");
  const [newFileCategory, setNewFileCategory] = useState<
    "brochures" | "floor_plans" | "documents" | "gallery_images"
  >("brochures");
  const [newFileUrl, setNewFileUrl] = useState("");
  const [fileSizeMb, setFileSizeMb] = useState<number>(0);
  const [uploadedFileName, setUploadedFileName] = useState("");

  const handleLocalFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeInMb = file.size / (1024 * 1024);
    if (sizeInMb > 10) {
      toast.error("File size cannot exceed 10 MB limit.");
      return;
    }

    setFileSizeMb(Math.round(sizeInMb * 100) / 100);
    setNewFileName(file.name.split(".").slice(0, -1).join("."));
    setUploadedFileName(file.name);
    
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext || "")) {
      setNewFileCategory("gallery_images");
    } else if (["pdf"].includes(ext || "")) {
      setNewFileCategory("brochures");
    } else {
      setNewFileCategory("documents");
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setNewFileUrl(event.target.result as string);
        toast.success(`File "${file.name}" loaded successfully! Click Attach to save.`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.developer_id) {
      toast.error("Please associate a developer.");
      return;
    }
    setBusy(true);
    try {
      await addProject({
        ...form,
        total_units: Number(form.total_units),
        available_units: Number(form.available_units),
      });
      toast.success("Project added successfully!");
      qc.invalidateQueries({ queryKey: ["projects"] });
      setOpen(false);
      setForm({
        name: "",
        developer_id: "",
        location: "",
        total_units: 100,
        available_units: 100,
        price_range: "",
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to add project");
    } finally {
      setBusy(false);
    }
  };

  const handleEditOpen = (proj: any) => {
    setSelectedProj(proj);
    setEditForm({
      name: proj.name,
      developer_id: proj.developer_id,
      location: proj.location || "",
      total_units: proj.total_units || 100,
      available_units: proj.available_units || 100,
      price_range: proj.price_range || "",
    });
    setEditOpen(true);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProj) return;
    setBusy(true);
    try {
      await updateProject(selectedProj.id, {
        ...editForm,
        total_units: Number(editForm.total_units),
        available_units: Number(editForm.available_units),
      });
      toast.success("Project listing updated!");
      qc.invalidateQueries({ queryKey: ["projects"] });
      setEditOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update project listing");
    } finally {
      setBusy(false);
    }
  };

  const handleAddFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProj || !newFileName.trim() || !newFileUrl.trim()) {
      toast.error("Please fill in file name and URL.");
      return;
    }

    setBusy(true);
    try {
      let formattedUrl = newFileUrl.trim();
      if (!formattedUrl.startsWith("data:") && !/^https?:\/\//i.test(formattedUrl)) {
        formattedUrl = "https://" + formattedUrl;
      }

      const categoryList = selectedProj[newFileCategory] || [];
      const updatedList = [
        ...categoryList,
        {
          name: newFileName,
          url: formattedUrl,
          size: fileSizeMb || Math.floor(Math.random() * 8) + 1,
        },
      ];

      await updateProject(selectedProj.id, {
        [newFileCategory]: updatedList,
      });

      setSelectedProj((prev: any) => ({
        ...prev,
        [newFileCategory]: updatedList,
      }));

      toast.success("Project file attached successfully!");
      setNewFileName("");
      setNewFileUrl("");
      setUploadedFileName("");
      setFileSizeMb(0);
      qc.invalidateQueries({ queryKey: ["projects"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to catalog file");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteFile = async (category: string, idxToRemove: number) => {
    if (!selectedProj || !confirm("Are you sure you want to remove this cataloged project file?"))
      return;

    setBusy(true);
    try {
      const categoryList = selectedProj[category] || [];
      const updatedList = categoryList.filter((_: any, idx: number) => idx !== idxToRemove);

      await updateProject(selectedProj.id, {
        [category]: updatedList,
      });

      setSelectedProj((prev: any) => ({
        ...prev,
        [category]: updatedList,
      }));

      toast.success("Project file link removed.");
      qc.invalidateQueries({ queryKey: ["projects"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to delete file link");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell
      title="Projects Portfolio"
      subtitle="Catalog of active property listings, locations and price configurations"
    >
      <div className="flex flex-row items-center justify-between pb-2 flex-wrap gap-4">
        <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
          Property listings
        </h3>

        {can(role).createProject() && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Add Project
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px]">
              <DialogHeader>
                <DialogTitle className="font-display font-bold">Add Project Listing</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pname">Project Listing Name *</Label>
                  <Input
                    id="pname"
                    required
                    placeholder="e.g. Aurelia Heights"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Developer / Builder *</Label>
                  <Select
                    value={form.developer_id}
                    onValueChange={(v) => setForm({ ...form, developer_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Associate Builder" />
                    </SelectTrigger>
                    <SelectContent>
                      {developers.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ploc">Project Location</Label>
                  <Input
                    id="ploc"
                    placeholder="e.g. Koramangala, Bangalore"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="ptot">Total Units</Label>
                    <Input
                      id="ptot"
                      type="number"
                      value={form.total_units}
                      onChange={(e) => setForm({ ...form, total_units: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pavail">Available Units</Label>
                    <Input
                      id="pavail"
                      type="number"
                      value={form.available_units}
                      onChange={(e) =>
                        setForm({ ...form, available_units: Number(e.target.value) })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pprice">Price Configuration Range</Label>
                  <Input
                    id="pprice"
                    placeholder="e.g. ₹2.1 - 4.5 Cr"
                    value={form.price_range}
                    onChange={(e) => setForm({ ...form, price_range: e.target.value })}
                  />
                </div>
                <DialogFooter className="pt-2">
                  <Button type="submit" disabled={busy}>
                    {busy ? "Saving..." : "Save Listing"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading projects...</p>
        ) : projects.length === 0 ? (
          <p className="text-sm text-muted-foreground col-span-full text-center py-12">
            No project listings registered in portfolio yet.
          </p>
        ) : (
          projects.map((p) => (
            <Card
              key={p.id}
              className="border-border/60 hover:shadow-md transition-shadow relative group"
            >
              <CardHeader className="pb-3 bg-muted/10 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary/10 rounded text-primary">
                    <FolderGit2 className="h-4.5 w-4.5" />
                  </div>
                  <CardTitle className="text-sm font-bold font-display text-foreground">
                    {p.name}
                  </CardTitle>
                </div>
                {can(role).editProject() && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
                    onClick={() => handleEditOpen(p)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-5 space-y-3.5 text-xs text-left">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  <span className="font-semibold text-foreground">
                    {p.developers?.name || "Partner Builder"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{p.location || "—"}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Tag className="h-3.5 w-3.5" />
                  <span className="font-semibold text-primary">{p.price_range || "—"}</span>
                </div>

                <div className="flex items-center justify-between border-t border-dashed pt-4 mt-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                      Available Units
                    </span>
                    <span className="text-lg font-bold text-foreground mt-0.5">
                      {p.available_units ?? 0}
                    </span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                      Total Units
                    </span>
                    <span className="text-sm font-semibold text-muted-foreground mt-1">
                      {p.total_units ?? 0}
                    </span>
                  </div>
                </div>

                <div className="text-[10px] font-medium text-muted-foreground bg-muted/20 p-2 rounded flex justify-between items-center">
                  <span>Brochures/Floor Plans/Gallery:</span>
                  <span className="font-bold text-foreground">
                    {(p.brochures?.length || 0) +
                      (p.floor_plans?.length || 0) +
                      (p.documents?.length || 0) +
                      (p.gallery_images?.length || 0)}{" "}
                    files
                  </span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs font-semibold h-8 rounded-lg mt-1 gap-1.5 flex items-center justify-center border-primary/20 hover:border-primary/50 hover:bg-primary/5 text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditOpen(p);
                  }}
                >
                  <FolderGit2 className="h-3.5 w-3.5" />
                  {can(role).editProject() ? "Manage Workspace" : "View Workspace & Files"}
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Project Details Workspace Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl bg-card rounded-xl border border-border shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold font-display text-foreground flex items-center gap-2">
              <FolderGit2 className="h-5 w-5 text-primary" /> {selectedProj?.name} Portfolio
              Workspace
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="profile" className="w-full mt-4">
            <TabsList className="grid w-full grid-cols-2 bg-muted p-1 rounded-lg">
              <TabsTrigger value="profile">Listing Details</TabsTrigger>
              <TabsTrigger value="documents">Files & Visual Floor Plans</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-4 py-4 text-left">
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="epname">Project Listing Name *</Label>
                  <Input
                    id="epname"
                    required
                    disabled={!can(role).editProject()}
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Developer / Builder *</Label>
                  <Select
                    value={editForm.developer_id}
                    disabled={!can(role).editProject()}
                    onValueChange={(v) => setEditForm({ ...editForm, developer_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Associate Builder" />
                    </SelectTrigger>
                    <SelectContent>
                      {developers.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="eploc">Project Location</Label>
                  <Input
                    id="eploc"
                    disabled={!can(role).editProject()}
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="eptot">Total Units</Label>
                    <Input
                      id="eptot"
                      type="number"
                      disabled={!can(role).editProject()}
                      value={editForm.total_units}
                      onChange={(e) =>
                        setEditForm({ ...editForm, total_units: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="epavail">Available Units</Label>
                    <Input
                      id="epavail"
                      type="number"
                      disabled={!can(role).editProject()}
                      value={editForm.available_units}
                      onChange={(e) =>
                        setEditForm({ ...editForm, available_units: Number(e.target.value) })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="epprice">Price Configuration Range</Label>
                  <Input
                    id="epprice"
                    disabled={!can(role).editProject()}
                    value={editForm.price_range}
                    onChange={(e) => setEditForm({ ...editForm, price_range: e.target.value })}
                  />
                </div>
                {can(role).editProject() && (
                  <div className="flex justify-end pt-2">
                    <Button type="submit" disabled={busy}>
                      {busy ? "Updating..." : "Save Listing Details"}
                    </Button>
                  </div>
                )}
              </form>
            </TabsContent>

            <TabsContent value="documents" className="space-y-4 py-4 text-left">
              {/* Document Adder Form */}
              {can(role).editProject() && (
                <form
                  onSubmit={handleAddFile}
                  className="bg-muted/30 p-3 rounded-lg border border-border/50 grid grid-cols-12 gap-3 items-end font-sans"
                >
                  <div className="col-span-12 md:col-span-4 space-y-1">
                    <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                      File Label *
                    </Label>
                    <Input
                      required
                      placeholder="e.g. 3 BHK Typical Layout Plan"
                      value={newFileName}
                      onChange={(e) => setNewFileName(e.target.value)}
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                  <div className="col-span-12 md:col-span-3 space-y-1">
                    <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                      Category
                    </Label>
                    <select
                      value={newFileCategory}
                      onChange={(e: any) => setNewFileCategory(e.target.value)}
                      className="w-full h-8 px-2 rounded border bg-background text-xs focus:outline-none font-semibold"
                    >
                      <option value="brochures">Brochure</option>
                      <option value="floor_plans">Floor Plan</option>
                      <option value="gallery_images">Gallery Image</option>
                      <option value="documents">Project Document</option>
                    </select>
                  </div>
                  <div className="col-span-12 md:col-span-3 space-y-1">
                    <div className="flex flex-row justify-between items-center">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                        URL Link *
                      </Label>
                      <label
                        htmlFor="proj-file-upload-input"
                        className="text-[9px] font-bold text-primary hover:underline cursor-pointer flex items-center gap-0.5"
                      >
                        📎 Upload File
                      </label>
                    </div>
                    <input
                      type="file"
                      id="proj-file-upload-input"
                      className="hidden"
                      onChange={handleLocalFileUpload}
                    />
                    {uploadedFileName ? (
                      <div className="relative flex items-center justify-between h-8 px-2.5 rounded border border-input bg-card text-xs font-semibold text-emerald-500">
                        <span className="truncate pr-4 flex items-center gap-1 font-sans">
                          📎 {uploadedFileName}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setUploadedFileName("");
                            setNewFileUrl("");
                            setFileSizeMb(0);
                          }}
                          className="text-rose-500 hover:text-rose-700 font-bold ml-1 text-sm absolute right-2.5 cursor-pointer"
                          title="Remove file"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <Input
                        required
                        placeholder="https://example.com/layout.pdf"
                        value={newFileUrl}
                        onChange={(e) => setNewFileUrl(e.target.value)}
                        className="h-8 text-xs bg-background"
                      />
                    )}
                  </div>
                  <div className="col-span-12 md:col-span-2">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={busy}
                      className="w-full h-8 text-xs font-semibold gap-1"
                    >
                      <Paperclip className="h-3.5 w-3.5" /> Attach
                    </Button>
                  </div>
                </form>
              )}

              {/* Roster of Files */}
              <div className="space-y-3 mt-4 max-h-60 overflow-y-auto pr-1">
                {["brochures", "floor_plans", "gallery_images", "documents"].map((cat) => {
                  const files = selectedProj?.[cat] || [];
                  if (files.length === 0) return null;
                  return (
                    <div key={cat} className="space-y-1.5">
                      <h4 className="text-[10px] uppercase font-bold tracking-wider text-primary border-b pb-1 font-display">
                        {cat.replace("_", " ")}
                      </h4>
                      {files.map((f: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 rounded-lg bg-card border text-xs font-medium hover:bg-muted/10"
                        >
                          <span className="flex items-center gap-2 text-foreground font-semibold">
                            {cat === "gallery_images" ? (
                              <Image className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <FileText className="h-4 w-4 text-muted-foreground" />
                            )}
                            {f.name}{" "}
                            <span className="text-[9px] font-normal text-muted-foreground">
                              ({f.size} MB)
                            </span>
                          </span>
                          <span className="flex items-center gap-2">
                            <a
                              href={f.url}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const url = f.url.startsWith("http") || f.url.startsWith("data:")
                                  ? f.url
                                  : "https://" + f.url;
                                window.open(url, "_blank");
                              }}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 rounded text-primary hover:bg-primary/5 cursor-pointer"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                            {can(role).editProject() && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:bg-destructive/5 hover:text-destructive"
                                onClick={() => handleDeleteFile(cat, idx)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })}

                {!selectedProj?.brochures?.length &&
                  !selectedProj?.floor_plans?.length &&
                  !selectedProj?.gallery_images?.length &&
                  !selectedProj?.documents?.length && (
                    <p className="text-xs text-muted-foreground text-center py-6">
                      No files or floor plans cataloged under this project listing.
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
