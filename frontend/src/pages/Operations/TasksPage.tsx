import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { geoSafeAPI } from "../../services";
import { VolunteerTask, VolunteerTaskCreate } from "../../types";
import { EmptyState, ResourceBadge, SectionHeader, Tone } from "./opsUi";

const URGENCY_LABELS: Record<string, string> = {
  low: "Düşük",
  medium: "Orta",
  high: "Acil",
  critical: "Kritik",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Açık",
  in_progress: "Devam Ediyor",
  done: "Tamamlandı",
  cancelled: "İptal",
};

function urgencyTone(urgency: string): Tone {
  if (urgency === "critical") return "critical";
  if (urgency === "high") return "warning";
  if (urgency === "medium") return "info";
  return "safe";
}

function statusTone(status: string): Tone {
  if (status === "done") return "safe";
  if (status === "cancelled") return "neutral";
  if (status === "in_progress") return "warning";
  return "info";
}

const EMPTY_FORM: VolunteerTaskCreate = {
  title: "",
  urgency: "medium",
};

type Tab = "open" | "my" | "all";

export default function TasksPage() {
  const { role } = useAuth();
  const isCoordinator = role === "admin" || role === "operator";

  const [tab, setTab] = useState<Tab>("open");
  const [tasks, setTasks] = useState<VolunteerTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMsg, setActionMsg] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<VolunteerTaskCreate>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let data: VolunteerTask[];
      if (tab === "all" && isCoordinator) {
        data = await geoSafeAPI.fetchVolunteerTasksAdmin();
      } else if (tab === "my") {
        data = await geoSafeAPI.fetchMyVolunteerTasks();
      } else {
        data = await geoSafeAPI.fetchOpenVolunteerTasks();
      }
      setTasks(data);
    } catch {
      setError("Görevler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [tab, isCoordinator]);

  useEffect(() => { void load(); }, [load]);

  const flash = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(""), 3000);
  };

  const handleClaim = async (taskId: number) => {
    try {
      await geoSafeAPI.claimVolunteerTask(taskId);
      flash("Görev alındı.");
      void load();
    } catch {
      flash("Görev alınamadı.");
    }
  };

  const handleComplete = async (taskId: number) => {
    try {
      await geoSafeAPI.completeVolunteerTask(taskId);
      flash("Görev tamamlandı.");
      void load();
    } catch {
      flash("Görev tamamlanamadı.");
    }
  };

  const handleCancel = async (taskId: number) => {
    try {
      await geoSafeAPI.updateVolunteerTaskStatus(taskId, "cancelled");
      flash("Görev iptal edildi.");
      void load();
    } catch {
      flash("İptal edilemedi.");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setFormError("Başlık zorunludur."); return; }
    setFormError("");
    setCreating(true);
    try {
      await geoSafeAPI.createVolunteerTask({
        ...form,
        description: form.description?.trim() || undefined,
        location: form.location?.trim() || undefined,
        skill_required: form.skill_required?.trim() || undefined,
      });
      setForm(EMPTY_FORM);
      setShowCreate(false);
      flash("Görev oluşturuldu.");
      void load();
    } catch {
      setFormError("Görev oluşturulamadı.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className="ops-panel">
      <SectionHeader eyebrow="Koordinasyon" title="Görev Panosu" meta={`${tasks.length} görev`} />

      <div className="ops-announcement-toolbar">
        <div className="ops-tab-row">
          <button
            className={`ops-tab${tab === "open" ? " active" : ""}`}
            onClick={() => setTab("open")}
            type="button"
          >
            Açık Görevler
          </button>
          <button
            className={`ops-tab${tab === "my" ? " active" : ""}`}
            onClick={() => setTab("my")}
            type="button"
          >
            Görevlerim
          </button>
          {isCoordinator ? (
            <button
              className={`ops-tab${tab === "all" ? " active" : ""}`}
              onClick={() => setTab("all")}
              type="button"
            >
              Tüm Görevler
            </button>
          ) : null}
        </div>

        {isCoordinator ? (
          <button
            className="ops-button primary"
            onClick={() => setShowCreate((v) => !v)}
            type="button"
          >
            {showCreate ? "İptal" : "Yeni Görev"}
          </button>
        ) : null}
      </div>

      {actionMsg ? (
        <div className="ops-action-msg">{actionMsg}</div>
      ) : null}

      {showCreate && isCoordinator ? (
        <form className="ops-task-form" onSubmit={handleCreate}>
          <div className="ops-task-form-fields">
            <label className="form-field">
              <span>Başlık <b>Zorunlu</b></span>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Görev başlığı"
              />
            </label>
            <label className="form-field">
              <span>Aciliyet</span>
              <select
                value={form.urgency}
                onChange={(e) => setForm((f) => ({ ...f, urgency: e.target.value as VolunteerTaskCreate["urgency"] }))}
              >
                {Object.entries(URGENCY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Konum</span>
              <input
                value={form.location ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="İlçe veya bölge"
              />
            </label>
            <label className="form-field">
              <span>Gereken Beceri</span>
              <input
                value={form.skill_required ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, skill_required: e.target.value }))}
                placeholder="Örn: İlk yardım"
              />
            </label>
            <label className="form-field ops-task-form-desc">
              <span>Açıklama</span>
              <textarea
                rows={3}
                value={form.description ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Görev detayları"
              />
            </label>
          </div>
          {formError ? <span className="ops-form-error">{formError}</span> : null}
          <div className="ops-task-form-actions">
            <button className="ops-button primary" type="submit" disabled={creating}>
              {creating ? "Kaydediliyor..." : "Oluştur"}
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <EmptyState message="Yükleniyor..." />
      ) : error ? (
        <EmptyState message={error} />
      ) : tasks.length === 0 ? (
        <EmptyState message="Bu listede görev yok." />
      ) : (
        <div className="ops-task-list">
          {tasks.map((task) => (
            <article key={task.id} className="ops-task-card">
              <div className="ops-task-card-head">
                <div className="ops-task-card-title">
                  <ResourceBadge tone={urgencyTone(task.urgency)}>
                    {URGENCY_LABELS[task.urgency] ?? task.urgency}
                  </ResourceBadge>
                  <strong>{task.title}</strong>
                </div>
                <ResourceBadge tone={statusTone(task.status)}>
                  {STATUS_LABELS[task.status] ?? task.status}
                </ResourceBadge>
              </div>

              {task.description ? (
                <p className="ops-task-card-desc">{task.description}</p>
              ) : null}

              <div className="ops-task-card-meta">
                {task.location ? <span>📍 {task.location}</span> : null}
                {task.skill_required ? <span>🛠 {task.skill_required}</span> : null}
              </div>

              <div className="ops-task-card-actions">
                {task.status === "open" ? (
                  <button
                    className="ops-button primary"
                    onClick={() => handleClaim(task.id)}
                    type="button"
                  >
                    Görevi Al
                  </button>
                ) : null}

                {task.status === "in_progress" && tab === "my" ? (
                  <button
                    className="ops-button primary"
                    onClick={() => handleComplete(task.id)}
                    type="button"
                  >
                    Tamamlandı
                  </button>
                ) : null}

                {isCoordinator && task.status !== "done" && task.status !== "cancelled" ? (
                  <button
                    className="ops-button danger"
                    onClick={() => handleCancel(task.id)}
                    type="button"
                  >
                    İptal
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
