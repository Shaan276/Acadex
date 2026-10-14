/**
 * @page AdminSubjects (/admin/subjects)
 * @description Superadmin CRUD for subjects (create, edit, delete with password confirmation) with search and stream assignment.
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, X } from "lucide-react";

interface Subject {
  _id: string;
  name: string;
  type: "theory" | "practical";
  semester: number;
}

interface StreamItem {
  _id: string;
  name: string;
  subjects: { _id: string; name: string }[];
}

export default function ManageSubjectsPage() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [streams, setStreams] = useState<StreamItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("all");

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addName, setAddName] = useState("");
  const [addType, setAddType] = useState<"theory" | "practical">("theory");
  const [addSemester, setAddSemester] = useState("");
  const [addStreamId, setAddStreamId] = useState("none");

  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editSubject, setEditSubject] = useState<Subject | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<"theory" | "practical">("theory");
  const [editSemester, setEditSemester] = useState("");
  const [editStreamId, setEditStreamId] = useState("none");
  const [editLoading, setEditLoading] = useState(false);

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteSubject, setDeleteSubject] = useState<Subject | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showTheorySubjects, setShowTheorySubjects] = useState(true);
  const [showPracticalSubjects, setShowPracticalSubjects] = useState(true);

  const fetchData = async () => {
    try {
      const [meRes, subjectsRes, streamsRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/subjects"),
        fetch("/api/streams"),
      ]);

      const meData = await meRes.json();
      if (!meData.user?.isSuperAdmin) {
        toast.error("Superadmin access required");
        router.replace("/admin");
        return;
      }

      const subjectsData = await subjectsRes.json();
      const streamsData = await streamsRes.json();

      if (subjectsRes.ok) setSubjects(subjectsData.subjects || []);
      if (streamsRes.ok) setStreams(streamsData.streams || []);
    } catch {
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Map each subject to the streams it belongs to
  const subjectStreamsMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const stream of streams) {
      for (const sub of stream.subjects || []) {
        const subId = typeof sub === "object" ? sub._id : String(sub);
        if (!map[subId]) map[subId] = [];
        map[subId].push(stream.name);
      }
    }
    return map;
  }, [streams]);

  const openEditDialog = (subject: Subject) => {
    setEditSubject(subject);
    setEditName(subject.name);
    setEditType(subject.type);
    setEditSemester(String(subject.semester));

    // Find which stream it belongs to if any
    const associatedStream = streams.find((str) =>
      str.subjects?.some(
        (s) => (typeof s === "object" ? s._id : String(s)) === subject._id
      )
    );
    setEditStreamId(associatedStream ? associatedStream._id : "none");
    setEditDialogOpen(true);
  };

  const handleEditSubject = async () => {
    if (!editSubject || !editSemester || !editName.trim()) return;
    setEditLoading(true);

    try {
      const res = await fetch(`/api/subjects/${editSubject._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          type: editType,
          semester: Number(editSemester),
          streamId: editStreamId !== "none" ? editStreamId : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to update subject");
        return;
      }

      toast.success("Subject updated successfully");
      setEditDialogOpen(false);
      setEditSubject(null);
      fetchData();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setEditLoading(false);
    }
  };

  // ─── Add Subject ────────────────────────────────
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);

    try {
      const res = await fetch("/api/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addName.trim(),
          type: addType,
          semester: Number(addSemester),
          streamId: addStreamId !== "none" ? addStreamId : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to add subject");
        return;
      }

      toast.success("Subject added successfully!");
      setAddName("");
      setAddType("theory");
      setAddSemester("");
      setAddStreamId("none");
      setShowAddForm(false);
      fetchData();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setAddLoading(false);
    }
  };

  // ─── Delete Subject ─────────────────────────────
  const openDeleteDialog = (subject: Subject) => {
    setDeleteSubject(subject);
    setDeletePassword("");
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteSubject || !deletePassword) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/subjects/${deleteSubject._id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to delete subject");
        return;
      }

      toast.success("Subject deleted!");
      setSubjects(subjects.filter((s) => s._id !== deleteSubject._id));
    } catch {
      toast.error("Something went wrong");
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDeleteSubject(null);
      setDeletePassword("");
    }
  };

  const filteredSubjects = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return subjects.filter((s) => {
      const matchesSearch = !q || s.name.toLowerCase().includes(q);
      const matchesSem =
        semesterFilter === "all" || String(s.semester) === semesterFilter;
      return matchesSearch && matchesSem;
    });
  }, [subjects, searchQuery, semesterFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const theorySubjects = filteredSubjects.filter((s) => s.type !== "practical");
  const practicalSubjects = filteredSubjects.filter((s) => s.type === "practical");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subjects</h1>
          <p className="text-muted-foreground">
            {subjects.length} subject{subjects.length !== 1 ? "s" : ""} available
          </p>
        </div>
        <Button
          className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? "Cancel" : "+ Add Subject"}
        </Button>
      </div>

      {/* Add Subject Form (collapsible) */}
      {showAddForm && (
        <Card className="rounded-2xl border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">New Subject</CardTitle>
            <CardDescription>
              Add a new subject and optionally assign it to an academic stream.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="addName">Subject Name</Label>
                  <Input
                    id="addName"
                    placeholder="e.g. Database Management Systems"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    required
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={addType}
                    onValueChange={(v) => setAddType(v as "theory" | "practical")}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="theory">Theory</SelectItem>
                      <SelectItem value="practical">Practical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Semester</Label>
                  <Select
                    value={addSemester}
                    onValueChange={setAddSemester}
                    required
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Select semester" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          Semester {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Assign to Stream</Label>
                  <Select
                    value={addStreamId}
                    onValueChange={setAddStreamId}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Select stream (optional)" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="none">None (General / Global)</SelectItem>
                      {streams.map((str) => (
                        <SelectItem key={str._id} value={str._id}>
                          {str.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                type="submit"
                className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={addLoading || !addName.trim() || !addSemester}
              >
                {addLoading ? "Adding..." : "Add Subject"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Search and Filters */}
      <Card className="rounded-2xl">
        <CardContent className="pt-5 pb-5">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search subject by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 rounded-xl text-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select value={semesterFilter} onValueChange={setSemesterFilter}>
                <SelectTrigger className="w-full sm:w-[160px] rounded-xl text-xs h-10">
                  <SelectValue placeholder="All Semesters" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">All Semesters</SelectItem>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      Semester {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subjects Groups */}
      {filteredSubjects.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              {subjects.length === 0
                ? "No subjects yet. Click \"+ Add Subject\" above to get started."
                : "No subjects match your search."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Theory Subjects */}
          {theorySubjects.length > 0 && (
            <div>
              <button
                type="button"
                className="w-full flex items-center gap-2 mb-3 text-left"
                onClick={() => setShowTheorySubjects((prev) => !prev)}
              >
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Theory Subjects
                </h3>
                <Badge variant="secondary" className="rounded-full text-xs">
                  {theorySubjects.length}
                </Badge>
                <div className="flex-1 h-px bg-border" />
              </button>
              {showTheorySubjects && (
                <Card className="rounded-2xl">
                  <CardContent className="pt-4">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            <TableHead>Subject Name</TableHead>
                            <TableHead>Semester</TableHead>
                            <TableHead>Associated Streams</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {theorySubjects.map((subject, index) => {
                            const streamNames = subjectStreamsMap[subject._id] || [];
                            return (
                              <TableRow key={subject._id}>
                                <TableCell className="text-muted-foreground text-xs font-mono">
                                  {index + 1}
                                </TableCell>
                                <TableCell className="font-medium">
                                  <Badge
                                    variant="secondary"
                                    className="rounded-full text-xs px-2.5 py-0.5"
                                  >
                                    {subject.name}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    className="rounded-full text-xs"
                                  >
                                    Semester {subject.semester}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {streamNames.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {streamNames.map((sName) => (
                                        <Badge
                                          key={sName}
                                          variant="outline"
                                          className="text-[11px] rounded-full"
                                        >
                                          {sName}
                                        </Badge>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">
                                      General
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right space-x-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="rounded-lg text-xs"
                                    onClick={() => openEditDialog(subject)}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    className="rounded-lg text-xs"
                                    onClick={() => openDeleteDialog(subject)}
                                  >
                                    Delete
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Practical Subjects */}
          {practicalSubjects.length > 0 && (
            <div>
              <button
                type="button"
                className="w-full flex items-center gap-2 mb-3 text-left"
                onClick={() => setShowPracticalSubjects((prev) => !prev)}
              >
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Practical Subjects
                </h3>
                <Badge variant="secondary" className="rounded-full text-xs">
                  {practicalSubjects.length}
                </Badge>
                <div className="flex-1 h-px bg-border" />
              </button>
              {showPracticalSubjects && (
                <Card className="rounded-2xl">
                  <CardContent className="pt-4">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            <TableHead>Subject Name</TableHead>
                            <TableHead>Semester</TableHead>
                            <TableHead>Associated Streams</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {practicalSubjects.map((subject, index) => {
                            const streamNames = subjectStreamsMap[subject._id] || [];
                            return (
                              <TableRow key={subject._id}>
                                <TableCell className="text-muted-foreground text-xs font-mono">
                                  {index + 1}
                                </TableCell>
                                <TableCell className="font-medium">
                                  <Badge
                                    variant="secondary"
                                    className="rounded-full text-xs px-2.5 py-0.5"
                                  >
                                    {subject.name}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    className="rounded-full text-xs"
                                  >
                                    Semester {subject.semester}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {streamNames.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {streamNames.map((sName) => (
                                        <Badge
                                          key={sName}
                                          variant="outline"
                                          className="text-[11px] rounded-full"
                                        >
                                          {sName}
                                        </Badge>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">
                                      General
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right space-x-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="rounded-lg text-xs"
                                    onClick={() => openEditDialog(subject)}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    className="rounded-lg text-xs"
                                    onClick={() => openDeleteDialog(subject)}
                                  >
                                    Delete
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* Edit Subject Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Subject</DialogTitle>
            <DialogDescription>
              Update the subject details, type, semester, or associated stream.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="editName">Subject Name</Label>
              <Input
                id="editName"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={editType}
                onValueChange={(v) => setEditType(v as "theory" | "practical")}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="theory">Theory</SelectItem>
                  <SelectItem value="practical">Practical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Semester</Label>
              <Select value={editSemester} onValueChange={setEditSemester}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      Semester {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Associated Stream</Label>
              <Select value={editStreamId} onValueChange={setEditStreamId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="none">None (General / Global)</SelectItem>
                  {streams.map((str) => (
                    <SelectItem key={str._id} value={str._id}>
                      {str.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleEditSubject}
              disabled={editLoading || !editName.trim() || !editSemester}
            >
              {editLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Subject Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Subject</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteSubject?.name}&rdquo;?
              This action cannot be undone. Enter your admin password to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="deletePassword">Admin Password</Label>
            <Input
              id="deletePassword"
              type="password"
              placeholder="Enter your password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeletePassword("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl"
              onClick={handleDelete}
              disabled={deleting || !deletePassword}
            >
              {deleting ? "Deleting..." : "Delete Subject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
