import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import api from "../api";
import Header from "../components/Header";
import { subscribeRealtime } from '../realtime';
import WeekNavigator from "../components/WeekNavigator";
import {
  COLORS,
  RADIUS,
  SHADOWS,
  getWeekStart,
  toDateKey,
  addDays,
} from "../config";

const MIN_DATE = addDays(toDateKey(new Date()), 1);
const initial = {
  teacherId: "",
  subjectId: "",
  groupIds: [],
  date: MIN_DATE,
  startTime: "08:30",
  endTime: "09:50",
  pairNumber: 1,
  room: "",
  building: "",
  type: "Ma'ruza",
};
const initialAccount = {
  fullName: "",
  phone: "",
  password: "",
  role: "teacher",
  groupId: "",
  subjectIds: [],
};
const ROLE_LABELS = {
  teacher: "O'qituvchi",
  student: "Talaba",
  admin: "Admin",
};
const TABS = [
  ["users", "Hisoblar", "people-outline"],
  ["lessons", "Dars", "calendar-outline"],
  ["catalog", "Katalog", "albums-outline"],
];

function Choices({ title, items, selected, onChange, disabled = false }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{title}</Text>
      <View style={styles.choices}>
        {items.map((item) => (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{
              selected: selected.includes(item.id),
              disabled,
            }}
            disabled={disabled}
            key={item.id}
            onPress={() => onChange(item.id)}
            style={[
              styles.chip,
              selected.includes(item.id) && styles.chipActive,
            ]}
          >
            <Text
              style={[
                styles.chipText,
                selected.includes(item.id) && styles.chipTextActive,
              ]}
            >
              {item.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function AdminScreen({ section }) {
  const { logout } = useAuth();
  const [tab, setTab] = useState(section || "users");
  const [editing, setEditing] = useState(null);
  const [week, setWeek] = useState(getWeekStart());
  const [availability, setAvailability] = useState(null);
  const ask = (title, work) =>
    Platform.OS === "web"
      ? window.confirm(title) && work()
      : Alert.alert("Tasdiqlash", title, [
          { text: "Bekor qilish", style: "cancel" },
          { text: "Ha, davom etish", onPress: work },
        ]);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [form, setForm] = useState(initial);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsVersion, setSlotsVersion] = useState(0);
  const [account, setAccount] = useState(initialAccount);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [resetUser, setResetUser] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [credentialError, setCredentialError] = useState("");

  const clearCredentials = () => {
    setAccount(initialAccount);
    setCredentials(null);
    setResetUser(null);
    setNewPassword("");
    setShowPassword(false);
    setCredentialError("");
  };
  const closeCredentials = () => {
    if (!busy) clearCredentials();
  };
  const openPassword = (user) => {
    if (busy) return;
    clearCredentials();
    setResetUser(user);
  };

  const load = async () => {
    setBusy(true);
    try {
      const [u, g, s, l] = await Promise.all([
        api.get("/admin/users"),
        api.get("/admin/groups"),
        api.get("/admin/subjects"),
        api.get("/admin/lessons", { params: { weekStart: week } }),
      ]);
      setUsers(u.data);
      setGroups(g.data);
      setSubjects(s.data);
      setLessons(l.data);
    } catch (e) {
      setMessage(e.response?.data?.message || "Yuklashda xatolik");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => { load(); return subscribeRealtime(load); }, [week]);
  useEffect(() => {
    if (tab !== "lessons" || form.date < MIN_DATE) return;
    let alive = true;
    api
      .get("/admin/slot-options", {
        params: { date: form.date, pairNumber: form.pairNumber },
      })
      .then((r) => {
        if (alive) setAvailability(r.data);
      })
      .catch(() => {
        if (alive) setAvailability(null);
      });
    return () => {
      alive = false;
    };
  }, [tab, form.date, form.pairNumber, slotsVersion]);

  useEffect(() => {
    if (
      tab !== "lessons" ||
      !form.teacherId ||
      form.groupIds.length === 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(form.date) ||
      form.date < MIN_DATE
    ) {
      setSlots([]);
      setSlotsLoading(false);
      return;
    }
    let alive = true;
    setSlotsLoading(true);
    api
      .get("/admin/lesson-slots", {
        params: {
          date: form.date,
          teacherId: form.teacherId,
          groupIds: form.groupIds.join(","),
        },
      })
      .then(({ data }) => {
        if (!alive) return;
        const list = data.slots || [];
        setSlots(list);
        setForm((f) =>
          list.some((slot) => slot.pairNumber === f.pairNumber)
            ? f
            : list[0]
              ? {
                  ...f,
                  pairNumber: list[0].pairNumber,
                  startTime: list[0].startTime,
                  endTime: list[0].endTime,
                }
              : f,
        );
      })
      .catch((e) => {
        if (alive)
          setMessage(
            e.response?.data?.message || "Bo‘sh vaqtlarni yuklab bo‘lmadi",
          );
      })
      .finally(() => {
        if (alive) setSlotsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [tab, form.teacherId, form.date, form.groupIds, slotsVersion]);

  const createLesson = async () => {
    if (busy) return;
    if (
      !form.teacherId ||
      !form.subjectId ||
      form.groupIds.length === 0 ||
      !form.room.trim() ||
      !form.building.trim()
    ) {
      setMessage("O‘qituvchi, fan, guruh, xona va binoni tanlang.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date) || form.date < MIN_DATE) {
      setMessage("Darsni kamida bir kun oldin biriktirish mumkin.");
      return;
    }
    if (!slots.some((slot) => slot.pairNumber === form.pairNumber)) {
      setMessage("Bo‘sh vaqtni tanlang.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await api.post("/admin/lessons", form);
      setForm(initial);
      setMessage("Dars biriktirildi");
      await load();
    } catch (e) {
      if (e.response?.status === 409) setSlotsVersion((v) => v + 1);
      setMessage(e.response?.data?.message || "Saqlashda xatolik");
    } finally {
      setBusy(false);
    }
  };

  const action = async (work, success) => {
    setBusy(true);
    setMessage("");
    try {
      await work();
      setMessage(success);
      await load();
    } catch (e) {
      setMessage(e.response?.data?.message || "Saqlashda xatolik");
    } finally {
      setBusy(false);
    }
  };
  const createAccount = async () => {
    if (busy) return;
    if (
      !account.fullName.trim() ||
      !account.phone.trim() ||
      ((!editing || account.password) && account.password.length < 6) ||
      (account.role === "student" && !account.groupId) ||
      (account.role === "teacher" && !account.subjectIds.length)
    ) {
      setMessage(
        "F.I.Sh, telefon va kamida 6 belgili parolni kiriting. Talaba uchun guruhni tanlang.",
      );
      return;
    }
    await action(async () => {
      const { data } = await api[editing ? "put" : "post"](
        editing ? `/admin/users/${editing}` : "/admin/users",
        {
          fullName: account.fullName.trim(),
          phone: account.phone.trim(),
          ...(account.password ? { password: account.password } : {}),
          role: account.role,
          ...(account.role === "teacher"
            ? { subjectIds: account.subjectIds }
            : {}),
          ...(account.role === "student" ? { groupId: account.groupId } : {}),
        },
      );
      if (account.password)
        setCredentials({
          fullName: data.fullName,
          phone: data.phone,
          password: account.password,
        });
      setEditing(null);
      setShowPassword(false);
      setAccount(initialAccount);
    }, "Hisob yaratildi. Foydalanuvchi telefon va paroli bilan kirishi mumkin.");
  };
  const savePassword = async () => {
    if (busy || !resetUser) return;
    if (Array.from(newPassword).length < 6) {
      setCredentialError("Parol kamida 6 belgidan iborat bo‘lsin.");
      return;
    }
    setBusy(true);
    setCredentialError("");
    try {
      const { data } = await api.put(`/admin/users/${resetUser._id}`, {
        password: newPassword,
      });
      setCredentials({
        fullName: data.fullName,
        phone: data.phone,
        password: newPassword,
      });
      setResetUser(null);
      setNewPassword("");
      setShowPassword(false);
    } catch (e) {
      setCredentialError(
        e.response?.data?.message || "Parolni saqlashda xatolik",
      );
    } finally {
      setBusy(false);
    }
  };
  const field = (key, label, placeholder) => (
    <View style={styles.field} key={key}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={String(form[key])}
        placeholder={placeholder}
        placeholderTextColor={COLORS.gray}
        onChangeText={(value) =>
          setForm({
            ...form,
            [key]: key === "pairNumber" ? Number(value) : value,
          })
        }
      />
    </View>
  );
  const counts = [
    { icon: "people-outline", label: "Foydalanuvchilar", value: users.length },
    {
      icon: "time-outline",
      label: "Tasdiq kutilmoqda",
      value: users.filter((u) => !u.approved).length,
    },
    {
      icon: "calendar-outline",
      label: "Haftalik darslar",
      value: lessons.length,
    },
  ];
  const dateTooEarly =
    /^\d{4}-\d{2}-\d{2}$/.test(form.date) && form.date < MIN_DATE;
  const filteredUsers = users.filter((u) =>
    `${u.fullName} ${u.phone}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <View style={styles.screen}>
      <Header />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.stats}>
          {counts.map((s) => (
            <View key={s.label} style={styles.stat}>
              <View style={styles.statIcon}>
                <Ionicons name={s.icon} color={COLORS.primary} size={19} />
              </View>
              <Text style={styles.value}>{s.value}</Text>
              <Text style={styles.small} numberOfLines={2}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>

        <View style={[styles.tabs, section && { display: "none" }]}>
          {TABS.map(([key, title, icon]) => (
            <TouchableOpacity
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected: tab === key }}
              disabled={busy}
              activeOpacity={0.85}
              style={[styles.tab, tab === key && styles.tabActive]}
              onPress={() => {
                clearCredentials();
                setTab(key);
              }}
            >
              <Ionicons
                name={icon}
                size={16}
                color={tab === key ? "#ffffff" : COLORS.muted}
              />
              <Text
                style={[styles.tabText, tab === key && styles.tabTextActive]}
              >
                {title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {message ? (
          <Text accessibilityRole="alert" style={styles.message}>
            {message}
          </Text>
        ) : null}
        {busy ? (
          <ActivityIndicator color={COLORS.primary} style={{ margin: 10 }} />
        ) : null}

        {tab === "users" && (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.cardIcon}>
                <Ionicons
                  name="person-add-outline"
                  size={16}
                  color={COLORS.primary}
                />
              </View>
              <Text style={styles.title}>
                {editing ? "Hisobni tahrirlash" : "Hisob yaratish"}
              </Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>F.I.Sh</Text>
              <TextInput
                accessibilityLabel="Yangi hisob F.I.Sh"
                placeholder="F.I.Sh"
                placeholderTextColor={COLORS.gray}
                style={styles.input}
                value={account.fullName}
                editable={!busy}
                onChangeText={(fullName) =>
                  setAccount((current) => ({ ...current, fullName }))
                }
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Login (telefon)</Text>
              <TextInput
                accessibilityLabel="Yangi hisob telefon raqami"
                placeholder="901234567"
                placeholderTextColor={COLORS.gray}
                style={styles.input}
                keyboardType="phone-pad"
                value={account.phone}
                editable={!busy}
                onChangeText={(phone) =>
                  setAccount((current) => ({ ...current, phone }))
                }
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Parol</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  accessibilityLabel="Yangi hisob paroli"
                  placeholder="Kamida 6 belgi"
                  placeholderTextColor={COLORS.gray}
                  style={[styles.input, { flex: 1 }]}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={account.password}
                  editable={!busy}
                  onChangeText={(password) =>
                    setAccount((current) => ({ ...current, password }))
                  }
                />
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword ? "Parolni yashirish" : "Parolni ko‘rsatish"
                  }
                  disabled={busy}
                  style={styles.iconBtn}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={COLORS.primary}
                  />
                </TouchableOpacity>
              </View>
            </View>
            <Choices
              title="Rol"
              items={[
                { id: "teacher", name: "O‘qituvchi" },
                { id: "student", name: "Talaba" },
                { id: "admin", name: "Admin" },
              ]}
              selected={[account.role]}
              disabled={busy}
              onChange={(role) =>
                setAccount((current) => ({ ...current, role, groupId: "" }))
              }
            />
            {account.role === "student" && (
              <Choices
                title="Guruh"
                items={groups.map((g) => ({ id: g._id, name: g.name }))}
                selected={[account.groupId]}
                disabled={busy}
                onChange={(groupId) =>
                  setAccount((current) => ({ ...current, groupId }))
                }
              />
            )}
            {account.role === "teacher" && (
              <Choices
                title="Biriktirilgan fanlar (majburiy)"
                items={subjects.map((s) => ({ id: s._id, name: s.name }))}
                selected={account.subjectIds}
                onChange={(id) =>
                  setAccount((a) => ({
                    ...a,
                    subjectIds: a.subjectIds.includes(id)
                      ? a.subjectIds.filter((s) => s !== id)
                      : [...a.subjectIds, id],
                  }))
                }
              />
            )}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Hisob yaratish"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              activeOpacity={0.85}
              style={styles.button}
              onPress={() =>
                ask("Hisob ma’lumotlari saqlansinmi?", createAccount)
              }
            >
              <Ionicons name="add-circle-outline" size={18} color="#ffffff" />
              <Text style={styles.buttonText}>
                {editing ? "Saqlash" : "Hisob yaratish"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {tab === "users" && (
          <>
            <Text style={styles.hintText}>
              Login — telefon raqami. Eski parollar ochilmaydi; yangi parolni
              «Login / parol» orqali belgilang.
            </Text>
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={17} color={COLORS.muted} />
              <TextInput
                placeholder="F.I.Sh yoki telefon bo‘yicha qidirish"
                placeholderTextColor={COLORS.gray}
                value={query}
                onChangeText={setQuery}
                style={styles.searchInput}
              />
            </View>
            {filteredUsers.map((u) => {
              const initialChar = u.fullName
                ? u.fullName.charAt(0).toUpperCase()
                : "?";
              return (
                <View style={styles.card} key={u._id}>
                  <View style={styles.userHead}>
                    <View style={styles.userAvatar}>
                      <Text style={styles.userAvatarText}>{initialChar}</Text>
                    </View>
                    <View style={styles.userBody}>
                      <TouchableOpacity
                        onPress={() =>
                          ask("Hisobni tahrirlamoqchimisiz?", () => {
                            setEditing(u._id);
                            setAccount({
                              fullName: u.fullName,
                              phone: u.phone,
                              password: "",
                              role: u.role,
                              groupId: u.group?._id || "",
                              subjectIds: (u.subjects || []).map((s) => s._id),
                            });
                          })
                        }
                      >
                        <Text style={{ color: COLORS.primary, fontSize: 11 }}>
                          ✎ Tahrirlash
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        disabled={busy}
                        onPress={() =>
                          ask(
                            "Hisob va unga bog‘langan dars/davomat butunlay o‘chadi. Davom etasizmi?",
                            () =>
                              action(
                                () => api.delete(`/admin/users/${u._id}`),
                                "Hisob o‘chirildi",
                              ),
                          )
                        }
                      >
                        <Text
                          style={{
                            color: COLORS.red,
                            fontSize: 11,
                            marginTop: 7,
                          }}
                        >
                          O‘chirish
                        </Text>
                      </TouchableOpacity>
                      <Text style={styles.userName} numberOfLines={1}>
                        {u.fullName}
                      </Text>
                      <Text style={styles.small} numberOfLines={1}>
                        {u.phone} · {ROLE_LABELS[u.role] || u.role}
                        {u.group ? ` · ${u.group.name}` : ""}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusPill,
                        {
                          backgroundColor: u.approved
                            ? COLORS.greenBg
                            : COLORS.amberBg,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: u.approved ? COLORS.green : COLORS.amber },
                        ]}
                      >
                        {u.approved ? "Tasdiqlangan" : "Kutilmoqda"}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.rowActions}>
                    {["student", "teacher"].includes(u.role) ? (
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={`${u.fullName}: login va parol`}
                        disabled={busy}
                        style={styles.outlineBtn}
                        onPress={() => openPassword(u)}
                      >
                        <Ionicons
                          name="key-outline"
                          size={15}
                          color={COLORS.primary}
                        />
                        <Text style={styles.outlineText}>Login / parol</Text>
                      </TouchableOpacity>
                    ) : null}
                    {!u.approved ? (
                      <TouchableOpacity
                        disabled={busy}
                        style={styles.smallButton}
                        onPress={() =>
                          action(
                            () =>
                              api.put(`/admin/users/${u._id}`, {
                                approved: true,
                              }),
                            "Hisob tasdiqlandi",
                          )
                        }
                      >
                        <Text style={styles.smallButtonText}>Tasdiqlash</Text>
                      </TouchableOpacity>
                    ) : null}
                    {u.role === "student" ? (
                      <TouchableOpacity
                        disabled={busy}
                        style={styles.outlineBtn}
                        onPress={() =>
                          ask(
                            "O‘qituvchi uchun fan tanlash oynasi ochilsinmi?",
                            () => {
                              setEditing(u._id);
                              setAccount({
                                fullName: u.fullName,
                                phone: u.phone,
                                password: "",
                                role: "teacher",
                                groupId: "",
                                subjectIds: [],
                              });
                            },
                          )
                        }
                      >
                        <Ionicons
                          name="school-outline"
                          size={15}
                          color={COLORS.muted}
                        />
                        <Text style={styles.outlineMuted}>
                          O‘qituvchi qilish
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              );
            })}
            {filteredUsers.length === 0 ? (
              <Text style={styles.emptyText}>Foydalanuvchi topilmadi</Text>
            ) : null}
          </>
        )}

        {tab === "lessons" && (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.cardIcon}>
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={COLORS.primary}
                />
              </View>
              <Text style={styles.title}>Yangi dars biriktirish</Text>
            </View>
            <WeekNavigator weekStart={week} onChange={setWeek} />
            <Choices
              title="O‘qituvchi"
              items={users
                .filter(
                  (u) =>
                    u.role === "teacher" && u.approved && u.subjects?.length,
                )
                .map((u) => ({ id: u._id, name: u.fullName }))}
              selected={[form.teacherId]}
              onChange={(id) =>
                setForm({ ...form, teacherId: id, subjectId: "" })
              }
            />
            <Choices
              title="Fan"
              items={(
                users.find((u) => u._id === form.teacherId)?.subjects || []
              ).map((s) => ({ id: s._id, name: s.name }))}
              selected={[form.subjectId]}
              onChange={(id) => setForm({ ...form, subjectId: id })}
            />
            <Choices
              title="Guruhlar"
              items={groups.map((g) => ({ id: g._id, name: g.name }))}
              selected={form.groupIds}
              onChange={(id) =>
                setForm({
                  ...form,
                  groupIds: form.groupIds.includes(id)
                    ? form.groupIds.filter((g) => g !== id)
                    : [...form.groupIds, id],
                })
              }
            />
            {field("date", "Sana (ertadan boshlab)", "YYYY-MM-DD")}
            <View style={styles.field}>
              <Text style={styles.label}>Bo‘sh vaqt</Text>
              {!form.teacherId ||
              form.groupIds.length === 0 ||
              !/^\d{4}-\d{2}-\d{2}$/.test(form.date) ? (
                <Text style={styles.small}>
                  Avval o‘qituvchi, guruh va sanani tanlang
                </Text>
              ) : form.date < MIN_DATE ? (
                <Text style={styles.small}>
                  Darsni kamida bir kun oldin biriktirish mumkin. Sana:{" "}
                  {MIN_DATE} yoki keyin.
                </Text>
              ) : slotsLoading ? (
                <ActivityIndicator color={COLORS.primary} />
              ) : slots.length === 0 ? (
                <Text style={styles.small}>
                  Bu kunda tanlangan o‘qituvchi va guruhlar uchun bo‘sh vaqt
                  yo‘q
                </Text>
              ) : (
                <View style={styles.choices}>
                  {slots.map((slot) => (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityState={{
                        selected: form.pairNumber === slot.pairNumber,
                      }}
                      key={slot.pairNumber}
                      onPress={() =>
                        setForm((f) => ({
                          ...f,
                          pairNumber: slot.pairNumber,
                          startTime: slot.startTime,
                          endTime: slot.endTime,
                        }))
                      }
                      style={[
                        styles.chip,
                        form.pairNumber === slot.pairNumber &&
                          styles.chipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          form.pairNumber === slot.pairNumber &&
                            styles.chipTextActive,
                        ]}
                      >
                        {slot.pairNumber}-para · {slot.startTime}–{slot.endTime}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            {field("room", "Auditoriya", "306")}
            {field("building", "O‘quv bino", "4-o‘quv bino")}
            <Text style={styles.label}>Xonalar · {form.pairNumber}-para</Text>
            {(availability?.rooms || []).map((r) => (
              <TouchableOpacity
                key={r._id}
                disabled={r.busy}
                style={[styles.chip, r.busy && { backgroundColor: "#ffe5ea" }]}
                onPress={() =>
                  setForm((f) => ({ ...f, room: r.name, building: r.building }))
                }
              >
                <Text style={styles.chipText}>
                  {r.building} · {r.name} — {r.busy ? "Band" : "Bo‘sh"}
                </Text>
              </TouchableOpacity>
            ))}
            {(availability?.busyLessons || []).map((l) => (
              <Text
                key={l._id}
                style={{ fontSize: 11, color: "#bd4358", paddingVertical: 5 }}
              >
                {l.teacher?.fullName} · {l.room}-xona · {l.startTime}–
                {l.endTime}
              </Text>
            ))}
            <Choices
              title="Dars turi"
              items={["Ma'ruza", "Amaliyot", "Laboratoriya"].map((t) => ({
                id: t,
                name: t,
              }))}
              selected={[form.type]}
              onChange={(type) => setForm({ ...form, type })}
            />
            <TouchableOpacity
              accessibilityRole="button"
              disabled={
                busy || slotsLoading || slots.length === 0 || dateTooEarly
              }
              activeOpacity={0.85}
              style={[
                styles.button,
                (busy || slotsLoading || slots.length === 0 || dateTooEarly) &&
                  styles.buttonDisabled,
              ]}
              onPress={createLesson}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={18}
                color="#ffffff"
              />
              <Text style={styles.buttonText}>
                {busy
                  ? "Saqlanmoqda..."
                  : dateTooEarly
                    ? "Sana ertadan boshlab"
                    : slots.length === 0
                      ? "Bo‘sh vaqt yo‘q"
                      : "Biriktirish"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {tab === "lessons" &&
          lessons.map((l) => (
            <View key={l._id} style={styles.card}>
              <Text style={styles.title}>{l.subject?.name}</Text>
              <Text style={styles.small}>
                {l.date} · {l.startTime}–{l.endTime}
              </Text>
              <Text style={styles.small}>
                {l.teacher?.fullName} · {l.building} · {l.room}-xona
              </Text>
              <TouchableOpacity
                disabled={busy}
                onPress={() =>
                  ask("Ushbu dars va uning davomati o‘chirilsinmi?", () =>
                    action(
                      () => api.delete(`/admin/lessons/${l._id}`),
                      "Dars o‘chirildi",
                    ),
                  )
                }
              >
                <Text style={{ color: COLORS.red, marginTop: 10 }}>
                  Darsni o‘chirish
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        {tab === "catalog" && (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.cardIcon}>
                <Ionicons
                  name="albums-outline"
                  size={16}
                  color={COLORS.primary}
                />
              </View>
              <Text style={styles.title}>Guruhlar va fanlar</Text>
            </View>
            <TextInput
              placeholder="Yangi guruh yoki fan nomi"
              placeholderTextColor={COLORS.gray}
              style={styles.input}
              value={name}
              onChangeText={setName}
            />
            <View style={styles.choices}>
              {[
                ["groups", "Guruh qo‘shish"],
                ["subjects", "Fan qo‘shish"],
              ].map(([key, label]) => (
                <TouchableOpacity
                  disabled={busy || !name.trim()}
                  key={key}
                  style={[
                    styles.chip,
                    (!name.trim() || busy) && styles.buttonDisabled,
                  ]}
                  onPress={() =>
                    action(async () => {
                      await api.post(`/admin/${key}`, { name: name.trim() });
                      setName("");
                    }, "Qo‘shildi")
                  }
                >
                  <Text style={styles.chipText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {groups.map((g) => (
              <View key={g._id} style={styles.catalogRow}>
                <View style={styles.catalogIcon}>
                  <Ionicons
                    name="people-outline"
                    size={15}
                    color={COLORS.primary}
                  />
                </View>
                <Text style={styles.catalogName}>{g.name}</Text>
                <Text style={styles.catalogMeta}>{g.studentCount} talaba</Text>
              </View>
            ))}
            {subjects.map((s) => (
              <View key={s._id} style={styles.catalogRow}>
                <View
                  style={[styles.catalogIcon, { backgroundColor: "#f5f3ff" }]}
                >
                  <Ionicons
                    name="book-outline"
                    size={15}
                    color={COLORS.accent}
                  />
                </View>
                <Text style={styles.catalogName}>{s.name}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.footerActions}>
          <TouchableOpacity
            disabled={busy}
            style={styles.refresh}
            onPress={load}
          >
            <Ionicons name="refresh" size={17} color={COLORS.primary} />
            <Text style={styles.refreshText}>Yangilash</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={busy}
            style={styles.logout}
            onPress={() => {
              clearCredentials();
              logout();
            }}
          >
            <Ionicons name="log-out-outline" color={COLORS.red} size={19} />
            <Text style={styles.logoutText}>Chiqish</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={!!resetUser || !!credentials}
        transparent
        animationType="fade"
        onRequestClose={closeCredentials}
      >
        <View style={styles.modalBackdrop}>
          <ScrollView
            style={styles.modalCard}
            contentContainerStyle={{ padding: 22 }}
            keyboardShouldPersistTaps="handled"
          >
            <Text accessibilityRole="header" style={styles.title}>
              {credentials ? "Kirish ma’lumotlari" : "Login / parol"}
            </Text>
            <Text style={styles.label}>
              {(credentials || resetUser)?.fullName}
            </Text>
            <Text style={styles.small}>
              {credentials
                ? "Saqlandi. Ma’lumotlarni faqat hisob egasiga bering. Oyna yopilgach parolni qayta ko‘rib bo‘lmaydi."
                : "Eski parol xeshda saqlangan va ochilmaydi. Yangi parolni saqlasangiz, eski parol ishlamaydi."}
            </Text>
            <View style={styles.field}>
              <Text style={styles.label}>Login (telefon)</Text>
              <TextInput
                accessibilityLabel="Hisob logini"
                style={styles.input}
                value={(credentials || resetUser)?.phone || ""}
                editable={false}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Yangi parol</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  accessibilityLabel={
                    credentials
                      ? "Saqlangan yangi parol"
                      : "Yangilash uchun yangi parol"
                  }
                  placeholder="Kamida 6 belgi"
                  placeholderTextColor={COLORS.gray}
                  style={[styles.input, { flex: 1 }]}
                  value={credentials ? credentials.password : newPassword}
                  onChangeText={setNewPassword}
                  editable={!credentials && !busy}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword ? "Parolni yashirish" : "Parolni ko‘rsatish"
                  }
                  disabled={busy}
                  style={styles.iconBtn}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={COLORS.primary}
                  />
                </TouchableOpacity>
              </View>
            </View>
            {!!credentialError && (
              <Text accessibilityRole="alert" style={styles.message}>
                {credentialError}
              </Text>
            )}
            {!credentials ? (
              <TouchableOpacity
                accessibilityRole="button"
                disabled={busy}
                style={styles.button}
                onPress={savePassword}
              >
                <Ionicons name="save-outline" size={18} color="#ffffff" />
                <Text style={styles.buttonText}>
                  {busy ? "Saqlanmoqda..." : "Yangi parolni saqlash"}
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              accessibilityRole="button"
              disabled={busy}
              style={[
                styles.outlineBtn,
                { marginTop: 12, justifyContent: "center" },
              ]}
              onPress={closeCredentials}
            >
              <Text style={styles.outlineText}>
                {credentials ? "Yopish" : "Bekor qilish"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 16, gap: 12, paddingBottom: 40 },
  passwordRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 480,
    maxHeight: "90%",
    flexGrow: 0,
    backgroundColor: "#fff",
    borderRadius: RADIUS.xl,
  },
  stats: { flexDirection: "row", gap: 9 },
  stat: {
    flex: 1,
    backgroundColor: COLORS.card,
    paddingVertical: 13,
    paddingHorizontal: 6,
    alignItems: "center",
    borderRadius: RADIUS.lg,
    ...SHADOWS.soft,
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 7,
  },
  value: { fontSize: 22, fontWeight: "800", color: COLORS.text },
  small: { color: COLORS.muted, fontSize: 11, lineHeight: 15, marginTop: 2 },
  tabs: {
    flexDirection: "row",
    gap: 5,
    backgroundColor: COLORS.grayBg,
    borderRadius: RADIUS.lg,
    padding: 4,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    gap: 3,
    borderRadius: RADIUS.md,
  },
  tabActive: { backgroundColor: COLORS.primary, ...SHADOWS.soft },
  tabText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: COLORS.muted,
    textAlign: "center",
  },
  tabTextActive: { color: "#ffffff" },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 7 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { color: COLORS.text, fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: "#ffffff" },
  card: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: RADIUS.lg,
    ...SHADOWS.soft,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 10,
  },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.sm,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontWeight: "800", fontSize: 16.5, color: COLORS.text },
  label: {
    color: COLORS.text,
    fontWeight: "700",
    fontSize: 12,
    marginBottom: 5,
  },
  input: {
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#f8fafc",
    color: COLORS.text,
    fontSize: 14,
  },
  field: { marginTop: 8 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    marginTop: 12,
    ...SHADOWS.float,
  },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  message: {
    color: COLORS.primary,
    padding: 12,
    backgroundColor: "#dbeafe",
    borderRadius: RADIUS.md,
    fontSize: 12.5,
    lineHeight: 18,
    overflow: "hidden",
  },
  hintText: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: 4,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 13,
  },
  searchInput: { flex: 1, height: 46, fontSize: 13.5, color: COLORS.text },
  userHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarText: { fontSize: 16, fontWeight: "800", color: COLORS.primary },
  userBody: { flex: 1 },
  userName: { fontSize: 14, fontWeight: "800", color: COLORS.text },
  statusPill: {
    borderRadius: RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: { fontSize: 9.5, fontWeight: "800" },
  rowActions: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 10 },
  outlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  outlineText: { color: COLORS.primary, fontSize: 11.5, fontWeight: "700" },
  outlineMuted: { color: COLORS.muted, fontSize: 11.5, fontWeight: "700" },
  smallButton: {
    backgroundColor: COLORS.greenBg,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  smallButtonText: { color: COLORS.green, fontSize: 11.5, fontWeight: "800" },
  emptyText: {
    textAlign: "center",
    color: COLORS.muted,
    fontSize: 12.5,
    paddingVertical: 18,
  },
  catalogRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  catalogIcon: {
    width: 30,
    height: 30,
    borderRadius: RADIUS.sm,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  catalogName: { flex: 1, color: COLORS.text, fontSize: 13, fontWeight: "700" },
  catalogMeta: { color: COLORS.muted, fontSize: 11 },
  footerActions: { flexDirection: "row", gap: 9, marginTop: 4 },
  refresh: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    height: 48,
    ...SHADOWS.soft,
  },
  refreshText: { color: COLORS.primary, fontSize: 13, fontWeight: "800" },
  logout: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    height: 48,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  logoutText: { color: COLORS.red, fontSize: 13, fontWeight: "800" },
});
