import { useEffect, useState } from "react";
import { Building2, Plus, Trash2 } from "lucide-react";
import client from "../../api/client.js";
import PageHeader from "../../components/PageHeader.jsx";
import { useConfirm } from "../../components/ConfirmProvider.jsx";
export default function Departments() {
  const confirm = useConfirm(),
    [items, setItems] = useState([]),
    [name, setName] = useState(""),
    [code, setCode] = useState(""),
    [error, setError] = useState("");
  const load = () =>
    client
      .get("/admin/departments")
      .then((r) => setItems(r.data))
      .catch(() => setError("Kafedralarni yuklab bo‘lmadi"));
  useEffect(() => { load(); }, []);
  const add = async (e) => {
    e.preventDefault();
    try {
      await client.post("/admin/departments", { name, code });
      setName("");
      setCode("");
      load();
    } catch (e) {
      setError(e.response?.data?.message || "Kafedra qo‘shilmadi");
    }
  };
  const remove = async (d) => {
    if (
      await confirm({
        title: "Kafedrani o‘chirish?",
        message: `${d.name} kafedrasini o‘chirishni tasdiqlaysizmi?`,
        action: "O‘chirish",
        danger: true,
      })
    ) {
      try {
        await client.delete(`/admin/departments/${d._id}`);
        load();
      } catch (e) {
        setError(e.response?.data?.message || "O‘chirish mumkin emas");
      }
    }
  };
  return (
    <div>
      <PageHeader
        eyebrow="Boshqaruv"
        title="Kafedralar"
        subtitle="Kafedra yaratish, kod berish va mudirlarni biriktirish."
      />
      {error && <div className="form-error">{error}</div>}
      <div className="card department-create">
        <h3>
          <Building2 size={18} /> Yangi kafedra
        </h3>
        <form className="add-row" onSubmit={add}>
          <input
            className="form-control"
            required
            placeholder="Kafedra nomi"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="form-control"
            placeholder="Kod (ixtiyoriy)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button className="btn btn-primary">
            <Plus size={16} /> Qo‘shish
          </button>
        </form>
      </div>
      <div className="card">
        <h3>Kafedralar ro‘yxati</h3>
        {items.map((d) => (
          <div className="list-row" key={d._id}>
            <div>
              <div className="name">
                {d.name}{" "}
                {d.code && <span className="badge badge-blue">{d.code}</span>}
              </div>
              <div className="count">
                Mudir: {d.head?.fullName || "biriktirilmagan"}
              </div>
            </div>
            <button className="btn-icon" onClick={() => remove(d)}>
              <Trash2 size={15} color="#dc2626" />
            </button>
          </div>
        ))}
        {!items.length && (
          <p className="empty-day">Kafedra hali qo‘shilmagan.</p>
        )}
      </div>
    </div>
  );
}
