import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";
import Auth from "../components/Auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
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
      try {
        const { data, error } = await supabase
          .from("memories")
          .select("*")
          .eq("child_id", selectedChild)
          .order("taken_at", { ascending: true });

        if (error) {
          console.error("Error loading memories:", error);
          setMemories([]);
          return;
        }
        setMemories((data as Memory[]) || []);
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
      const { data } = await supabase.from("memories").select("*").eq("child_id", selectedChild).order("taken_at", { ascending: true });
      setMemories((data as Memory[]) || []);
    } catch (err) {
      console.error("Failed to reload memories:", err);
    }
  }

  return (
    <div className="container">
      <div className="card">
        <div className="header">
          <div className="brand">
            <div className="logo">M</div>
            <div className="title">Memory Weaver</div>
          </div>
          <Auth />
        </div>

        <div className="grid">
          <main>
            <div className="child-select">
              <label className="small">Child</label>
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

            <form onSubmit={uploadMemory} className="controls">
              <label className="small">Note</label>
              <input
                type="text"
                placeholder="A short note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />

              <label className="small">Image</label>
              <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />

              <div>
                <button className="btn" type="submit">Save Memory</button>
              </div>
            </form>

            <section style={{ marginTop: 24 }}>
              <h2>Memories</h2>
              {memories.length === 0 && <p className="small">No memories yet.</p>}
              <ul className="memories-list">
                {memories.map((m) => (
                  <li key={(m as any).id}>
                    <div style={{ flex: 1 }}>
                      <div>{(m as any).note}</div>
                      <div className="small">{(m as any).taken_at}</div>
                    </div>
                    {(m as any).image_path && <img src={(m as any).image_path} alt="memory" />}
                  </li>
                ))}
              </ul>
            </section>
          </main>

          <aside>
            <div style={{ marginBottom: 12 }}>
              <label className="small">Theme</label>
              <select value={theme} onChange={(e) => setTheme(e.target.value)}>
                <option value="classic">Classic</option>
                <option value="fairy">Fairy Tale</option>
                <option value="adventure">Adventure</option>
              </select>
            </div>

            <div className="footer-controls">
              <button
                className="btn"
                onClick={async () => {
                  if (!selectedChild) return alert("Select a child");
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

              <button
                className="btn secondary"
                onClick={() => {
                  setNote("");
                  setFile(null);
                }}
              >
                Clear
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
