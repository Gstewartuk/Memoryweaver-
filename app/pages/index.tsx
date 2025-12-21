import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";
import Auth from "../components/Auth";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

type Child = { id: number; name: string };
type Memory = { id: number; note?: string; image_path?: string; taken_at?: string };

export default function Home({ session }: any) {
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<number | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [theme, setTheme] = useState<string>("classic");

  useEffect(() => {
    async function loadChildren() {
      const { data } = await supabase.from("children").select("*").limit(50);
      if (!data || data.length === 0) {
        const insert = await supabase.from("children").insert([{ name: "Ava" }]).select().single();
        setChildren([insert.data]);
        setSelectedChild(insert.data.id);
      } else {
        setChildren(data);
        setSelectedChild(data[0].id);
      }
    }
    loadChildren();
  }, []);

  useEffect(() => {
    if (!selectedChild) return;
    async function loadMemories() {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const res = await fetch(`/api/memories?childId=${selectedChild}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
      const json = await res.json();
      setMemories(json || []);
    }
    loadMemories();
  }, [selectedChild]);

  async function uploadMemory(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedChild) return alert("Select a child");
    const currentSession = (await supabase.auth.getSession()).data.session;
    if (!currentSession) return alert("Sign in first.");

    let imagePath: string | null = null;

    if (file) {
      const filePath = `${selectedChild}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("memories").upload(filePath, file, { upsert: false });
      if (error) {
        alert("Upload failed: " + error.message);
        return;
      }
      const publicUrl = supabase.storage.from("memories").getPublicUrl(filePath).data.publicUrl;
      imagePath = publicUrl;
    }

    await axios.post(
      "/api/memories",
      { childId: selectedChild, note, imagePath, takenAt: new Date().toISOString() },
      { headers: { Authorization: `Bearer ${currentSession.access_token}` } }
    );

    setNote("");
    setFile(null);
    const res = await fetch(`/api/memories?childId=${selectedChild}`, {
      headers: { Authorization: `Bearer ${currentSession.access_token}` }
    });
    setMemories(await res.json());
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>Memory Weaver</h1>

      <Auth />

      <div style={{ marginBottom: 16 }}>
        <label>Child: </label>
        <select value={selectedChild ?? undefined} onChange={(e) => setSelectedChild(Number(e.target.value))}>
          {children.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={uploadMemory}>
        <div>
          <input placeholder="A short note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div>
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <button type="submit">Save Memory</button>
      </form>

      <section style={{ marginTop: 24 }}>
        <h2>Memories</h2>
        {memories.length === 0 && <p>No memories yet.</p>}
        <ul>
          {memories.map((m) => (
            <li key={m.id} style={{ marginBottom: 12 }}>
              <div>{m.note}</div>
              {m.image_path && <img src={m.image_path} alt="memory" style={{ width: 180, marginTop: 8 }} />}
              <div style={{ fontSize: 12, color: "#666" }}>{m.taken_at}</div>
            </li>
          ))}
        </ul>
      </section>

      <div style={{ marginTop: 24 }}>
        <label>Theme: </label>
        <select value={theme} onChange={(e) => setTheme(e.target.value)} style={{ marginRight: 12 }}>
          <option value="classic">Classic</option>
          <option value="fairy">Fairy Tale</option>
          <option value="adventure">Adventure</option>
        </select>

        <button
          onClick={async () => {
            if (!selectedChild) return;
            const currentSession = (await supabase.auth.getSession()).data.session;
            if (!currentSession) return alert("Sign in first.");
            try {
              const res = await axios.post(
                `/api/generate?childId=${selectedChild}&interval=monthly&pdf=true&theme=${theme}`,
                {},
                { headers: { Authorization: `Bearer ${currentSession.access_token}` } }
              );
              if (res.data?.pdfUrl) {
                window.open(res.data.pdfUrl, "_blank");
              } else {
                const w = window.open();
                w?.document.write(res.data.storyHtml);
                w?.document.close();
              }
            } catch (err: any) {
              alert("Generate failed; check console");
              console.error(err);
            }
          }}
        >
          Generate & Download PDF
        </button>
      </div>
    </div>
  );
}
