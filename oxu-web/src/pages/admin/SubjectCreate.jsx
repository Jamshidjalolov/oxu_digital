import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BookOpen,
  Clock,
  Paperclip,
  Save,
  X,
  UploadCloud,
  Layers,
} from "lucide-react";
import client from "../../api/client.js";
import AcademicPicker from "../../components/AcademicPicker.jsx";
import { useConfirm } from "../../components/ConfirmProvider.jsx";
const TYPES = [
  ["lecture", "Ma’ruza", "#3c7ce3"],
  ["practice", "Amaliy", "#31a275"],
  ["lab", "Laboratoriya", "#9a65d6"],
  ["experience", "Tajriba", "#e29b32"],
  ["independent", "Mustaqil ta’lim", "#df6294"],
];
export default function SubjectCreate() {
  const navigate = useNavigate(),
    confirm = useConfirm(),
    file = useRef(null);
  const [form, setForm] = useState({
    name: "",
    code: "",
    direction: "",
    course: 1,
    semester: 1,
    block: "Tasdiqlanmagan",
    description: "",
    credits: 0,
    hours: Object.fromEntries(TYPES.map(([k]) => [k, [0, 0]])),
    deliveryHours: { kunduzgi: [0, 0], sirtqi: [0, 0], kechki: [0, 0] },
    groupIds: [],
  });
  const [groups, setGroups] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [syllabus, setSyllabus] = useState(null),
    [tab, setTab] = useState(0);
  useEffect(() => {
    client
      .get("/admin/groups")
      .then((r) => setGroups(r.data))
      .catch(() => setError("Guruhlarni yuklab bo‘lmadi"));
  }, []);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const total = Object.values(form.hours).reduce(
    (sum, v) => sum + v[0] + v[1],
    0,
  );
  const creditMin = Number(form.credits || 0) * 25;
  const creditMax = Number(form.credits || 0) * 30;
  const classroom = Object.entries(form.hours).filter(([key]) => key !== "independent").reduce((sum, [, v]) => sum + v[0] + v[1], 0);
  const independent = form.hours.independent[0] + form.hours.independent[1];
  const workloadState = !form.credits ? "Kredit kiriting" : total < creditMin || total > creditMax ? `Jami ${creditMin}–${creditMax} soat bo‘lishi kerak` : "Me’yorida";
  const fillExample = () => setForm((f) => ({ ...f, name: "Axborot texnologiyalari", code: "AT1204", credits: 4, block: "Majburiy", hours: { lecture: [16, 0], practice: [30, 0], lab: [0, 0], experience: [0, 0], independent: [74, 0] }, deliveryHours: { kunduzgi: [120, 0], sirtqi: [72, 48], kechki: [80, 40] } }));
  const target = [
    "subject-basics",
    "subject-hours",
    "subject-resources",
    "subject-groups",
  ];
  const select = (i) => {
    setTab(i);
    document
      .getElementById(target[i])
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const choose = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.type !== "application/pdf" || f.size > 250000) {
      setError("250 KB gacha PDF fayl tanlang");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setSyllabus({ name: f.name, data: reader.result });
    reader.onerror = () => setError("Fayl o‘qilmadi");
    reader.readAsDataURL(f);
  };
  const save = async (e) => {
    e.preventDefault();
    if (form.credits > 0 && (total < creditMin || total > creditMax)) { setError(`Bu kredit uchun jami yuklama ${creditMin}–${creditMax} soat bo‘lishi kerak.`); setTab(1); return; }
    if (
      !(await confirm({
        title: "Yangi fan saqlansinmi?",
        message:
          "Fan ma’lumotlari va tanlangan guruhlarga biriktirish saqlanadi.",
        action: "Saqlash",
      }))
    )
      return;
    setBusy(true);
    setError("");
    try {
      await client.post("/admin/subjects", {
        ...form,
        ...(syllabus ? { syllabus } : {}),
      });
      navigate("/admin/groups-subjects");
    } catch (e) {
      setError(e.response?.data?.message || "Saqlashda xatolik");
    } finally {
      setBusy(false);
    }
  };
  const input = (k, label, required = false) => (
    <label className="subject-field">
      {label}
      {required ? " *" : ""}
      <input
        className="form-control"
        required={required}
        maxLength={k === "name" ? 160 : k === "code" ? 40 : 160}
        value={form[k]}
        onChange={(e) => set(k, e.target.value)}
      />
    </label>
  );
  return (
    <form className="subject-create" onSubmit={save}>
      <div className="subject-heading">
        <div className="subject-title-icon">
          <BookOpen />
        </div>
        <div>
          <h1>Yangi fan qo‘shish</h1>
          <p>Fan ma’lumotlari, soatlar, kredit va o‘quv resurslari.</p>
        </div>
        <div className="subject-top-actions">
          <Link className="btn btn-outline" to="/admin/groups-subjects">
            <X size={15} />
            Bekor qilish
          </Link>
          <button disabled={busy} className="btn btn-primary">
            <Save size={15} />
            {busy ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </div>
      </div>
      {error && (
        <div role="alert" className="form-error">
          {error}
        </div>
      )}
      <div className="subject-workspace">
        <section id="subject-basics" className="card">
          <div className="subject-tabs">
            {[
              "Asosiy ma’lumotlar",
              "Soatlar va kredit",
              "Sillabus",
              "Biriktirish",
            ].map((text, i) => (
              <button
                type="button"
                key={text}
                className={tab === i ? "active" : ""}
                onClick={() => select(i)}
              >
                {text}
              </button>
            ))}
          </div>
          <div className="subject-two">
            {input("name", "Fan nomi", true)}
          </div>
          <AcademicPicker
            form={form}
            onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          />
          <div className="subject-two">
            {[
              ["course", "Kurs", 6],
              ["semester", "Semestr", 12],
            ].map(([k, label, n]) => (
              <label className="subject-field" key={k}>
                {label}
                <select
                  className="form-control"
                  value={form[k]}
                  onChange={(e) => set(k, Number(e.target.value))}
                >
                  {Array.from({ length: n }, (_, i) => (
                    <option key={i} value={i + 1}>
                      {i + 1}-{label.toLowerCase()}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <label className="subject-field">
            Fan bloki
            <select
              className="form-control"
              value={form.block}
              onChange={(e) => set("block", e.target.value)}
            >
              <option>Tasdiqlanmagan</option>
              <option>Majburiy</option>
              <option>Tanlov</option>
            </select>
          </label>
          <label className="subject-field">
            Qisqacha tavsif
            <textarea
              maxLength={500}
              className="form-control"
              rows={3}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
            <small>{form.description.length} / 500</small>
          </label>
        </section>
        <section id="subject-hours" className="card">
          <h3>
            <Clock size={18} />
            Soatlar va kredit taqsimoti
          </h3>
          <table className="subject-hours">
            <thead>
              <tr>
                <th>Mashg‘ulot turi</th>
                <th>1-semestr</th>
                <th>2-semestr</th>
                <th>Jami</th>
              </tr>
            </thead>
            <tbody>
              {TYPES.map(([k, label, color]) => (
                <tr key={k}>
                  <td style={{ color }}>{label}</td>
                  {[0, 1].map((i) => (
                    <td key={i}>
                      <input
                        aria-label={`${label} ${i + 1}-semestr`}
                        type="number"
                        min={0}
                        max={2000}
                        step={1}
                        value={form.hours[k][i]}
                        onChange={(e) =>
                          set("hours", {
                            ...form.hours,
                            [k]: form.hours[k].map((v, j) =>
                              j === i ? Number(e.target.value) : v,
                            ),
                          })
                        }
                      />
                    </td>
                  ))}
                  <td>{form.hours[k][0] + form.hours[k][1]}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>Jami</th>
                {[0, 1].map((i) => (
                  <td key={i}>
                    {Object.values(form.hours).reduce(
                      (sum, v) => sum + v[i],
                      0,
                    )}
                  </td>
                ))}
                <td>{total}</td>
              </tr>
            </tfoot>
          </table>
          <h4 className="subject-subheading">Ta’lim shakli bo‘yicha soatlar</h4>
          <table className="subject-hours subject-delivery-hours">
            <thead><tr><th>Ta’lim shakli</th><th>1-semestr</th><th>2-semestr</th><th>Jami</th></tr></thead>
            <tbody>{[['kunduzgi','Kunduzgi'],['sirtqi','Sirtqi'],['kechki','Kechki']].map(([key,label])=><tr key={key}><td>{label}</td>{[0,1].map(i=><td key={i}><input type="number" min="0" max="2000" value={form.deliveryHours[key][i]} onChange={e=>set('deliveryHours',{...form.deliveryHours,[key]:form.deliveryHours[key].map((v,j)=>j===i?Number(e.target.value):v)})}/></td>)}<td>{form.deliveryHours[key][0]+form.deliveryHours[key][1]}</td></tr>)}</tbody>
          </table>
          <div className="subject-summary">
            <button type="button" className="btn btn-outline btn-sm" onClick={fillExample}>Test namunasini yuklash</button>
            <label>
              Kredit
              <input
                type="number"
                min={0}
                max={60}
                step={0.5}
                value={form.credits}
                onChange={(e) => set("credits", Number(e.target.value))}
              />
            </label>
            <div>
              <small>Umumiy yuklama</small>
              <strong>{total} soat</strong>
            </div>
            <div>
              <small>Kreditga nisbatan</small>
              <strong>
                {form.credits
                  ? `${(total / form.credits).toFixed(1)} soat`
                  : "—"}
              </strong>
            </div>
            <div><small>Auditoriya / mustaqil</small><strong>{classroom} / {independent}</strong></div>
            <div><small>Me’yor</small><strong className={workloadState === "Me’yorida" ? "workload-ok" : "workload-warn"}>{workloadState}</strong></div>
          </div>
        </section>
        <section id="subject-resources" className="card">
          <h3>
            <Paperclip size={18} />
            Sillabus va o‘quv resurslari
          </h3>
          <input
            ref={file}
            type="file"
            accept="application/pdf"
            hidden
            onChange={choose}
          />
          <button
            type="button"
            className="subject-upload"
            onClick={() => file.current.click()}
          >
            <UploadCloud size={29} />
            <span>
              <strong>{syllabus ? syllabus.name : "Sillabusni yuklang"}</strong>
              <small>PDF · 250 KB gacha</small>
            </span>
            <span className="btn btn-outline btn-sm">Fayl tanlash</span>
          </button>
          {syllabus && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setSyllabus(null)}
            >
              Faylni olib tashlash
            </button>
          )}
        </section>
        <section id="subject-groups" className="card">
          <h3>
            <Layers size={18} />
            Fan bo‘yicha biriktirish
          </h3>
          <p className="page-subtitle">
            Fan uchun tegishli guruhlarni tanlang.
          </p>
          <div className="subject-group-list">
            {groups.map((g) => (
              <label key={g._id}>
                <input
                  type="checkbox"
                  checked={form.groupIds.includes(g._id)}
                  onChange={() =>
                    set(
                      "groupIds",
                      form.groupIds.includes(g._id)
                        ? form.groupIds.filter((id) => id !== g._id)
                        : [...form.groupIds, g._id],
                    )
                  }
                />
                {g.name}
                {g.course ? ` · ${g.course}-kurs` : ""}
              </label>
            ))}
            {!groups.length && (
              <p>
                Guruhlar hali kiritilmagan.{" "}
                <Link to="/admin/groups-subjects">Guruh yaratish</Link>
              </p>
            )}
          </div>
          <span className="badge badge-blue">
            {form.groupIds.length} ta guruh tanlandi
          </span>
        </section>
      </div>
    </form>
  );
}
