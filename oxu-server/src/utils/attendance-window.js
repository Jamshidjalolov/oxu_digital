function attendanceWindow(lesson, now = new Date()) {
  const start = Date.parse(`${lesson.date}T${lesson.startTime}:00+05:00`);
  const end = Date.parse(`${lesson.date}T${lesson.endTime}:00+05:00`);
  const allowed = Number.isFinite(start) && Number.isFinite(end) && now.getTime() >= start && now.getTime() < end;
  return { allowed, message: `Davomat faqat ${lesson.date} kuni ${lesson.startTime}–${lesson.endTime} oralig‘ida olinadi (Toshkent vaqti).` };
}
module.exports = attendanceWindow;
