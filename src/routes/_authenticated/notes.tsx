import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const notesQuery = queryOptions({
  queryKey: ["notes"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const Route = createFileRoute("/_authenticated/notes")({
  head: () => ({
    meta: [
      { title: "My notes — Private Notes" },
      { name: "description", content: "Your private notes, visible only to you." },
      { property: "og:title", content: "My notes — Private Notes" },
      { property: "og:description", content: "Your private notes, visible only to you." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(notesQuery),
  component: NotesPage,
});

type Note = { id: string; title: string; body: string };

function NotesPage() {
  const { user } = Route.useRouteContext();
  const { data: notes } = useSuspenseQuery(notesQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["notes"] });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("notes").insert({ title, body });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitle("");
      setBody("");
      refresh();
    },
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-10 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold">My notes</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <Button variant="outline" onClick={signOut}>Sign out</Button>
      </header>

      <form
        className="mb-10 flex flex-col gap-3 rounded-lg border bg-card p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) create.mutate();
        }}
      >
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea placeholder="Write something…" value={body} onChange={(e) => setBody(e.target.value)} />
        {create.error && <p className="text-sm text-destructive">{create.error.message}</p>}
        <Button type="submit" className="self-end" disabled={create.isPending || !title.trim()}>
          Add note
        </Button>
      </form>

      {notes.length === 0 ? (
        <p className="text-center text-muted-foreground">No notes yet.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {notes.map((n) => (
            <NoteItem key={n.id} note={n} onChange={refresh} />
          ))}
        </ul>
      )}
    </main>
  );
}

function NoteItem({ note, onChange }: { note: Note; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const { error } = await supabase.from("notes").update({ title, body }).eq("id", note.id);
    if (error) return setError(error.message);
    setEditing(false);
    onChange();
  }
  async function remove() {
    const { error } = await supabase.from("notes").delete().eq("id", note.id);
    if (error) return setError(error.message);
    onChange();
  }

  return (
    <li className="rounded-lg border bg-card p-5">
      {editing ? (
        <div className="flex flex-col gap-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </div>
        </div>
      ) : (
        <>
          <h2 className="font-display text-xl font-semibold">{note.title}</h2>
          {note.body && <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{note.body}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Edit</Button>
            <Button variant="ghost" size="sm" onClick={remove}>Delete</Button>
          </div>
        </>
      )}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </li>
  );
}
