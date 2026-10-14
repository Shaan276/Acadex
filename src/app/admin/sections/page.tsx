/**
 * @page AdminSections (/admin/sections)
 * @description Superadmin CRUD for class sections (create, rename, delete) with search and emoji stripping.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Search, X } from "lucide-react";

interface Section {
  _id: string;
  name: string;
  createdAt: string;
}

// Utility to remove emojis from names and titles
const stripEmojis = (str: string) =>
  str.replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu, "").trim();

export default function ManageSectionsPage() {
  const router = useRouter();
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addName, setAddName] = useState("");

  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editSection, setEditSection] = useState<Section | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteSection, setDeleteSection] = useState<Section | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = async () => {
    try {
      const [meRes, secRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/sections"),
      ]);

      const meData = await meRes.json();
      if (!meData.user?.isSuperAdmin) {
        toast.error("Superadmin access required");
        router.replace("/admin");
        return;
      }

      const secData = await secRes.json();
      if (secRes.ok) setSections(secData.sections || []);
    } catch {
      toast.error("Failed to fetch sections");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const q = searchQuery.toLowerCase().trim();
    return sections.filter((s) => stripEmojis(s.name).toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
  }, [sections, searchQuery]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = stripEmojis(addName);
    if (!cleaned) {
      toast.error("Section name cannot be empty");
      return;
    }

    setAddLoading(true);

    try {
      const res = await fetch("/api/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cleaned }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to add section");
        return;
      }

      toast.success(`Section "${cleaned}" created!`);
      setAddName("");
      setShowAddForm(false);
      fetchData();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setAddLoading(false);
    }
  };

  const openEditDialog = (section: Section) => {
    setEditSection(section);
    setEditName(stripEmojis(section.name));
    setEditDialogOpen(true);
  };

  const handleEdit = async () => {
    if (!editSection) return;
    const cleaned = stripEmojis(editName);
    if (!cleaned) {
      toast.error("Section name cannot be empty");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch(`/api/sections/${editSection._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cleaned }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to update section");
        return;
      }

      toast.success("Section updated!");
      setEditDialogOpen(false);
      fetchData();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const openDeleteDialog = (section: Section) => {
    setDeleteSection(section);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteSection) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/sections/${deleteSection._id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to delete section");
        return;
      }

      toast.success("Section deleted!");
      setSections(sections.filter((s) => s._id !== deleteSection._id));
    } catch {
      toast.error("Something went wrong");
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDeleteSection(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sections</h1>
          <p className="text-muted-foreground">
            {sections.length} section{sections.length !== 1 ? "s" : ""} configured
          </p>
        </div>
        <Button
          className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? "Cancel" : "+ Add Section"}
        </Button>
      </div>

      {/* Add Section Form */}
      {showAddForm && (
        <Card className="rounded-2xl border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">New Section</CardTitle>
            <CardDescription>
              Add a class section (e.g. Section A, Section B, ME).
              Only super admins can manage sections.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1 w-full space-y-2">
                <Label htmlFor="sectionName">Section Name</Label>
                <Input
                  id="sectionName"
                  placeholder="e.g. Section A"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  required
                  maxLength={50}
                  className="rounded-xl"
                />
              </div>
              <Button
                type="submit"
                className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={addLoading || !addName.trim()}
              >
                {addLoading ? "Adding..." : "Add Section"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Search Input */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search sections..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 pr-9 rounded-xl"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Sections Table */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">All Sections</CardTitle>
          <CardDescription>
            Sections are class divisions (A, B, C, ME). Students and content are tagged with sections.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredSections.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {searchQuery
                ? `No sections matching "${searchQuery}"`
                : "No sections yet. Click \u201C+ Add Section\u201D to create one."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSections.map((section) => (
                    <TableRow key={section._id}>
                      <TableCell>
                        <Badge variant="outline" className="rounded-full text-sm">
                          {stripEmojis(section.name) || section.name}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(section.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-lg text-xs"
                            onClick={() => openEditDialog(section)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="rounded-lg text-xs"
                            onClick={() => openDeleteDialog(section)}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Rename Section</DialogTitle>
            <DialogDescription>
              Update the section name for &ldquo;{stripEmojis(editSection?.name || "")}&rdquo;.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Section Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="rounded-xl"
                maxLength={50}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleEdit}
              disabled={saving || !editName.trim()}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Delete Section</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{stripEmojis(deleteSection?.name || "")}&rdquo;?
              This will fail if users or content are still assigned to this section.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete Section"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
