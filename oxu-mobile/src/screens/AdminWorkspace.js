import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import api from "../api";
import Header from "../components/Header";
import WeekNavigator from "../components/WeekNavigator";
import { getWeekStart } from "../config";
const ask = (text, work) =>
  Platform.OS === "web"
    ? window.confirm(text) && work()
    : Alert.alert("Tasdiqlash", text, [
        { text: "Bekor qilish", style: "cancel" },
        { text: "Davom etish", onPress: work },
      ]);
export default function AdminWorkspace({ kind = "home", navigation }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [week, setWeek] = useState(getWeekStart()),
    [name, setName] = useState(""),
    [course, setCourse] = useState("1"),
    [building, setBuilding] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      const [u, g, s, l, r] = await Promise.all([
        api.get("/admin/users"),
        api.get("/admin/groups"),
        api.get("/admin/subjects"),
        api.get("/admin/lessons", { params: { weekStart: week } }),
        api.get("/admin/rooms"),
      ]);
      setData({
        users: u.data,
        groups: g.data,
        subjects: s.data,
        lessons: l.data,
        rooms: r.data,
      });
    } catch (e) {
      setError(e.response?.data?.message || "Ma’lumotlarni yuklab bo‘lmadi");
    }
  }, [week]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  const action = async (work) => {
    setBusy(true);
    setError("");
    try {
      await work();
      setName("");
      await load();
    } catch (e) {
      setError(e.response?.data?.message || "Saqlashda xatolik");
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ flex: 1, backgroundColor: "#f1f4fa" }}>
      <Header />
      <ScrollView
        contentContainerStyle={s.page}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.title}>
          {kind === "home"
            ? "Boshqaruv paneli"
            : kind === "report"
              ? "Haftalik hisobot"
              : "Katalog va auditoriyalar"}
        </Text>
        {error ? (
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
        ) : null}
        <Pressable onPress={load}>
          <Text style={s.link}>↻ Yangilash</Text>
        </Pressable>
        {(!data || busy) && <ActivityIndicator />}
        {data && (
          <>
            {kind === "home" && (
              <>
                <View style={s.grid}>
                  {[
                    [
                      "O‘qituvchilar",
                      data.users.filter((u) => u.role === "teacher").length,
                    ],
                    [
                      "Talabalar",
                      data.users.filter((u) => u.role === "student").length,
                    ],
                    ["Guruhlar", data.groups.length],
                    ["Haftalik darslar", data.lessons.length],
                  ].map(([label, n]) => (
                    <View style={s.stat} key={label}>
                      <Text style={s.number}>{n}</Text>
                      <Text style={s.sub}>{label}</Text>
                    </View>
                  ))}
                </View>
                {[
                  ["Users", "Hisoblar", "Foydalanuvchi va fan biriktirish"],
                  ["Schedule", "Dars jadvali", "Dars biriktirish va bandlik"],
                  ["Catalog", "Katalog", "Guruh, fan, bino va xonalar"],
                  ["Report", "Hisobot", "O‘qituvchilar haftalik yuklamasi"],
                  ["Profile", "Profil", "Ism, telefon va rasm"],
                ].map(([route, title, note]) => (
                  <Pressable
                    key={route}
                    style={s.card}
                    onPress={() => navigation.navigate(route)}
                  >
                    <Text style={s.heading}>{title} →</Text>
                    <Text style={s.sub}>{note}</Text>
                  </Pressable>
                ))}
              </>
            )}
            {kind === "report" && (
              <>
                <WeekNavigator weekStart={week} onChange={setWeek} />
                <View style={s.card}>
                  <Text style={s.number}>{data.lessons.length}</Text>
                  <Text style={s.sub}>tanlangan haftadagi darslar</Text>
                </View>
                {data.users
                  .filter((u) => u.role === "teacher")
                  .map((t) => (
                    <View key={t._id} style={s.card}>
                      <Text style={s.heading}>{t.fullName}</Text>
                      <Text style={s.link}>
                        {
                          data.lessons.filter((l) => l.teacher?._id === t._id)
                            .length
                        }{" "}
                        ta dars
                      </Text>
                    </View>
                  ))}
              </>
            )}
            {kind === "catalog" && (
              <>
                <View style={s.card}>
                  <Text style={s.heading}>Guruh yoki fan yaratish</Text>
                  <TextInput
                    style={s.input}
                    placeholder="Guruh / fan nomi"
                    value={name}
                    onChangeText={setName}
                  />
                  <Text style={s.sub}>Guruh kursi (1–6)</Text>
                  <TextInput
                    style={s.input}
                    keyboardType="number-pad"
                    value={course}
                    onChangeText={setCourse}
                  />
                  <View style={s.row}>
                    {[
                      ["groups", "Guruh qo‘shish"],
                      ["subjects", "Fan qo‘shish"],
                    ].map(([route, label]) => (
                      <Pressable
                        key={route}
                        disabled={busy || !name.trim()}
                        onPress={() =>
                          action(() =>
                            api.post(`/admin/${route}`, {
                              name: name.trim(),
                              ...(route === "groups"
                                ? { course: Number(course) }
                                : {}),
                            }),
                          )
                        }
                        style={s.button}
                      >
                        <Text style={s.white}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View style={s.card}>
                  <Text style={s.heading}>Xona qo‘shish</Text>
                  <TextInput
                    style={s.input}
                    placeholder="Kampus va bino"
                    value={building}
                    onChangeText={setBuilding}
                  />
                  <TextInput
                    style={s.input}
                    placeholder="Xona raqami"
                    value={name}
                    onChangeText={setName}
                  />
                  <Pressable
                    disabled={busy || !building.trim() || !name.trim()}
                    style={s.button}
                    onPress={() =>
                      action(() =>
                        api.post("/admin/rooms", {
                          name: name.trim(),
                          building: building.trim(),
                        }),
                      )
                    }
                  >
                    <Text style={s.white}>Xona qo‘shish</Text>
                  </Pressable>
                </View>
                {[
                  ["groups", "Guruhlar"],
                  ["subjects", "Fanlar"],
                  ["rooms", "Xonalar"],
                ].map(([key, label]) => (
                  <View style={s.card} key={key}>
                    <Text style={s.heading}>
                      {label} · {data[key].length}
                    </Text>
                    {data[key].map((item) => (
                      <View style={s.list} key={item._id}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.sub}>
                            {item.building ? `${item.building} · ` : ""}
                            {item.name}
                            {item.course ? ` · ${item.course}-kurs` : ""}
                          </Text>
                        </View>
                        {key !== "rooms" && (
                          <Pressable
                            disabled={busy}
                            onPress={() =>
                              ask("Haqiqatan ham o‘chirmoqchimisiz?", () =>
                                action(() =>
                                  api.delete(`/admin/${key}/${item._id}`),
                                ),
                              )
                            }
                          >
                            <Text style={s.error}>O‘chirish</Text>
                          </Pressable>
                        )}
                      </View>
                    ))}
                  </View>
                ))}
              </>
            )}
          </>
        )}
        <Text style={s.sub}>
          Sahifa almashtirish: ekran chetidan chapga yoki o‘ngga suring.
        </Text>
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  page: { padding: 16, paddingBottom: 130 },
  title: {
    fontSize: 23,
    fontWeight: "800",
    color: "#293f67",
    marginBottom: 14,
  },
  card: {
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 17,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f3",
  },
  heading: { fontSize: 15, fontWeight: "700", color: "#344e79" },
  sub: { fontSize: 12, lineHeight: 20, color: "#8d9bb1", marginTop: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 18 },
  stat: {
    width: "48%",
    backgroundColor: "#e6ecfb",
    padding: 18,
    borderRadius: 16,
  },
  number: { fontSize: 29, fontWeight: "800", color: "#354e7d" },
  input: {
    borderWidth: 1,
    borderColor: "#dde5f2",
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
    marginBottom: 8,
    color: "#344e79",
  },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  button: { backgroundColor: "#354e7d", padding: 12, borderRadius: 10 },
  white: { fontSize: 11, color: "#fff", fontWeight: "700" },
  list: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderColor: "#edf1f7",
  },
  error: { fontSize: 12, color: "#bd4358" },
  link: { fontSize: 12, color: "#5574b5", marginVertical: 10 },
});
