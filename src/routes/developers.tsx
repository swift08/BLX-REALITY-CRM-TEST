import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDevelopers, addDeveloper, updateDeveloper } from "@/lib/queries";
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

  // File upload state
  const [newFileName, setNewFileName] = useState("");
  const [newFileCategory, setNewFileCategory] = useState<
    "brochures" | "agreements" | "pricelists" | "documents"
  >("brochures");
  const [newFileUrl, setNewFileUrl] = useState("");

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
      toast.error("Please fill in file name and URL.");
      return;
    }

    setBusy(true);
    try {
      const categoryList = selectedDev[newFileCategory] || [];
      const updatedList = [
        ...categoryList,
        {
          name: newFileName,
          url: newFileUrl,
          size: Math.floor(Math.random() * 5) + 1, // random simulated MB size
        },
      ];

      await updateDeveloper(selectedDev.id, {
        [newFileCategory]: updatedList,
      });

      // Update local state to reflect additions
      setSelectedDev((prev: any) => ({
        ...prev,
        [newFileCategory]: updatedList,
      }));

      toast.success("Document attached successfully!");
      setNewFileName("");
      setNewFileUrl("");
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
      <div className="flex flex-row items-center justify-between pb-2 flex-wrap gap-4">
        <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
          Registered builders
        </h3>
        {can(role).createDeveloper() && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Add Developer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display font-bold">Add Developer Profile</DialogTitle>
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
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dcontact">Contact Desk Info</Label>
                  <Input
                    id="dcontact"
                    placeholder="e.g. Sales Desk (+91 99999 00000)"
                    value={form.contact}
                    onChange={(e) => setForm({ ...form, contact: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dloc">Headquarters Location</Label>
                  <Input
                    id="dloc"
                    placeholder="e.g. Bangalore, Karnataka"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                  />
                </div>
                <DialogFooter className="pt-2">
                  <Button type="submit" disabled={busy}>
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
              className="border-border/60 hover:shadow-md transition-shadow relative overflow-hidden group"
            >
              <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary transform scale-y-0 group-hover:scale-y-100 transition-transform duration-250" />
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
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
        <DialogContent className="max-w-2xl bg-card rounded-xl border border-border shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold font-display text-foreground flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> {selectedDev?.name} Directory Workspace
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="profile" className="w-full mt-4">
            <TabsList className="grid w-full grid-cols-2 bg-muted p-1 rounded-lg">
              <TabsTrigger value="profile">Profile Details</TabsTrigger>
              <TabsTrigger value="documents">Files & Document Catalog</TabsTrigger>
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
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edcontact">Contact Desk Info</Label>
                  <Input
                    id="edcontact"
                    value={editForm.contact}
                    onChange={(e) => setEditForm({ ...editForm, contact: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edloc">Headquarters Location</Label>
                  <Input
                    id="edloc"
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={busy}>
                    {busy ? "Updating..." : "Save Profile Details"}
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="documents" className="space-y-4 py-4 text-left">
              {/* Document Adder Form */}
              <form
                onSubmit={handleAddFile}
                className="bg-muted/30 p-3 rounded-lg border border-border/50 grid grid-cols-12 gap-3 items-end"
              >
                <div className="col-span-12 md:col-span-4 space-y-1">
                  <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                    Document Name *
                  </Label>
                  <Input
                    required
                    placeholder="e.g. Phase 2 Price List"
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
                    <option value="agreements">Agreement</option>
                    <option value="pricelists">Price List</option>
                    <option value="documents">General Document</option>
                  </select>
                </div>
                <div className="col-span-12 md:col-span-3 space-y-1">
                  <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                    URL Link *
                  </Label>
                  <Input
                    required
                    placeholder="https://example.com/file.pdf"
                    value={newFileUrl}
                    onChange={(e) => setNewFileUrl(e.target.value)}
                    className="h-8 text-xs bg-background"
                  />
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

              {/* Roster of Files */}
              <div className="space-y-3 mt-4 max-h-60 overflow-y-auto pr-1">
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
                          className="flex items-center justify-between p-2 rounded-lg bg-card border text-xs font-medium hover:bg-muted/10"
                        >
                          <span className="flex items-center gap-2 text-foreground font-semibold">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            {f.name}{" "}
                            <span className="text-[9px] font-normal text-muted-foreground">
                              ({f.size} MB)
                            </span>
                          </span>
                          <span className="flex items-center gap-2">
                            <a
                              href={f.url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 rounded text-primary hover:bg-primary/5"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:bg-destructive/5 hover:text-destructive"
                              onClick={() => handleDeleteFile(cat, idx)}
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
