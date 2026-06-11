"use client";
import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/app-context";
import { api } from "@/lib/api";
import { 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  Lock, 
  Trophy, 
  BookOpen,
  ArrowRight,
  Calendar,
  AlertCircle,
  Play
} from "lucide-react";

export default function PlannerPage() {
  const router = useRouter();
  const { roadmaps, undismissTask } = useApp();

  const getLocalDateStr = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const todayStr = useMemo(() => {
    return getLocalDateStr();
  }, []);

  // Date States
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedRoadmapId, setSelectedRoadmapId] = useState<string | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [commitments, setCommitments] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Bottom details panel selected date (defaults to today)
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    setSelectedDate(getLocalDateStr());
  }, []);

  // Drag and Drop Visual Feedback States
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [dragOverUnassigned, setDragOverUnassigned] = useState<boolean>(false);

  // Fetch commitments
  const fetchCommitments = async () => {
    try {
      const data = await api.getCommitments();
      const map: Record<string, any> = {};
      data.forEach((c: any) => {
        map[c.eventId] = c;
      });
      setCommitments(map);
    } catch (e) {
      console.error("Failed to load commitments:", e);
    }
  };

  // Fetch Planner Schedule
  const fetchSchedule = async (roadmapId: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getPlannerSchedule(roadmapId || undefined);
      setEvents(data);
    } catch (e: any) {
      setError(e.message || "Failed to load schedule");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommitments();
    fetchSchedule(selectedRoadmapId);
  }, [selectedRoadmapId]);

  const getWeekStart = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    const day = date.getDay(); // 0 is Sunday
    const diff = date.getDate() - day;
    const sunday = new Date(date.setDate(diff));
    const y = sunday.getFullYear();
    const m = String(sunday.getMonth() + 1).padStart(2, "0");
    const d = String(sunday.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  // Compute minutes scheduled per week, per roadmap
  const weeklyRoadmapMinutes = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    events.forEach(ev => {
      if (ev.date) {
        const weekStart = getWeekStart(ev.date);
        const rid = ev.roadmapId;
        const mins = ev.durationMins || 45;
        if (!map[weekStart]) {
          map[weekStart] = {};
        }
        map[weekStart][rid] = (map[weekStart][rid] || 0) + mins;
      }
    });
    return map;
  }, [events]);

  const roadmapColors = useMemo(() => {
    const sorted = [...roadmaps].sort((a, b) => a.id.localeCompare(b.id));
    const colors = ["#2563eb", "#ea580c", "#ca8a04"]; // Blue, Orange, Yellow
    const mapping: Record<string, string> = {};
    sorted.forEach((r, index) => {
      mapping[r.id] = colors[index % colors.length];
    });
    return mapping;
  }, [roadmaps]);

  // Drag and drop handlers
  const handleAssignDate = async (eventId: string, date: string) => {
    if (date < todayStr) {
      alert("Cannot schedule tasks on past dates.");
      return;
    }

    const draggedEvent = events.find(e => e.id === eventId);
    if (draggedEvent) {
      const weekStart = getWeekStart(date);
      const rid = draggedEvent.roadmapId;
      const duration = draggedEvent.durationMins || 45;
      
      const rm = roadmaps.find(r => r.id === rid);
      const limitHours = rm?.advisor_metadata?.time ?? 4;
      const limitMins = limitHours * 60;
      
      const currentAssigned = weeklyRoadmapMinutes[weekStart]?.[rid] || 0;
      const previousDate = draggedEvent.date;
      const isSameWeek = previousDate && getWeekStart(previousDate) === weekStart;
      
      const newTotal = currentAssigned + duration - (isSameWeek ? duration : 0);
      
      if (newTotal > limitMins) {
        const proceed = window.confirm(
          `Scheduling this task will exceed your weekly budget of ${limitMins} minutes for "${rm?.topic}" (you will have scheduled ${newTotal} minutes). Do you wish to proceed?`
        );
        if (!proceed) {
          return;
        }
      }
    }

    try {
      await api.updateCommitment(eventId, date, true);
      await fetchCommitments();
      await fetchSchedule(selectedRoadmapId);
    } catch (e) {
      console.error("Failed to assign date:", e);
    }
  };

  const handleUnassign = async (eventId: string) => {
    try {
      await api.deleteCommitment(eventId);
      await fetchCommitments();
      await fetchSchedule(selectedRoadmapId);
    } catch (e) {
      console.error("Failed to unassign task:", e);
    }
  };

  // Date Parsing Helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const firstDayIndex = new Date(year, month, 1).getDay();
  const numDays = new Date(year, month + 1, 0).getDate();
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };
  
  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Daily statistics calculation
  const todayEvents = events.filter(e => e.date === todayStr);
  const totalToday = todayEvents.length;
  const completedToday = todayEvents.filter(e => e.completed).length;
  const todayProgressPercent = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

  const activeRoadmaps = roadmaps.filter(r => r.status === "active");

  const unassignedTasks = useMemo(() => {
    return events.filter(e => !e.date);
  }, [events]);

  const sortedUnassignedTasks = useMemo(() => {
    return [...unassignedTasks].sort((a, b) => {
      const aIn = a.inProgress ? 1 : 0;
      const bIn = b.inProgress ? 1 : 0;
      return bIn - aIn;
    });
  }, [unassignedTasks]);

  const currentWeekStart = useMemo(() => {
    const targetDate = dragOverDate || selectedDate || todayStr;
    return getWeekStart(targetDate);
  }, [dragOverDate, selectedDate, todayStr]);

  const weekBudgets = useMemo(() => {
    const weekStart = currentWeekStart;
    const weekStartObj = new Date(weekStart + "T00:00:00");
    const weekEndObj = new Date(weekStartObj);
    weekEndObj.setDate(weekEndObj.getDate() + 6);
    
    const label = `Week of ${weekStartObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${weekEndObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    
    const list = activeRoadmaps.map(rm => {
      const limitHours = rm.advisor_metadata?.time ?? 4;
      const limitMins = limitHours * 60;
      const assignedMins = weeklyRoadmapMinutes[weekStart]?.[rm.id] || 0;
      const leftMins = Math.max(0, limitMins - assignedMins);
      const color = roadmapColors[rm.id] || "var(--accent)";
      
      return {
        id: rm.id,
        topic: rm.topic,
        limitMins,
        assignedMins,
        leftMins,
        color
      };
    });
    
    return { label, list };
  }, [currentWeekStart, activeRoadmaps, weeklyRoadmapMinutes, roadmapColors]);

  return (
    <div className="fade-up" style={{ padding: "32px 36px", display: "flex", flexDirection: "column", gap: 24, maxWidth: "100%" }}>
      {/* Header Block */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 500, color: "var(--text-primary)", marginBottom: 4 }}>Daily Planner</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            Drag and drop tasks onto any calendar date to plan your schedule
          </p>
        </div>
        
        {/* Daily Progress Ring widget based on task count */}
        <div style={{
          display: "flex", alignItems: "center", gap: 16,
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)", padding: "12px 20px"
        }}>
          <div style={{ position: "relative", width: 44, height: 44 }}>
            <svg width="44" height="44" viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="18" fill="transparent" stroke="var(--border)" strokeWidth="3.5" />
              <circle cx="22" cy="22" r="18" fill="transparent" stroke="var(--accent)" strokeWidth="3.5"
                strokeDasharray={`${2 * Math.PI * 18}`}
                strokeDashoffset={`${2 * Math.PI * 18 * (1 - todayProgressPercent / 100)}`}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.35s" }}
              />
            </svg>
            <div style={{
              position: "absolute", top: 0, left: 0, width: 44, height: 44,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 600, color: "var(--text-primary)"
            }}>
              {todayProgressPercent}%
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Today's Tasks</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              {completedToday} of {totalToday} completed
            </div>
          </div>
        </div>
      </div>

      {/* Two-Column Grid Workspace */}
      <div style={{ display: "flex", gap: 28, alignItems: "flex-start", width: "100%" }}>
        
        {/* Left Column: Calendar Controller, Grid & Details (70% width) */}
        <div style={{ flex: 1.8, display: "flex", flexDirection: "column", minWidth: 0 }}>
          
          {/* Calendar Header Controller */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderBottom: "none", borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
            padding: "16px 20px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>
                {monthNames[month]} {year}
              </h2>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={handlePrevMonth} style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", padding: 4 }}>
                  <ChevronLeft size={18} />
                </button>
                <button onClick={handleNextMonth} style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", padding: 4 }}>
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button 
                onClick={() => setSelectedRoadmapId(null)}
                style={{
                  fontSize: 12, padding: "6px 12px", borderRadius: "var(--radius-md)",
                  background: selectedRoadmapId === null ? "var(--accent)" : "transparent",
                  color: selectedRoadmapId === null ? "#ffffff" : "var(--accent)",
                  border: "1px solid var(--accent)", cursor: "pointer", fontWeight: 600,
                  transition: "all 0.15s ease"
                }}
              >
                All Active
              </button>
              {activeRoadmaps.map(rm => {
                const color = roadmapColors[rm.id] || "var(--accent)";
                const isSelected = selectedRoadmapId === rm.id;
                return (
                  <button 
                    key={rm.id}
                    onClick={() => setSelectedRoadmapId(rm.id)}
                    style={{
                      fontSize: 12, padding: "6px 12px", borderRadius: "var(--radius-md)",
                      background: isSelected ? color : "transparent",
                      color: isSelected ? "#ffffff" : color,
                      border: `1px solid ${color}`, cursor: "pointer", fontWeight: 600,
                      transition: "all 0.15s ease"
                    }}
                  >
                    {rm.topic}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Loading / Error States / Calendar Grid */}
          {loading ? (
            <div style={{
              height: 350, display: "flex", alignItems: "center", justifyContent: "center",
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: "0 0 var(--radius-lg) var(--radius-lg)", color: "var(--text-muted)"
            }}>
              Loading calendar events...
            </div>
          ) : error ? (
            <div style={{
              height: 350, display: "flex", alignItems: "center", justifyContent: "center",
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: "0 0 var(--radius-lg) var(--radius-lg)", color: "var(--red)"
            }}>
              Error: {error}
            </div>
          ) : (
            <>


              <div style={{
                display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
                background: "var(--border)", gap: "1px",
                border: "1px solid var(--border)",
                borderRadius: "0 0 var(--radius-lg) var(--radius-lg)",
                overflow: "hidden"
              }}>
              {/* Weekdays */}
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                <div key={day} style={{
                  background: "var(--bg-surface)", padding: "10px 14px",
                  fontSize: 11, fontWeight: 600, color: "var(--text-muted)",
                  textAlign: "center", textTransform: "uppercase", letterSpacing: "0.06em"
                }}>
                  {day}
                </div>
              ))}

              {/* Days padding before */}
              {Array.from({ length: firstDayIndex }).map((_, idx) => (
                <div key={`empty-pre-${idx}`} style={{ background: "var(--bg-card)", opacity: 0.25 }} />
              ))}

              {/* Calendar Days */}
              {Array.from({ length: numDays }).map((_, idx) => {
                const dayNum = idx + 1;
                const formattedDateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                const dayEvents = events.filter(e => e.date === formattedDateStr);
                const isToday = formattedDateStr === todayStr;
                const isSelected = formattedDateStr === selectedDate;

                const isPast = formattedDateStr < todayStr;
                const hasIncomplete = dayEvents.some(e => !e.completed);
                const isPastDue = isPast && hasIncomplete;

                const getDayDots = (dayEvs: any[]) => {
                  const dotsList: { color: string; tooltip: string; isWarning?: boolean }[] = [];
                  const hasCompleted = dayEvs.some(e => e.completed);
                  if (hasCompleted) {
                    dotsList.push({ color: "var(--green)", tooltip: "Completed Tasks" });
                  }

                  const incompleteEvents = dayEvs.filter(e => !e.completed);
                  if (isPast && incompleteEvents.length > 0) {
                    dotsList.push({ color: "var(--red)", tooltip: "Overdue tasks", isWarning: true });
                  } else {
                    const incompleteRoadmapIds = Array.from(new Set(incompleteEvents.map(e => e.roadmapId)));
                    incompleteRoadmapIds.forEach(rid => {
                      const color = roadmapColors[rid];
                      if (color) {
                        const topic = roadmaps.find(r => r.id === rid)?.topic || "Roadmap";
                        dotsList.push({ color, tooltip: `Incomplete: ${topic}` });
                      }
                    });
                  }
                  return dotsList;
                };

                const dots = getDayDots(dayEvents);
                const isDragOver = dragOverDate === formattedDateStr;

                return (
                  <div 
                    key={`day-${dayNum}`}
                    onClick={() => setSelectedDate(formattedDateStr)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragOverDate !== formattedDateStr) {
                        setDragOverDate(formattedDateStr);
                      }
                    }}
                    onDragEnter={() => setDragOverDate(formattedDateStr)}
                    onDragLeave={() => setDragOverDate(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverDate(null);
                      const eventId = e.dataTransfer.getData("text/plain");
                      if (eventId) {
                        handleAssignDate(eventId, formattedDateStr);
                      }
                    }}
                    style={{
                      background: isDragOver ? "var(--accent-dim)" : (isPastDue ? "rgba(214, 59, 59, 0.08)" : (isSelected ? "var(--bg-hover)" : "var(--bg-card)")),
                      minHeight: 64,
                      padding: 8,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      border: isDragOver ? "2px dashed var(--accent)" : (isToday ? "2px solid var(--accent)" : isSelected ? "1px solid var(--accent-light)" : "none"),
                      position: "relative",
                      transition: "all 0.15s ease",
                      transform: isDragOver ? "scale(1.02)" : "none",
                      boxShadow: isDragOver ? "var(--shadow-md)" : "none",
                      zIndex: isDragOver ? 10 : 1
                    }}
                    onMouseEnter={e => { if (!isSelected && !isDragOver) e.currentTarget.style.background = isPastDue ? "rgba(214, 59, 59, 0.12)" : "var(--bg-surface)"; }}
                    onMouseLeave={e => { if (!isSelected && !isDragOver) e.currentTarget.style.background = isPastDue ? "rgba(214, 59, 59, 0.08)" : "var(--bg-card)"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: isToday ? "var(--accent)" : isSelected ? "var(--text-primary)" : "var(--text-muted)",
                      }}>
                        {dayNum}
                      </span>
                    </div>
                    
                    <div style={{ display: "flex", gap: 3, justifyContent: "center", alignItems: "center", marginTop: 4 }}>
                      {dots.map((dot, dIdx) => (
                        dot.isWarning ? (
                          <span key={dIdx} title={dot.tooltip} style={{ display: "flex", alignItems: "center" }}>
                            <AlertCircle size={10} color="var(--red)" style={{ flexShrink: 0 }} />
                          </span>
                        ) : (
                          <div 
                            key={dIdx} 
                            title={dot.tooltip}
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: dot.color
                            }} 
                          />
                        )
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Days padding after */}
              {Array.from({ length: (7 - ((firstDayIndex + numDays) % 7)) % 7 }).map((_, idx) => (
                <div key={`empty-post-${idx}`} style={{ background: "var(--bg-card)", opacity: 0.25 }} />
              ))}
            </div>
          </>
          )}

          {/* Bottom Sliding/Expanding Details Panel */}
          {selectedDate && (
            <div style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "20px 24px",
              marginTop: 20,
              animation: "fadeUp 0.2s ease"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
                  Tasks for {new Date(selectedDate + "T00:00:00").toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                </h3>
                {selectedDate === todayStr && (
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: "var(--accent-dim)", color: "var(--accent)", fontWeight: 600 }}>
                    Today
                  </span>
                )}
              </div>

              {(() => {
                const dayEvents = events.filter(e => e.date === selectedDate);
                if (dayEvents.length === 0) {
                  return (
                    <div style={{ padding: "24px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                      No study tasks scheduled for this day. Enjoy your break!
                    </div>
                  );
                }

                const sortedDayEvents = [...dayEvents].sort((a, b) => {
                  const aIn = a.inProgress ? 1 : 0;
                  const bIn = b.inProgress ? 1 : 0;
                  return bIn - aIn;
                });

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14, maxHeight: 310, overflowY: "auto", paddingRight: 6 }}>
                    {sortedDayEvents.map(ev => {
                      const isCompleted = ev.completed;
                      const isDragging = draggingId === ev.id;
                      return (
                        <div 
                          key={ev.id}
                          draggable={!isCompleted}
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", ev.id);
                            e.dataTransfer.effectAllowed = "move";
                            
                            // Cleanup any leftover ghosts
                            document.getElementById("drag-ghost")?.remove();

                            // Custom small drag image element
                            const ghost = document.createElement("div");
                            ghost.id = "drag-ghost";
                            ghost.style.position = "fixed";
                            ghost.style.top = "0";
                            ghost.style.left = "0";
                            ghost.style.transform = "translate(-100%, -100%)";
                            ghost.style.zIndex = "-9999";
                            ghost.style.pointerEvents = "none";
                            
                            ghost.style.width = "130px";
                            ghost.style.height = "34px";
                            ghost.style.boxSizing = "border-box";
                            ghost.style.background = roadmapColors[ev.roadmapId] || "var(--accent)";
                            ghost.style.color = "#fff";
                            ghost.style.borderRadius = "17px";
                            ghost.style.display = "flex";
                            ghost.style.alignItems = "center";
                            ghost.style.justifyContent = "center";
                            ghost.style.fontSize = "11px";
                            ghost.style.fontWeight = "600";
                            ghost.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
                            ghost.style.whiteSpace = "nowrap";
                            ghost.style.overflow = "hidden";
                            ghost.style.textOverflow = "ellipsis";
                            ghost.style.padding = "0 14px";
                            ghost.innerText = ev.title;
                            document.body.appendChild(ghost);
                            
                            // Center cursor exactly on the 130x34 pill
                            e.dataTransfer.setDragImage(ghost, 65, 17);

                            setTimeout(() => {
                              setDraggingId(ev.id);
                            }, 0);
                          }}
                          onDragEnd={() => {
                            setDraggingId(null);
                            document.getElementById("drag-ghost")?.remove();
                          }}
                          style={{
                            background: ev.inProgress ? "linear-gradient(135deg, rgba(232,82,10,0.04), rgba(212,134,10,0.04))" : "var(--bg-card)",
                            border: ev.inProgress ? "2px solid var(--accent)" : "1px solid var(--border)",
                            borderLeft: `4px solid ${roadmapColors[ev.roadmapId] || "var(--accent)"}`,
                            borderRadius: "var(--radius-md)",
                            padding: 16,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 16,
                            cursor: isCompleted ? "default" : "grab",
                            transition: "all 0.2s ease",
                            boxShadow: ev.inProgress ? "0 0 0 2px rgba(232,82,10,0.2)" : "var(--shadow-sm)",
                            ...(isDragging ? {
                              height: 0,
                              padding: 0,
                              margin: 0,
                              overflow: "hidden",
                              border: "none",
                              opacity: 0,
                              pointerEvents: "none"
                            } : {})
                          }}
                          onMouseEnter={e => {
                            if (!isCompleted && !isDragging) {
                              e.currentTarget.style.transform = "translateY(-1px)";
                              e.currentTarget.style.borderColor = roadmapColors[ev.roadmapId] || "var(--accent)";
                            }
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.transform = "none";
                            e.currentTarget.style.borderColor = ev.inProgress ? "var(--accent)" : "var(--border)";
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                              <span style={{
                                fontSize: 10,
                                fontWeight: 600,
                                color: roadmapColors[ev.roadmapId] || "var(--accent)",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                display: "block"
                              }}>
                                {ev.roadmapTopic}
                              </span>
                              <span style={{
                                fontSize: 9,
                                padding: "1px 6px",
                                borderRadius: 8,
                                fontWeight: 600,
                                background: ev.type === "skill_check" ? "var(--purple-dim)" : "var(--accent-dim)",
                                color: ev.type === "skill_check" ? "var(--purple)" : "var(--accent)"
                              }}>
                                {ev.type === "skill_check" ? "Skill Check" : "Task"}
                              </span>
                              {ev.inProgress && (
                                <span className="pulse" style={{
                                  fontSize: 9,
                                  padding: "1px 6px",
                                  borderRadius: 8,
                                  fontWeight: 600,
                                  background: "var(--accent-dim)",
                                  color: "var(--accent)"
                                }}>
                                  In Progress
                                </span>
                              )}
                            </div>
                            <h4 style={{
                              fontSize: 14,
                              fontWeight: 600,
                              color: "var(--text-primary)",
                              marginBottom: 6,
                              textDecoration: isCompleted ? "line-through" : "none"
                            }}>
                              {ev.title}
                            </h4>
                            <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4, margin: 0 }}>
                              {ev.description || (ev.type === "skill_check" ? "Verify your mastery of this topic pillar." : "Practical study block for this topic pillar.")}
                            </p>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6, fontSize: 11, color: "var(--text-muted)" }}>
                              <span>Duration: <strong>{ev.durationMins} mins</strong></span>
                            </div>
                          </div>

                          <div style={{ flexShrink: 0, display: "flex", gap: 8, alignItems: "center" }}>
                            {ev.inProgress ? (
                              <button
                                onClick={() => undismissTask(ev.id)}
                                style={{
                                  padding: "8px 14px",
                                  borderRadius: "var(--radius-md)",
                                  background: "var(--accent)",
                                  color: "#fff",
                                  border: "none",
                                  cursor: "pointer",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4
                                }}
                              >
                                <Play size={10} fill="#fff" /> Resume
                              </button>
                            ) : ev.type === "task" ? (
                              isCompleted ? (
                                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--green)", fontWeight: 500 }}>
                                  <CheckCircle2 size={14} /> Completed
                                </div>
                              ) : (
                                <button
                                  onClick={() => router.push(`/roadmap/${ev.roadmapId}?nodeId=${ev.nodeId}`)}
                                  style={{
                                    padding: "8px 14px",
                                    borderRadius: "var(--radius-md)",
                                    background: "var(--accent)",
                                    color: "#fff",
                                    border: "none",
                                    cursor: "pointer",
                                    fontSize: 12,
                                    fontWeight: 500,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6
                                  }}
                                >
                                  <span>Study Space</span>
                                  <ArrowRight size={12} />
                                </button>
                              )
                            ) : ev.type === "skill_check" ? (
                              <button
                                onClick={() => router.push(`/assessment`)}
                                style={{
                                  padding: "8px 14px",
                                  borderRadius: "var(--radius-md)",
                                  background: "#a855f7",
                                  color: "#fff",
                                  border: "none",
                                  cursor: "pointer",
                                  fontSize: 12,
                                  fontWeight: 500,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6
                                }}
                              >
                                <Trophy size={14} />
                                Launch Assessment
                              </button>
                            ) : (
                              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
                                <Lock size={12} />
                                <span>Locked Node Study Block</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Right Column: Budgets & Unassigned Queue (30% width) */}
        <div style={{ flex: 0.8, display: "flex", flexDirection: "column", gap: 20, alignSelf: "stretch" }}>
          
          {/* Weekly Budget Panel */}
          <div style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: "20px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            boxShadow: "var(--shadow-sm)"
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-display)", margin: 0 }}>
              Weekly Study Budget
            </h3>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{weekBudgets.label}</span>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
              {weekBudgets.list.map(b => {
                const percent = Math.min(100, Math.round((b.assignedMins / b.limitMins) * 100));
                return (
                  <div key={b.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{b.topic}</span>
                      <span style={{ color: "var(--text-secondary)" }}>
                        {b.assignedMins}m / {b.limitMins}m
                      </span>
                    </div>
                    <div style={{ height: 6, background: "var(--bg-surface)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{
                        width: `${percent}%`,
                        height: "100%",
                        background: b.color,
                        borderRadius: 3,
                        transition: "width 0.3s ease"
                      }} />
                    </div>
                    <div style={{ fontSize: 10, color: b.leftMins === 0 ? "var(--red)" : "var(--text-muted)", textAlign: "right" }}>
                      {b.leftMins === 0 ? "No minutes left" : `${b.leftMins} mins left`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Unassigned Queue */}
          <div 
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={() => setDragOverUnassigned(true)}
            onDragLeave={() => setDragOverUnassigned(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverUnassigned(false);
              const eventId = e.dataTransfer.getData("text/plain");
              if (eventId) {
                handleUnassign(eventId);
              }
            }}
            style={{
              flex: 1,
              background: "var(--bg-card)",
              border: dragOverUnassigned ? "2px dashed var(--accent)" : "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "20px 22px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
              overflowY: "auto",
              transition: "all 0.2s ease",
              transform: dragOverUnassigned ? "scale(1.01)" : "none",
              boxShadow: dragOverUnassigned ? "var(--shadow-md)" : "var(--shadow-sm)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Calendar size={18} color="var(--accent)" />
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-display)", margin: 0 }}>
                Unassigned Queue
              </h3>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>
              Drag tasks from here onto any calendar date to schedule them. Drag scheduled tasks back here to unschedule them.
            </p>
            
            {sortedUnassignedTasks.length === 0 ? (
              <div style={{
                padding: "36px 16px",
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: 12.5,
                border: "1.5px dashed var(--border)",
                borderRadius: "var(--radius-md)",
                background: "var(--bg-surface)"
              }}>
                No unassigned tasks! Everything is scheduled.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 310, overflowY: "auto", paddingRight: 6 }}>
                {sortedUnassignedTasks.map(ev => {
                  const isDragging = draggingId === ev.id;
                  return (
                    <div 
                      key={ev.id} 
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", ev.id);
                        e.dataTransfer.effectAllowed = "move";
                        
                        // Cleanup any leftover ghosts
                        document.getElementById("drag-ghost")?.remove();

                        const ghost = document.createElement("div");
                        ghost.id = "drag-ghost";
                        ghost.style.position = "fixed";
                        ghost.style.top = "0";
                        ghost.style.left = "0";
                        ghost.style.transform = "translate(-100%, -100%)";
                        ghost.style.zIndex = "-9999";
                        ghost.style.pointerEvents = "none";
                        
                        ghost.style.width = "130px";
                        ghost.style.height = "34px";
                        ghost.style.boxSizing = "border-box";
                        ghost.style.background = roadmapColors[ev.roadmapId] || "var(--accent)";
                        ghost.style.color = "#fff";
                        ghost.style.borderRadius = "17px";
                        ghost.style.display = "flex";
                        ghost.style.alignItems = "center";
                        ghost.style.justifyContent = "center";
                        ghost.style.fontSize = "11px";
                        ghost.style.fontWeight = "600";
                        ghost.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
                        ghost.style.whiteSpace = "nowrap";
                        ghost.style.overflow = "hidden";
                        ghost.style.textOverflow = "ellipsis";
                        ghost.style.padding = "0 14px";
                        ghost.innerText = ev.title;
                        document.body.appendChild(ghost);
                        
                        // Center cursor exactly on the 130x34 pill
                        e.dataTransfer.setDragImage(ghost, 65, 17);

                        setTimeout(() => {
                          setDraggingId(ev.id);
                        }, 0);
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        document.getElementById("drag-ghost")?.remove();
                      }}
                      style={{
                        background: ev.inProgress ? "linear-gradient(135deg, rgba(232,82,10,0.04), rgba(212,134,10,0.04))" : "var(--bg-card)",
                        border: ev.inProgress ? "2px solid var(--accent)" : "1px solid var(--border)",
                        borderLeft: `4px solid ${roadmapColors[ev.roadmapId] || "var(--accent)"}`,
                        borderRadius: "var(--radius-md)",
                        padding: "14px 16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        boxShadow: ev.inProgress ? "0 0 0 2px rgba(232,82,10,0.2)" : "var(--shadow-sm)",
                        cursor: "grab",
                        transition: "all 0.2s ease",
                        ...(isDragging ? {
                          height: 0,
                          padding: 0,
                          margin: 0,
                          overflow: "hidden",
                          border: "none",
                          opacity: 0,
                          pointerEvents: "none"
                        } : {})
                      }}
                      onMouseEnter={e => {
                        if (!isDragging) {
                          e.currentTarget.style.transform = "translateY(-1px)";
                          e.currentTarget.style.borderColor = roadmapColors[ev.roadmapId] || "var(--accent)";
                          e.currentTarget.style.boxShadow = "var(--shadow-md)";
                        }
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = "none";
                        e.currentTarget.style.borderColor = ev.inProgress ? "var(--accent)" : "var(--border)";
                        e.currentTarget.style.boxShadow = "var(--shadow-sm)";
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 2 }}>
                          <span style={{ fontSize: 9, fontWeight: 600, color: roadmapColors[ev.roadmapId] || "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            {ev.roadmapTopic}
                          </span>
                          <span style={{
                            fontSize: 8,
                            padding: "1px 5px",
                            borderRadius: 6,
                            fontWeight: 600,
                            background: ev.type === "skill_check" ? "var(--purple-dim)" : "var(--accent-dim)",
                            color: ev.type === "skill_check" ? "var(--purple)" : "var(--accent)"
                          }}>
                            {ev.type === "skill_check" ? "Skill Check" : "Task"}
                          </span>
                          {ev.inProgress && (
                            <span className="pulse" style={{
                              fontSize: 8,
                              padding: "1px 5px",
                              borderRadius: 6,
                              fontWeight: 600,
                              background: "var(--accent-dim)",
                              color: "var(--accent)"
                            }}>
                              In Progress
                            </span>
                          )}
                        </div>
                        <h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: "2px 0 4px 0" }}>
                          {ev.title}
                        </h4>
                        <p style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.45, margin: 0 }}>
                          {ev.description || (ev.type === "skill_check" ? "Verify your mastery of this topic pillar." : "Practical study block for this topic pillar.")}
                        </p>
                      </div>
                      
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4, gap: 10 }}>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
                          {ev.durationMins} mins
                        </span>
                        {ev.inProgress ? (
                          <button
                            onClick={() => undismissTask(ev.id)}
                            style={{
                              padding: "4px 8px",
                              borderRadius: "var(--radius-sm)",
                              background: "var(--accent)",
                              color: "#fff",
                              border: "none",
                              cursor: "pointer",
                              fontSize: 10,
                              fontWeight: 600,
                              display: "flex",
                              alignItems: "center",
                              gap: 3
                            }}
                          >
                            <Play size={8} fill="#fff" /> Resume
                          </button>
                        ) : (
                          <span style={{ fontSize: 10.5, color: "var(--text-muted)", fontStyle: "italic" }}>
                            Drag to date
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
