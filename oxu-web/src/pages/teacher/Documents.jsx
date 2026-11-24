import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileText,
  Plus,
  Send,
  XCircle,
} from "lucide-react";
import client from "../../api/client.js";
import PageHeader from "../../components/PageHeader.jsx";

const TYPES = [
  ["article", "Maqola"],
  ["thesis", "TEZIS (Konferensiya materiallari)"],
  [
    "patent",
    "GUVOHNOMA (Patent, ixtiro, foydali model, sanoat namunasi va DGU)",
  ],
  ["monograph", "MONOGRAFIYA"],
  ["certificate", "AVTOREFERAT"],
  ["article", "Doktorant va ilmiy izlanuvchilar uchun"],
  ["article", "Ilmiy rahbar (maslahatchi)ligi"],
  [
    "article",
    "Maqola Web of Science, Scopus, Google Scholar yoki boshqa xalqaro bazalarda",
  ],
  ["article", "To‘garak faoliyati (ilmiy va fan to‘garaklari)"],
  ["article", "Dotsentlik yoki professorlik talabgorlari uchun"],
];
const empty = {
  type: "article",
  title: "",
  journal: "",
  venue: "",
  authorDepartment: "",
  studentCoauthored: false,
  articleKind: "",
  impactFactor: "",
  scopus: false,
  publishedAt: "",
  url: "",
  issn: "",
  pages: "",
  coauthorIds: [],
  file: null,
};
export default function Documents() {
  const [docs, setDocs] = useState([]),
    [selected, setSelected] = useState(null),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [form, setForm] = useState(empty);
  const load = () =>
    client
      .get("/documents")
      .then((r) => setDocs(r.data))
      .catch(() => setError("Hujjatlarni yuklab bo‘lmadi"));
  useEffect(() => {
    load();
  }, []);
  const set = (k) => (e) =>
    setForm({
      ...form,
      [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await client.post("/documents", form);
      setOpen(false);
      setForm(empty);
      load();
    } catch (e) {
      setError(e.response?.data?.message || "Hujjat yuborilmadi");
    } finally {
      setBusy(false);
    }
  };
  const list = selected ? docs.filter((d) => d.type === selected) : [];
  return (
    <div className="documents-page">
      <PageHeader
        eyebrow="Hujjatlar"
        title="Ilmiy-tadqiqot ishlari hujjatlari"
        subtitle="Hujjat turini tanlang, yangi hujjat yarating va tasdiqlash holatini kuzating."
      />
      {error && <div className="form-error">{error}</div>}
      {!selected ? (
        <div className="card document-catalog">
          <div className="document-catalog-head">
            <h3>Hujjatlar</h3>
            <span>Hujjat turi</span>
            <span>Hujjatlar soni</span>
            <span>Hujjat yaratish</span>
          </div>
          {TYPES.map(([type, label], i) => (
            <div className="document-catalog-row" key={`${label}-${i}`}>
              <span className="doc-index">{i + 1}</span>
              <button
                className="document-link"
                onClick={() => setSelected(type)}
              >
                {label}
              </button>
              <b className="doc-count">
                {docs.filter((d) => d.type === type).length}
              </b>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setForm({ ...empty, type });
                  setOpen(true);
                }}
              >
                <Plus size={13} /> Yangi hujjat yaratish
              </button>
            </div>
          ))}
        </div>
      ) : (
        <>
          <button className="btn btn-outline" onClick={() => setSelected(null)}>
            <ArrowLeft size={15} /> Hujjatlar ro‘yxatiga qaytish
          </button>
          <div className="card documents-list">
            <div className="documents-list-head">
              <h3>{TYPES.find((x) => x[0] === selected)?.[1] || "Maqola"}</h3>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setForm({ ...empty, type: selected });
                  setOpen(true);
                }}
              >
                <Plus size={14} /> Yangi hujjat yaratish
              </button>
            </div>
            {list.map((d) => (
              <div className="document-row" key={d._id}>
                <div>
                  <strong>{d.title}</strong>
                  <small>
                    {d.journal || d.type} ·{" "}
                    {d.authors?.map((a) => a.fullName).join(", ")}
                  </small>
                </div>
                <span className={`document-status ${d.status}`}>
                  {d.status === "approved" ? (
                    <CheckCircle2 size={14} />
                  ) : d.status === "rejected" ? (
                    <XCircle size={14} />
                  ) : (
                    <Clock3 size={14} />
                  )}{" "}
                  {d.status === "approved"
                    ? `Tasdiqlangan · ${d.awardedScore} ball`
                    : d.status === "rejected"
                      ? "Rad etilgan"
                      : "Tekshirilmoqda"}
                </span>
              </div>
            ))}
            {!list.length && <p className="empty-day">Bu turda hujjat yo‘q.</p>}
          </div>
        </>
      )}
      {open && (
        <div className="document-modal">
          <form className="card document-full-form" onSubmit={submit}>
            <div className="document-form-title">
              <h2>{form.type === "article" ? "Maqola" : form.type === "thesis" ? "Tezis" : form.type === "monograph" ? "Monografiya" : "Yangi hujjat"}</h2>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="document-form-grid">
              <label>
                Hujjat nomi
                <input
                  className="form-control"
                  required
                  minLength="8"
                  value={form.title}
                  onChange={set("title")}
                />
              </label>
              <label>
                {form.type === 'thesis' ? 'O‘tkazilgan joy (forum/seminar)' : form.type === 'monograph' ? 'Monografiya nashr joyi' : 'Nashr joyi'}
                <input className="form-control" value={form.venue} onChange={set("venue")} required={form.type === 'thesis'} />
              </label>
              <label>
                Muallifning kafedrasi
                <input className="form-control" value={form.authorDepartment} onChange={set("authorDepartment")} placeholder="Kafedra nomi" />
              </label>
              <label>
                Talaba bilan birga chiqarilganmi?
                <select className="form-control" value={form.studentCoauthored ? 'yes' : 'no'} onChange={e=>setForm({...form,studentCoauthored:e.target.value==='yes'})}><option value="no">Yo‘q</option><option value="yes">Ha</option></select>
              </label>
              <label>
                Maqola muallifi
                <input
                  className="form-control"
                  value="Joriy o‘qituvchi"
                  readOnly
                />
              </label>
              <label className="wide">
                Hammualliflar ID raqami (vergul bilan)
                <input
                  className="form-control"
                  placeholder="Ixtiyoriy: 2 ta muallif bo‘lsa ball 2 ga bo‘linadi"
                  value={form.coauthorIds.join(",")}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      coauthorIds: e.target.value
                        .split(",")
                        .map((x) => x.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </label>
              <label>
                {form.type === 'monograph' ? 'Monografiya nomlanishi' : form.type === 'thesis' ? 'Tezis mavzusi' : 'Maqola mavzusi'}
                <input
                  className="form-control"
                required={['article','thesis','monograph'].includes(form.type)}
                  value={form.title}
                  onChange={set("title")}
                />
              </label>
              <label>
                {form.type === 'monograph' ? 'Nashriyot nomi' : form.type === 'thesis' ? 'Konferensiya yoki to‘plam nomi' : 'Jurnal yoki to‘plam nomi'}
                <input
                  className="form-control"
                  required={['article','thesis','monograph'].includes(form.type)}
                  value={form.journal}
                  onChange={set("journal")}
                />
              </label>
              <label>
                Chop etilgan sana
                <input
                  type="date"
                  className="form-control"
                  value={form.publishedAt}
                  onChange={set("publishedAt")}
                />
              </label>
              <label>
                {form.type === 'thesis' ? 'Tezis turi' : form.type === 'monograph' ? 'Monografiya turi' : 'Maqola turi'}
                <select
                  className="form-control"
                  value={form.articleKind}
                  onChange={set("articleKind")}
                >
                  <option value="">Tanlang</option>
                  <option>Respublika jurnali</option>
                  <option>Xalqaro jurnal</option>
                  <option>Konferensiya</option>
                </select>
              </label>
              <label>
                Impact faktori
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className="form-control"
                  value={form.impactFactor}
                  onChange={set("impactFactor")}
                />
              </label>
              <label>
                Scopus bazasiga kiradimi?
                <select
                  className="form-control"
                  value={form.scopus ? "yes" : "no"}
                  onChange={(e) =>
                    setForm({ ...form, scopus: e.target.value === "yes" })
                  }
                >
                  <option value="no">Yo‘q</option>
                  <option value="yes">Ha</option>
                </select>
              </label>
              <label>
                Elektron nusxa (PDF)
                <input
                  type="file"
                  accept="application/pdf"
                  className="form-control"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const reader = new FileReader();
                      reader.onload = () =>
                        setForm({
                          ...form,
                          file: { name: f.name, data: reader.result },
                        });
                      reader.readAsDataURL(f);
                    }
                  }}
                />
              </label>
              <label>
                Internet sahifasi manzili
                <input
                  className="form-control"
                  placeholder="https://..."
                  value={form.url}
                  onChange={set("url")}
                />
              </label>
              <label>
                Jurnal ISSN raqami
                <input
                  className="form-control"
                  value={form.issn}
                  onChange={set("issn")}
                />
              </label>
              <label>
                Jurnal betlari
                <input
                  type="number"
                  min="1"
                  className="form-control"
                  value={form.pages}
                  onChange={set("pages")}
                />
              </label>
            </div>
            <p className="document-validation-note">
              Barcha majburiy maydonlar tekshiriladi. Admin tasdiqlamaguncha
              hujjat KPI ga qo‘shilmaydi. Maqola bali mualliflar soniga teng
              bo‘linadi.
            </p>
            <div className="document-modal-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setOpen(false)}
              >
                Bekor qilish
              </button>
              <button className="btn btn-primary" disabled={busy}>
                <Send size={15} /> {busy ? "Yuborilmoqda" : "Saqlash"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
