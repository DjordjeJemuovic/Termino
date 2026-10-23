"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type DragEvent, type PointerEvent, type ReactNode } from "react";
import { localDateTimeToUtc } from "@/lib/scheduling/time";
import { updateAdminAppointment } from "@/actions/admin-appointments";

type CalendarEvent = {
  id: string; title: string; client: string; startLabel: string; endLabel: string;
  color: string; top: number; height: number; startsAt: string; endsAt: string; status: string;
};

export function CalendarDropColumn({ date, timezone, children }: { date: string; timezone: string; children: ReactNode }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  async function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const raw = event.dataTransfer.getData("application/termino-appointment");
    if (!raw) return;
    let rollback: (() => void) | undefined;
    try {
      const appointment = JSON.parse(raw) as { id: string; startsAt: string; endsAt: string };
      const bounds = event.currentTarget.getBoundingClientRect();
      const minute = Math.max(0, Math.min(1439, Math.round(((event.clientY - bounds.top) / bounds.height * 1440) / 15) * 15));
      const time = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
      const start = localDateTimeToUtc(date, time, timezone);
      const duration = new Date(appointment.endsAt).getTime() - new Date(appointment.startsAt).getTime();
      const end = new Date(start.getTime() + duration);
      const appointmentElement = document.querySelector<HTMLElement>(`[data-appointment-id="${appointment.id}"]`);
      const originalParent = appointmentElement?.parentElement;
      const originalNextSibling = appointmentElement?.nextElementSibling;
      const originalTop = appointmentElement?.style.top;
      const timeLabel = appointmentElement?.querySelector<HTMLElement>("p");
      const originalTimeLabel = timeLabel?.textContent;
      const formatTime = (value: Date) => new Intl.DateTimeFormat("sr-Latn-RS", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(value);
      rollback = () => {
        if (!appointmentElement || !originalParent) return;
        if (originalNextSibling?.parentElement === originalParent) originalParent.insertBefore(appointmentElement, originalNextSibling);
        else originalParent.append(appointmentElement);
        appointmentElement.style.top = originalTop ?? "";
        if (timeLabel && originalTimeLabel) timeLabel.textContent = originalTimeLabel;
      };

      // Prikažemo pomeranje odmah, dok server proverava i čuva termin.
      if (appointmentElement) {
        event.currentTarget.append(appointmentElement);
        appointmentElement.style.top = `${minute}px`;
        if (timeLabel) timeLabel.textContent = `${formatTime(start)}–${formatTime(end)}`;
      }
      setMessage("Čuvam promenu...");
      const result = await updateAdminAppointment({ appointmentId: appointment.id, startsAt: start.toISOString(), endsAt: end.toISOString() });
      if (result.success) {
        setMessage("");
        router.refresh();
      } else {
        rollback?.();
        setMessage(result.error ?? "Termin nije mogao da se pomeri.");
      }
    } catch {
      rollback?.();
      setMessage("Termin nije mogao da se pomeri.");
    }
  }
  return <div onDragOver={(event) => event.preventDefault()} onDrop={onDrop} className="relative border-l border-[#eef0eb]" style={{ height: 1440 }}>
    {children}{message && <span role="status" className="absolute bottom-2 left-2 z-30 rounded-lg bg-white px-2 py-1 text-[10px] shadow">{message}</span>}
  </div>;
}

export function InteractiveAppointment({ event, canEdit = true }: { event: CalendarEvent; canEdit?: boolean }) {
  const router = useRouter();
  const [height, setHeight] = useState(event.height);
  const [message, setMessage] = useState("");
  const resize = useRef<{ startY: number; startHeight: number } | null>(null);

  function onDragStart(dragEvent: DragEvent<HTMLElement>) {
    if ((dragEvent.target as HTMLElement).closest("[data-resize-handle]")) {
      dragEvent.preventDefault();
      return;
    }
    dragEvent.dataTransfer.setData("application/termino-appointment", JSON.stringify({ id: event.id, startsAt: event.startsAt, endsAt: event.endsAt }));
    dragEvent.dataTransfer.effectAllowed = "move";
  }

  function onResizeStart(pointerEvent: PointerEvent<HTMLButtonElement>) {
    pointerEvent.preventDefault();
    pointerEvent.stopPropagation();
    pointerEvent.currentTarget.setPointerCapture(pointerEvent.pointerId);
    resize.current = { startY: pointerEvent.clientY, startHeight: height };
  }

  function onResizeMove(pointerEvent: PointerEvent<HTMLButtonElement>) {
    if (!resize.current) return;
    const delta = Math.round((pointerEvent.clientY - resize.current.startY) / 15) * 15;
    setHeight(Math.max(15, resize.current.startHeight + delta));
  }

  async function onResizeEnd(pointerEvent: PointerEvent<HTMLButtonElement>) {
    const start = resize.current;
    resize.current = null;
    if (!start) return;
    const delta = Math.round((pointerEvent.clientY - start.startY) / 15) * 15;
    const nextHeight = Math.max(15, start.startHeight + delta);
    const startsAt = new Date(event.startsAt);
    const end = new Date(startsAt.getTime() + nextHeight * 60_000);
    const result = await updateAdminAppointment({ appointmentId: event.id, startsAt: startsAt.toISOString(), endsAt: end.toISOString() });
    setMessage(result.error ?? result.message ?? "");
    if (result.success) router.refresh();
    else setHeight(event.height);
  }

  const editable = canEdit && (event.status === "pending" || event.status === "confirmed");
  return <article data-appointment-id={event.id} draggable={editable} onDragStart={onDragStart} className="absolute left-1.5 right-1.5 z-[1] overflow-hidden rounded-lg border-l-[3px] px-2 py-1 text-[10px] leading-tight shadow-sm sm:left-2 sm:right-2 sm:px-2.5 sm:text-xs" style={{ top: event.top, height, borderLeftColor: event.color, backgroundColor: `${event.color}20`, color: "#29352b", touchAction: "none", cursor: editable ? "grab" : "default", transition: "top 120ms ease" }}>
    <p className="truncate font-semibold">{event.startLabel}–{event.endLabel} · {event.client}</p>
    <p className="mt-0.5 truncate opacity-80">{event.title}</p>
    {message && <span role="status" className="block truncate text-[9px] text-[#a34231]">{message}</span>}
    {editable && <button type="button" data-resize-handle aria-label="Promeni trajanje termina" title="Povuci da promeniš trajanje"
      onPointerDown={onResizeStart} onPointerMove={onResizeMove} onPointerUp={onResizeEnd}
      className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize bg-black/10 hover:bg-black/20" />}
  </article>;
}
