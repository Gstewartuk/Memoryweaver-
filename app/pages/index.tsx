import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";
import Auth from "../components/Auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Child = { id: number; name: string } | null;
type Memory = { id: number; note?: string; image_path?: string; taken_at?: string };

export default function Home({ session }: any) {
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<number | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [theme, setTheme] = useState<string>("classic");

  // Load children (only read; create default only if authenticated)
  useEffect(() => {
    async function loadChildren() {
      try {
        const { data, error } = await supabase.from("children").select("*").limit(50);
        if (error) {
          console.error("Error loading children:", error);
          setChildren([]);
          setSelectedChild(null);
          return;
        }

        if (!data || data.length === 0) {
          // If user is signed in, create an initial child for convenience.
          const user = session?.user;
          if (user) {
            const insertResp = await supabase
              .from("children")
              .insert([{ name: "Ava", user_id: user.id }])
              .select()
              .single();

            if (insertResp.error) {
              console.error("Insert child failed:", insertResp.error);
              setChildren([]);
              setSelectedChild(null);
              return;
            }

            if (insertResp.data) {
              setChildren([insertResp.data as Child]);
              setSelectedChild((insertResp.data as any).id ?? null);
            } else {
              setChildren([]);
              setSelectedChild(null);
            }
          } else {
            // Not signed in: show empty list and prompt to sign in to add children
            setChildren([]);
            setSelectedChild(null);
          }
        } else {
          setChildren(data as Child[]);
          setSelectedChild((data[0] as any)?.id ?? null);
        }
      } catch (err) {
        console.error("Unexpected error loading children:", err);
        setChildren([]);
        setSelectedChild(null);
      }
    }
    loadChildren();
  }, [session]);

  // Load memories only when a valid child is selected
  useEffect(() => {
    if (!selectedChild) {
      setMemories([]);
      return;
    }
    async function loadMemories() {
      const sessionData = await supabase.auth.getSession();
      const token = sessionData.data.session?.access_token;
      try {
        const res = await fetch(`/api/memories?childId=${selectedChild}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        });
        const json = await res.json();
        setMemories(Array.isArray(json) ? json : []);
      } catch (err) {
        console.error("Failed to load memories:", err);
        setMemories([]);
      }
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

    try {
      await axios.post(
        "/api/memories",
        { childId: selectedChild, note, imagePath, takenAt: new Date().toISOString() },
        { headers: { Authorization: `Bearer ${currentSession.access_token}` } }
      );
    } catch (err: any) {
      console.error("Save memory failed:", err);
      alert("Save failed; check console.");
      return;
    }

    setNote("");
    setFile(null);

    try {
      const res = await fetch(`/api/memories?childId=${selectedChild}`, {
        headers: { Authorization: `Bearer ${currentSession.access_token}` }
      });
      setMemories((await res.json()) || []);
    } catch (err) {
      console.error("Failed to reload memories:", err);
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>Memory Weaver</h1>

      <Auth />

      <div style={{ marginBottom: 16 }}>
        <label>Child: </label>
        <select
          value={selectedChild ?? ""}
          onChange={(e) => setSelectedChild(Number(e.target.value) || null)}
        >
          <option value="">— select —</option>
          {children
            .filter(Boolean)
            .map((c) => (
              <option key={(c as any).id} value={(c as any).id}>
                {(c as any).name}
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
            <li key={(m as any).id} style={{ marginBottom: 12 }}>
              <div>{(m as any).note}</div>
              {(m as any).image_path && <img src={(m as any).image_path} alt="memory" style={{ width: 180, marginTop: 8 }} />}
              <div style={{ fontSize: 12, color: "#666" }}>{(m as any).taken_at}</div>
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
