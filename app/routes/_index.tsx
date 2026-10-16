import {
  callAction,
  useActionMutation,
  useActionQuery,
  useSession,
  signOut,
} from "@agent-native/core/client/hooks";
import {
  IconActivity,
  IconAlertCircle,
  IconArrowDownRight,
  IconArrowUpRight,
  IconBuildingFactory2,
  IconBuilding,
  IconChevronDown,
  IconChevronRight,
  IconClock,
  IconDownload,
  IconFilter,
  IconPlus,
  IconPencil,
  IconTrash,
  IconLayoutDashboard,
  IconLogout,
  IconMap2,
  IconMaximize,
  IconMenu2,
  IconSearch,
  IconSettings,
  IconUsers,
} from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";

export function meta() {
  return [
    { title: "APRC | FAFS Progress" },
    {
      name: "description",
      content: "Fire alarm system implementation progress monitoring",
    },
  ];
}

type ProgressEntry = {
  id: string;
  name: string;
  weight: string;
  progress: number;
  contribution: number;
  updatedAt: string | null;
  updatedBy: string | null;
};
type MapPoint = { x: number; y: number };
type Building = {
  id: string;
  buildingNumber: string;
  name: string;
  manualStatus: string | null;
  statusReason: string;
  relativeWeight: string;
  progress: number;
  geometry: { points: MapPoint[] } | null;
  activities: ProgressEntry[];
};
type Activity = { id: string; name: string; weight: string; progress: number };
type HistoryEntry = {
  id: string;
  buildingId: string;
  activityId: string;
  buildingNumber: string;
  buildingName: string;
  activityName: string;
  previousProgress: string;
  newProgress: string;
  changedAt: string;
  changedBy: string;
  note: string;
};
type SiteMapInfo = { filename: string; contentType: string; updatedAt: string };
type DashboardData = {
  overall: number;
  userRole: string | null;
  siteMap: SiteMapInfo | null;
  buildings: Building[];
  activeCount: number;
  removedCount: number;
  holdCount: number;
  delayedCount: number;
  completedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  activities: Activity[];
  history: HistoryEntry[];
};
type ManagedUser = {
  username: string;
  displayName: string;
  role: string;
  active: boolean;
  createdAt: string;
};
type CreateUserInput = {
  username: string;
  displayName: string;
  role: "Supervisor" | "Viewer";
};
type DeactivateUserInput = { username: string };
type SaveBuildingInput = {
  buildingId?: string;
  buildingNumber: string;
  name: string;
  manualStatus: string | null;
  statusReason: string;
  relativeWeight: number;
};
type DeleteBuildingInput = { buildingId: string };
type SavePolygonInput = { buildingId: string; points: MapPoint[] | null };
type UpdateInput = {
  buildingId: string;
  activityId: string;
  progress: number;
  note?: string;
};
type UpdateActivityWeightInput = {
  weights: { activityId: string; weight: number }[];
};

const navItems = [
  { label: "Dashboard", icon: IconLayoutDashboard },
  { label: "Site map", icon: IconMap2 },
  { label: "Buildings", icon: IconBuilding },
  { label: "Activities", icon: IconActivity },
  { label: "Reports", icon: IconDownload },
  { label: "Progress history", icon: IconClock },
];

const pct = (value: number) => `${value.toFixed(1)}%`;
const isRemoved = (building: Building) =>
  building.manualStatus === "Removed from scope";
const buildingStatus = (building: Building) =>
  building.manualStatus ??
  (building.progress >= 99.99
    ? "Finished"
    : building.progress > 0
      ? "In progress"
      : "Not started");
const polygonColors: Record<string, { fill: string; stroke: string }> = {
  Finished: { fill: "rgba(16,185,129,0.2)", stroke: "#059669" },
  "In progress": { fill: "rgba(245,158,11,0.22)", stroke: "#d97706" },
  "Not started": { fill: "rgba(100,116,139,0.2)", stroke: "#64748b" },
  "Removed from scope": { fill: "rgba(71,85,105,0.2)", stroke: "#475569" },
  Hold: { fill: "rgba(245,158,11,0.18)", stroke: "#b45309" },
  Delayed: { fill: "rgba(239,68,68,0.18)", stroke: "#dc2626" },
};
const polygonPoints = (points: MapPoint[]) =>
  points.map(({ x, y }) => `${x},${y}`).join(" ");

export default function HomeRoute() {
  const [view, setView] = useState("Dashboard");
  const [selected, setSelected] = useState<Building | null>(null);
  const [search, setSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [updateActivity, setUpdateActivity] = useState("");
  const [updateValue, setUpdateValue] = useState("");
  const [updateNote, setUpdateNote] = useState("");
  const [feedback, setFeedback] = useState("");
  const [buildingEditor, setBuildingEditor] = useState<Building | "new" | null>(
    null,
  );
  const [buildingNumberDraft, setBuildingNumberDraft] = useState("");
  const [buildingNameDraft, setBuildingNameDraft] = useState("");
  const [buildingStatusDraft, setBuildingStatusDraft] = useState("");
  const [buildingReasonDraft, setBuildingReasonDraft] = useState("");
  const [buildingWeightDraft, setBuildingWeightDraft] = useState("1");
  const [buildingFeedback, setBuildingFeedback] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"Supervisor" | "Viewer">(
    "Supervisor",
  );
  const [userFeedback, setUserFeedback] = useState("");
  const [bootstrapStatus, setBootstrapStatus] = useState<
    "loading" | "error" | "setup" | "ready"
  >("loading");
  const [firstManagerPending, setFirstManagerPending] = useState(false);
  const [firstManagerFeedback, setFirstManagerFeedback] = useState("");
  const [activityWeightDrafts, setActivityWeightDrafts] = useState<
    Record<string, string>
  >({});
  const [activityWeightFeedback, setActivityWeightFeedback] = useState("");
  const [activityWeightEditing, setActivityWeightEditing] = useState(false);
  const [mapFile, setMapFile] = useState<File | null>(null);
  const [mapFeedback, setMapFeedback] = useState("");
  const [mapUploading, setMapUploading] = useState(false);
  const [selectedMapBuildingId, setSelectedMapBuildingId] = useState("");
  const [mapDrawing, setMapDrawing] = useState(false);
  const [draftPolygon, setDraftPolygon] = useState<MapPoint[]>([]);
  const [mapZoom, setMapZoom] = useState(100);
  const [mapPanMode, setMapPanMode] = useState(false);
  const [mapDragging, setMapDragging] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const mapViewportRef = useRef<HTMLDivElement>(null);
  const mapPanStart = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  useEffect(() => {
    if (!mapFullscreen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMapFullscreen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mapFullscreen]);
  useEffect(() => {
    const viewport = mapViewportRef.current;
    if (!viewport || view !== "Site map") return;
    const zoomWithWheel = (event: WheelEvent) => {
      const nextZoom = Math.min(
        600,
        Math.max(100, mapZoom + (event.deltaY < 0 ? 25 : -25)),
      );
      if (nextZoom === mapZoom) return;
      event.preventDefault();
      const bounds = viewport.getBoundingClientRect();
      const localX = event.clientX - bounds.left;
      const localY = event.clientY - bounds.top;
      const scale = nextZoom / mapZoom;
      const nextLeft = (viewport.scrollLeft + localX) * scale - localX;
      const nextTop = (viewport.scrollTop + localY) * scale - localY;
      setMapZoom(nextZoom);
      requestAnimationFrame(() => {
        viewport.scrollLeft = nextLeft;
        viewport.scrollTop = nextTop;
      });
    };
    viewport.addEventListener("wheel", zoomWithWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", zoomWithWheel);
  }, [mapZoom, view]);
  const session = useSession();
  const dashboard = useActionQuery<DashboardData>(
    "get-project-dashboard",
    {},
    {
      enabled:
        bootstrapStatus === "ready" && session.status === "authenticated",
    },
  );
  const managedUsers = useActionQuery<ManagedUser[]>(
    "list-project-users",
    {},
    { enabled: dashboard.data?.userRole === "Site Manager" },
  );
  const createUserMutation = useActionMutation<
    unknown,
    CreateUserInput,
    "register-project-user"
  >("register-project-user", {
    onSuccess: () => {
      setNewUsername("");
      setNewDisplayName("");
      setNewUserPassword("");
      setUserFeedback("Account created.");
    },
    onError: (error) => setUserFeedback(error.message),
  });
  const deactivateUserMutation = useActionMutation<
    unknown,
    DeactivateUserInput,
    "deactivate-project-user"
  >("deactivate-project-user", {
    onSuccess: (_result, variables) =>
      setUserFeedback(`${variables.username} was deactivated.`),
    onError: (error) => setUserFeedback(error.message),
  });
  const savePolygonMutation = useActionMutation<
    unknown,
    SavePolygonInput,
    "save-building-map-polygon"
  >("save-building-map-polygon", {
    onSuccess: (_result, variables) => {
      setMapDrawing(false);
      setDraftPolygon([]);
      setMapFeedback(variables.points ? "Polygon saved." : "Polygon cleared.");
    },
    onError: (error) => setMapFeedback(error.message),
  });
  const saveBuildingMutation = useActionMutation<
    unknown,
    SaveBuildingInput,
    "save-project-building"
  >("save-project-building", {
    onSuccess: async () => {
      await dashboard.refetch();
      setBuildingEditor(null);
      setBuildingFeedback("");
    },
    onError: (error) => setBuildingFeedback(error.message),
  });
  const deleteBuildingMutation = useActionMutation<
    unknown,
    DeleteBuildingInput,
    "delete-project-building"
  >("delete-project-building", {
    onSuccess: () => {
      void dashboard.refetch();
    },
    onError: (error) => setBuildingFeedback(error.message),
  });
  const updateActivityWeightMutation = useActionMutation<
    unknown,
    UpdateActivityWeightInput,
    "update-activity-weight"
  >("update-activity-weight", {
    onSuccess: (_result, variables) => {
      void dashboard.refetch();
      setActivityWeightEditing(false);
      setActivityWeightDrafts({});
      setActivityWeightFeedback("Activity weights saved.");
    },
    onError: (error) => setActivityWeightFeedback(error.message),
  });
  const updateMutation = useActionMutation<
    unknown,
    UpdateInput,
    "update-activity-progress"
  >("update-activity-progress", {
    onSuccess: (_result, variables) => {
      setSelected((current) => {
        if (!current || current.id !== variables.buildingId) return current;
        const activities = current.activities.map((activity) =>
          activity.id === variables.activityId
            ? {
                ...activity,
                progress: variables.progress,
                contribution:
                  (variables.progress * Number(activity.weight)) / 100,
                updatedAt: new Date().toISOString(),
              }
            : activity,
        );
        return {
          ...current,
          activities,
          progress: activities.reduce(
            (sum, activity) => sum + activity.contribution,
            0,
          ),
        };
      });
      setFeedback("Progress saved and project totals recalculated.");
      setUpdateNote("");
    },
    onError: (error) => setFeedback(error.message),
  });
  const data = dashboard.data;
  useEffect(() => {
    let active = true;
    fetch("/setup-status", { credentials: "include" })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((result: { needsSetup?: unknown }) => {
        if (!active || typeof result.needsSetup !== "boolean") return;
        setBootstrapStatus(result.needsSetup ? "setup" : "ready");
      })
      .catch(() => {
        if (active) setBootstrapStatus("error");
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (bootstrapStatus === "ready" && session.status === "unauthenticated") {
      window.location.replace("/sign-in");
    }
  }, [bootstrapStatus, session.status]);
  const selectedMapBuilding =
    data?.buildings.find((building) => building.id === selectedMapBuildingId) ??
    null;
  const filtered = useMemo(
    () =>
      (data?.buildings ?? []).filter((building) =>
        `${building.buildingNumber} ${building.name} ${buildingStatus(building)} ${building.statusReason}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [data?.buildings, search],
  );
  const filteredActive = filtered.filter((building) => !isRemoved(building));
  const activeActivityProgress = (activityId: string) => {
    const buildings =
      data?.buildings.filter((building) => !isRemoved(building)) ?? [];
    return buildings.length
      ? buildings.reduce(
          (sum, building) =>
            sum +
            (building.activities.find((activity) => activity.id === activityId)
              ?.progress ?? 0),
          0,
        ) / buildings.length
      : 0;
  };

  function startBuildingEditor(building?: Building) {
    setBuildingEditor(building ?? "new");
    setBuildingNumberDraft(building?.buildingNumber ?? "");
    setBuildingNameDraft(building?.name ?? "");
    setBuildingStatusDraft(building?.manualStatus ?? "");
    setBuildingReasonDraft(building?.statusReason ?? "");
    setBuildingWeightDraft(
      building ? String(Number(building.relativeWeight)) : "1",
    );
    setBuildingFeedback("");
  }

  function saveBuilding(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const relativeWeight = Number(buildingWeightDraft);
    if (!Number.isFinite(relativeWeight) || relativeWeight <= 0) {
      setBuildingFeedback("Relative weight must be greater than zero.");
      return;
    }
    if (
      ["Hold", "Delayed"].includes(buildingStatusDraft) &&
      !buildingReasonDraft.trim()
    ) {
      setBuildingFeedback(
        "A reason is required for Hold and Delayed statuses.",
      );
      return;
    }
    saveBuildingMutation.mutate({
      ...(buildingEditor !== "new" && buildingEditor
        ? { buildingId: buildingEditor.id }
        : {}),
      buildingNumber: buildingNumberDraft.trim(),
      name: buildingNameDraft.trim(),
      manualStatus: buildingStatusDraft || null,
      statusReason: buildingReasonDraft.trim(),
      relativeWeight,
    });
  }

  function deleteBuilding(building: Building) {
    if (
      window.confirm(
        `Permanently delete ${building.buildingNumber} · ${building.name} and all linked progress/history? This cannot be undone.`,
      )
    ) {
      setBuildingFeedback("");
      deleteBuildingMutation.mutate({ buildingId: building.id });
    }
  }

  function openBuilding(building: Building) {
    setSelected(building);
    setUpdateActivity(building.activities[0]?.id ?? "");
    setUpdateValue(String(building.activities[0]?.progress ?? 0));
    setFeedback("");
  }

  function startActivityWeightEditing() {
    if (!data) return;
    setActivityWeightDrafts(
      Object.fromEntries(
        data.activities.map((activity) => [
          activity.id,
          String(Number(activity.weight)),
        ]),
      ),
    );
    setActivityWeightEditing(true);
    setActivityWeightFeedback("");
  }

  function saveActivityWeights() {
    if (!data) return;
    const weights = data.activities.map((activity) => ({
      activityId: activity.id,
      weight: Number(activityWeightDrafts[activity.id]),
    }));
    if (
      weights.some(
        ({ weight }) => !Number.isFinite(weight) || weight < 0 || weight > 100,
      )
    ) {
      setActivityWeightFeedback(
        "Enter a weight from 0 to 100% for every activity.",
      );
      return;
    }
    const total = weights.reduce((sum, { weight }) => sum + weight, 0);
    if (Math.round(total * 10) !== 1000) {
      setActivityWeightFeedback(
        `Activity weights must total 100%. Current total: ${Number(total.toFixed(1))}%.`,
      );
      return;
    }
    setActivityWeightFeedback("");
    updateActivityWeightMutation.mutate({ weights });
  }

  function saveProgress() {
    if (!selected || !updateActivity || updateValue === "") return;
    updateMutation.mutate({
      buildingId: selected.id,
      activityId: updateActivity,
      progress: Number(updateValue),
      note: updateNote,
    });
  }

  function deactivateUser(username: string) {
    if (
      window.confirm(
        `Deactivate ${username}? They will no longer be able to use this project.`,
      )
    ) {
      setUserFeedback("");
      deactivateUserMutation.mutate({ username });
    }
  }

  async function uploadSiteMap(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mapFile) return;
    if (mapFile.size > 16 * 1024 * 1024) {
      setMapFeedback("The site map must be 16 MB or smaller.");
      return;
    }
    const form = event.currentTarget;
    const body = new FormData();
    body.append("map", mapFile);
    setMapUploading(true);
    setMapFeedback("");
    try {
      const response = await fetch("/site-map", {
        method: "POST",
        credentials: "include",
        body,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.statusMessage ||
            result.message ||
            "Unable to upload the site map.",
        );
      await dashboard.refetch();
      setMapFile(null);
      setSelectedMapBuildingId("");
      setDraftPolygon([]);
      setMapDrawing(false);
      setMapFeedback("Site map uploaded and saved.");
      form.reset();
    } catch (error) {
      setMapFeedback(
        error instanceof Error
          ? error.message
          : "Unable to upload the site map.",
      );
    } finally {
      setMapUploading(false);
    }
  }

  function startMapPan(event: React.PointerEvent<HTMLDivElement>) {
    const viewport = mapViewportRef.current;
    if (
      (!mapPanMode && event.button !== 1) ||
      (mapPanMode && event.button !== 0) ||
      !viewport
    )
      return;
    event.preventDefault();
    mapPanStart.current = {
      x: event.clientX,
      y: event.clientY,
      left: viewport.scrollLeft,
      top: viewport.scrollTop,
    };
    setMapDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveMapPan(event: React.PointerEvent<HTMLDivElement>) {
    const viewport = mapViewportRef.current;
    const start = mapPanStart.current;
    if (!viewport || !start) return;
    viewport.scrollLeft = start.left - (event.clientX - start.x);
    viewport.scrollTop = start.top - (event.clientY - start.y);
  }

  function stopMapPan() {
    mapPanStart.current = null;
    setMapDragging(false);
  }

  function assignBuildingOnMap(building: Building) {
    setSelected(null);
    setView("Site map");
    setSelectedMapBuildingId(building.id);
    setDraftPolygon([]);
    setMapDrawing(true);
    setMapFeedback("");
  }

  function selectMapBuilding(buildingId: string) {
    setSelectedMapBuildingId(buildingId);
    setDraftPolygon([]);
    setMapDrawing(false);
    setMapFeedback("");
  }

  function addPolygonPoint(event: React.MouseEvent<HTMLDivElement>) {
    if (
      event.button !== 0 ||
      mapPanMode ||
      !mapDrawing ||
      !selectedMapBuilding ||
      data?.userRole !== "Site Manager"
    )
      return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const point = {
      x: Math.min(
        100,
        Math.max(0, ((event.clientX - bounds.left) / bounds.width) * 100),
      ),
      y: Math.min(
        100,
        Math.max(0, ((event.clientY - bounds.top) / bounds.height) * 100),
      ),
    };
    setDraftPolygon((points) => [...points, point]);
  }

  function saveDraftPolygon() {
    if (!selectedMapBuilding || draftPolygon.length < 3) return;
    savePolygonMutation.mutate({
      buildingId: selectedMapBuilding.id,
      points: draftPolygon,
    });
  }

  function clearSelectedPolygon() {
    if (!selectedMapBuilding?.geometry?.points.length) return;
    savePolygonMutation.mutate({
      buildingId: selectedMapBuilding.id,
      points: null,
    });
  }

  async function createManagedUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUserFeedback("");
    try {
      const response = await fetch("/_agent-native/auth/register", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: `${newUsername.toLowerCase()}@aprc.invalid`,
          name: newDisplayName,
          password: newUserPassword,
          callbackURL: "/",
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok)
        throw new Error(
          "Unable to create account. Check the username and password.",
        );
      createUserMutation.mutate({
        username: newUsername,
        displayName: newDisplayName,
        role: newUserRole,
      });
    } catch (error) {
      setUserFeedback(
        error instanceof Error ? error.message : "Unable to create account.",
      );
    }
  }

  async function createFirstManager(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFirstManagerPending(true);
    setFirstManagerFeedback("");
    const username = newUsername.trim().toLowerCase();
    const displayName = newDisplayName.trim();
    const email = `${username}@aprc.invalid`;
    async function postAuth(path: string) {
      const response = await fetch(path, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          name: displayName,
          password: newUserPassword,
        }),
      });
      const result = await response.json().catch(() => null);
      return response.ok && result?.ok === true;
    }
    try {
      await postAuth("/_agent-native/auth/register").catch(() => false);
      const signedIn = await postAuth("/_agent-native/auth/login");
      if (!signedIn)
        throw new Error(
          "Could not create or sign in to this account. Check the username and password, then try again.",
        );
      await callAction("complete-first-manager", { username, displayName });
      window.location.assign("/");
    } catch {
      setFirstManagerFeedback(
        "Setup could not be completed. If this account was already created, retry with its original password; otherwise check the required fields.",
      );
      setFirstManagerPending(false);
    }
  }

  async function retrySetupStatus() {
    setBootstrapStatus("loading");
    try {
      const response = await fetch("/setup-status", { credentials: "include" });
      if (!response.ok) throw new Error();
      const result: { needsSetup?: unknown } = await response.json();
      if (typeof result.needsSetup !== "boolean") throw new Error();
      setBootstrapStatus(result.needsSetup ? "setup" : "ready");
    } catch {
      setBootstrapStatus("error");
    }
  }

  if (bootstrapStatus === "loading")
    return (
      <div className="grid min-h-screen place-items-center bg-[#f4f6f8] p-6 text-sm text-slate-500">
        Checking project setup…
      </div>
    );
  if (bootstrapStatus === "error")
    return (
      <div className="grid min-h-screen place-items-center bg-[#f4f6f8] p-6">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-bold text-[#142636]">
            Setup status unavailable
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            We couldn’t check whether a Site Manager has been created.
          </p>
          <button
            onClick={() => void retrySetupStatus()}
            className="mt-5 rounded-lg bg-[#142b3c] px-4 py-2 text-sm font-semibold text-white"
          >
            Retry
          </button>
        </div>
      </div>
    );
  if (bootstrapStatus === "setup")
    return (
      <div className="min-h-screen bg-[#f4f6f8] text-slate-900">
        <header className="flex h-[70px] items-center border-b border-slate-200 bg-white px-5 md:px-8">
          <div className="text-[13px] text-slate-400">
            Project /{" "}
            <span className="font-semibold text-slate-700">Settings</span>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs font-semibold text-emerald-700">
            <IconSettings size={16} />
            User management
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-10 md:px-8">
          <div className="mb-6">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-700">
              <span className="h-px w-5 bg-amber-500" />
              Project settings
            </div>
            <h1 className="text-[26px] font-bold tracking-[-0.035em] text-[#142636]">
              Settings
            </h1>
          </div>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
            <h2 className="text-base font-bold text-[#1c3041]">
              User management
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Create the first Site Manager account to secure this workspace. No
              sign-in is needed yet.
            </p>
            <form
              onSubmit={createFirstManager}
              className="mt-6 grid gap-4 sm:grid-cols-2"
            >
              <label className="text-xs font-semibold text-slate-600">
                Username
                <input
                  required
                  minLength={3}
                  maxLength={32}
                  pattern="[A-Za-z0-9._-]+"
                  value={newUsername}
                  onChange={(event) => setNewUsername(event.target.value)}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#7993a6] focus:ring-2 focus:ring-[#cad7df]"
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Display name
                <input
                  required
                  maxLength={100}
                  value={newDisplayName}
                  onChange={(event) => setNewDisplayName(event.target.value)}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#7993a6] focus:ring-2 focus:ring-[#cad7df]"
                />
              </label>
              <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
                Initial password
                <input
                  required
                  minLength={8}
                  type="password"
                  autoComplete="new-password"
                  value={newUserPassword}
                  onChange={(event) => setNewUserPassword(event.target.value)}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#7993a6] focus:ring-2 focus:ring-[#cad7df]"
                />
              </label>
              <div className="sm:col-span-2">
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Role{" "}
                  <strong className="ml-2 text-[#1c3041]">Site Manager</strong>
                </div>
                {firstManagerFeedback && (
                  <p role="alert" className="mt-3 text-sm text-rose-700">
                    {firstManagerFeedback}
                  </p>
                )}
                <button
                  disabled={firstManagerPending}
                  className="mt-4 rounded-lg bg-[#142b3c] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {firstManagerPending
                    ? "Creating account…"
                    : "Create Site Manager account"}
                </button>
              </div>
            </form>
          </section>
        </main>
      </div>
    );
  if (session.status !== "authenticated")
    return (
      <div className="grid min-h-screen place-items-center bg-[#f4f6f8] p-6 text-sm text-slate-500">
        Checking sign-in…
      </div>
    );

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-slate-900 lg:flex">
      <aside
        className={`${mobileOpen ? "fixed inset-0 z-40 flex" : "hidden"} lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[248px] lg:shrink-0`}
      >
        <div className="flex h-full w-[248px] flex-col bg-[#101e2b] text-slate-300 shadow-xl lg:shadow-none">
          <div className="flex h-[78px] items-center gap-3 border-b border-white/10 px-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-[#132330]">
              <IconBuildingFactory2 size={22} stroke={1.8} />
            </div>
            <div>
              <div className="text-[14px] font-bold tracking-[0.1em] text-white">
                APRC
              </div>
              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                Project Control
              </div>
            </div>
            <button
              className="ml-auto rounded-md p-1 text-slate-400 lg:hidden"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              ×
            </button>
          </div>
          <div className="px-4 pt-6 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Fire &amp; safety systems
          </div>
          <nav className="space-y-1 px-3">
            {navItems.map(({ label, icon: Icon }) => {
              const active = view === label;
              return (
                <button
                  key={label}
                  onClick={() => {
                    setView(label);
                    setMobileOpen(false);
                    setSelected(null);
                  }}
                  className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition-colors ${active ? "bg-[#213648] text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"}`}
                >
                  <Icon
                    size={17}
                    stroke={1.8}
                    className={
                      active
                        ? "text-amber-400"
                        : "text-slate-500 group-hover:text-slate-300"
                    }
                  />
                  {label}
                  {label === "Dashboard" && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-amber-400" />
                  )}
                </button>
              );
            })}
          </nav>
          <div className="mt-auto border-t border-white/10 p-4">
            <button
              onClick={() => {
                setView("Settings");
                setSelected(null);
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium ${view === "Settings" ? "bg-[#213648] text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
            >
              <IconSettings size={17} />
              Settings
            </button>
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/[0.06] p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-600 text-[11px] font-bold text-white">
                AP
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-white">
                  Project workspace
                </div>
                <div className="mt-0.5 text-[10px] text-slate-400">
                  APRC • Alexandria
                </div>
              </div>
              <IconChevronDown size={14} className="ml-auto text-slate-500" />
            </div>
            <button
              onClick={() => void signOut()}
              className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[12px] font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              <IconLogout size={16} />
              Sign out
            </button>
          </div>
        </div>
        <button
          className="flex-1 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      </aside>

      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-[70px] items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Open navigation"
            >
              <IconMenu2 size={19} />
            </button>
            <div className="text-[13px] text-slate-400">
              Project /{" "}
              <span className="font-semibold text-slate-700">{view}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              LIVE PROJECT
            </div>
            <div className="hidden text-right sm:block">
              <div className="text-xs font-semibold text-slate-700">
                Amreya Refinery
              </div>
              <div className="text-[10px] text-slate-400">
                FAFS implementation
              </div>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#dbe4eb] text-[10px] font-bold text-[#243849]">
              AR
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] px-4 py-7 md:px-8 md:py-9">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-700">
                <span className="h-px w-5 bg-amber-500" />
                Amreya Petroleum Refining Company
              </div>
              <h1 className="text-[26px] font-bold tracking-[-0.035em] text-[#142636] md:text-[30px]">
                {view === "Dashboard" ? "FAFS project overview" : view}
              </h1>
              <p className="mt-1.5 text-[13px] text-slate-500">
                Fire alarm &amp; firefighting alarm system implementation
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setView("Reports")}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                <IconDownload size={15} />
                Export report
              </button>
              <button
                onClick={() => setView("Buildings")}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#142b3c] px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1d3b50]"
              >
                <IconBuilding size={15} />
                Buildings
              </button>
            </div>
          </div>

          {dashboard.isLoading && (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              Loading project records…
            </div>
          )}
          {dashboard.isError && (
            <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
              <IconAlertCircle size={18} />
              Project data could not be loaded. Sign in with an authorized
              project account and retry.
            </div>
          )}
          {data && (
            <>
              {view === "Dashboard" && (
                <>
                  <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="relative overflow-hidden rounded-xl bg-[#142b3c] p-5 text-white shadow-[0_4px_16px_rgba(20,43,60,0.12)]">
                      <div className="absolute -right-5 -top-10 h-32 w-32 rounded-full border-[18px] border-white/[0.04]" />
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-300">
                          Overall completion
                        </span>
                        <IconActivity size={17} className="text-amber-400" />
                      </div>
                      <div className="mt-5 flex items-end gap-2">
                        <strong className="text-[36px] leading-none tracking-[-0.04em]">
                          {pct(data.overall)}
                        </strong>
                        <span className="mb-1 inline-flex items-center gap-1 text-[11px] text-emerald-300">
                          <IconArrowUpRight size={14} />
                          Current
                        </span>
                      </div>
                      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/15">
                        <div
                          className="h-full rounded-full bg-amber-400"
                          style={{
                            width: `${Math.max(0, Math.min(100, data.overall))}%`,
                          }}
                        />
                      </div>
                      <div className="mt-2 flex justify-between text-[10px] text-slate-400">
                        <span>Active scope</span>
                        <span>{data.activeCount} buildings</span>
                      </div>
                    </div>
                    <SummaryCard
                      label="Active buildings"
                      value={String(data.activeCount)}
                      detail={`${data.completedCount} completed`}
                      icon={<IconBuilding size={17} />}
                      tone="blue"
                    />
                    <SummaryCard
                      label="In progress"
                      value={String(data.inProgressCount)}
                      detail={`${data.notStartedCount} not started`}
                      icon={<IconActivity size={17} />}
                      tone="amber"
                    />
                    <SummaryCard
                      label="Removed from scope"
                      value={String(data.removedCount)}
                      detail="Preserved • excluded from totals"
                      icon={<IconArrowDownRight size={17} />}
                      tone="slate"
                    />
                  </section>

                  <section className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(17,33,49,0.025)] md:p-6">
                      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h2 className="text-[14px] font-bold text-[#1c3041]">
                            Activity progress
                          </h2>
                          <p className="mt-1 text-[11px] text-slate-400">
                            Average completion across active buildings
                          </p>
                        </div>
                        <button
                          onClick={() => setView("Activities")}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#335a72] hover:text-amber-700"
                        >
                          View activities <IconChevronRight size={14} />
                        </button>
                      </div>
                      <div className="space-y-[18px]">
                        {data.activities.map((activity) => (
                          <div key={activity.id}>
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <span className="truncate pr-4 text-[12px] font-medium text-slate-700">
                                {activity.name}
                              </span>
                              <span className="shrink-0 text-[11px] font-semibold tabular-nums text-slate-600">
                                {pct(activeActivityProgress(activity.id))}
                                <span className="ml-2 font-normal text-slate-400">
                                  {Number(activity.weight)}%
                                </span>
                              </span>
                            </div>
                            <ProgressBar
                              value={activeActivityProgress(activity.id)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(17,33,49,0.025)] md:p-6">
                      <div className="mb-5 flex items-center justify-between">
                        <div>
                          <h2 className="text-[14px] font-bold text-[#1c3041]">
                            Building status
                          </h2>
                          <p className="mt-1 text-[11px] text-slate-400">
                            Active project scope
                          </p>
                        </div>
                        <IconFilter size={16} className="text-slate-400" />
                      </div>
                      <div className="space-y-4">
                        {[
                          ["Finished", data.completedCount, "bg-emerald-500"],
                          ["In progress", data.inProgressCount, "bg-amber-500"],
                          ["Not started", data.notStartedCount, "bg-slate-300"],
                          ["Hold", data.holdCount, "bg-yellow-700"],
                          ["Delayed", data.delayedCount, "bg-red-600"],
                        ].map(([label, count, color]) => (
                          <div
                            key={String(label)}
                            className="flex items-center gap-3"
                          >
                            <span className={`h-2 w-2 rounded-full ${color}`} />
                            <span className="flex-1 text-xs text-slate-600">
                              {label}
                            </span>
                            <span className="text-xs font-bold tabular-nums text-slate-700">
                              {count}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-6 flex h-2 overflow-hidden rounded-full bg-slate-100">
                        {data.activeCount > 0 && (
                          <>
                            <div
                              className="bg-emerald-500"
                              style={{
                                width: `${(data.completedCount / data.activeCount) * 100}%`,
                              }}
                            />
                            <div
                              className="bg-amber-500"
                              style={{
                                width: `${(data.inProgressCount / data.activeCount) * 100}%`,
                              }}
                            />
                            <div
                              className="bg-slate-300"
                              style={{
                                width: `${(data.notStartedCount / data.activeCount) * 100}%`,
                              }}
                            />
                          </>
                        )}
                      </div>
                      <div className="mt-6 border-t border-slate-100 pt-4">
                        <h3 className="mb-3 text-[11px] font-semibold text-slate-500">
                          RECENTLY UPDATED
                        </h3>
                        {data.history.length === 0 ? (
                          <div className="text-xs text-slate-400">
                            No progress updates recorded yet.
                          </div>
                        ) : (
                          data.history.slice(0, 3).map((item) => (
                            <div
                              key={item.id}
                              className="mb-3 flex items-start justify-between gap-3 last:mb-0"
                            >
                              <div className="min-w-0">
                                <button
                                  className="truncate text-left text-xs font-semibold text-[#29475d] hover:underline"
                                  onClick={() => {
                                    const building = data.buildings.find(
                                      (entry) => entry.id === item.buildingId,
                                    );
                                    if (building) openBuilding(building);
                                  }}
                                >
                                  {item.buildingNumber} · {item.buildingName}
                                </button>
                                <div className="mt-1 truncate text-[10px] text-slate-400">
                                  {item.activityName} · {item.changedBy}
                                </div>
                              </div>
                              <span className="shrink-0 text-[10px] text-slate-400">
                                {dateText(item.changedAt)}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </section>

                  <section className="mt-5 rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(17,33,49,0.025)]">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 md:px-6">
                      <div>
                        <h2 className="text-[14px] font-bold text-[#1c3041]">
                          Building progress
                        </h2>
                        <p className="mt-1 text-[11px] text-slate-400">
                          Latest status across the project
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="relative">
                          <IconSearch
                            size={15}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                          />
                          <input
                            className="h-8 w-[190px] rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none placeholder:text-slate-400 focus:border-[#7993a6] focus:ring-2 focus:ring-[#cad7df]"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search buildings"
                          />
                        </label>
                        <button
                          onClick={() => setView("Buildings")}
                          className="hidden rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 sm:inline-flex"
                        >
                          All buildings
                        </button>
                      </div>
                    </div>
                    <BuildingTable
                      buildings={filtered.slice(0, 6)}
                      onOpen={openBuilding}
                      onAssignOnMap={
                        dashboard.data?.userRole === "Site Manager"
                          ? assignBuildingOnMap
                          : undefined
                      }
                    />
                  </section>
                </>
              )}

              {view === "Buildings" && (
                <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
                    <h2 className="text-sm font-bold text-[#1c3041]">
                      All buildings{" "}
                      <span className="ml-2 text-xs font-medium text-slate-400">
                        {filtered.length}
                      </span>
                    </h2>
                    <div className="flex items-center gap-3">
                      <label className="relative">
                        <IconSearch
                          size={15}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                          className="h-9 w-56 rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-slate-400"
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder="Search number, name, type"
                        />
                      </label>
                      {data.userRole === "Site Manager" && (
                        <button
                          onClick={() => startBuildingEditor()}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#142b3c] px-3 text-xs font-semibold text-white hover:bg-[#1d3b50]"
                        >
                          <IconPlus size={15} />
                          Add building
                        </button>
                      )}
                    </div>
                  </div>
                  {buildingFeedback && (
                    <p
                      role="status"
                      className="border-b border-slate-100 px-5 py-2 text-xs text-slate-600"
                    >
                      {buildingFeedback}
                    </p>
                  )}
                  <BuildingTable
                    buildings={filtered}
                    onOpen={openBuilding}
                    onAssignOnMap={
                      dashboard.data?.userRole === "Site Manager"
                        ? assignBuildingOnMap
                        : undefined
                    }
                    onEdit={
                      dashboard.data?.userRole === "Site Manager"
                        ? startBuildingEditor
                        : undefined
                    }
                    onDelete={
                      dashboard.data?.userRole === "Site Manager"
                        ? deleteBuilding
                        : undefined
                    }
                  />
                </section>
              )}

              {view === "Activities" && (
                <div>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">
                      Activity weights determine each activity’s contribution to
                      building progress.
                    </p>
                    {data.userRole === "Site Manager" && (
                      <div className="flex items-center gap-2">
                        {activityWeightEditing ? (
                          <>
                            <span className="text-xs text-slate-500">
                              Total:{" "}
                              {Number(
                                data.activities
                                  .reduce(
                                    (sum, activity) =>
                                      sum +
                                      Number(
                                        activityWeightDrafts[activity.id] ??
                                          activity.weight,
                                      ),
                                    0,
                                  )
                                  .toFixed(1),
                              )}
                              %
                            </span>
                            <button
                              onClick={() => {
                                setActivityWeightEditing(false);
                                setActivityWeightDrafts({});
                                setActivityWeightFeedback("");
                              }}
                              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={saveActivityWeights}
                              disabled={updateActivityWeightMutation.isPending}
                              className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              Save all
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={startActivityWeightEditing}
                            className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {activityWeightFeedback && (
                    <p role="status" className="mb-3 text-xs text-slate-600">
                      {activityWeightFeedback}
                    </p>
                  )}
                  <div className="grid gap-4 md:grid-cols-2">
                    {data.activities.map((activity) => (
                      <div
                        key={activity.id}
                        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-bold text-[#1c3041]">
                              {activity.name}
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                              {activityWeightEditing ? (
                                <>
                                  <label
                                    htmlFor={`activity-weight-${activity.id}`}
                                  >
                                    Weight
                                  </label>
                                  <input
                                    id={`activity-weight-${activity.id}`}
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    value={
                                      activityWeightDrafts[activity.id] ??
                                      String(Number(activity.weight))
                                    }
                                    onChange={(event) =>
                                      setActivityWeightDrafts((current) => ({
                                        ...current,
                                        [activity.id]: event.target.value,
                                      }))
                                    }
                                    className="h-7 w-20 rounded-md border border-slate-200 px-2 text-xs text-slate-700 outline-none focus:border-slate-400"
                                  />
                                  <span>
                                    % · {data.activeCount} active buildings
                                  </span>
                                </>
                              ) : (
                                <span>
                                  Weight {Number(activity.weight)}% ·{" "}
                                  {data.activeCount} active buildings
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-600">
                            {pct(activeActivityProgress(activity.id))}
                          </div>
                        </div>
                        <div className="mt-5">
                          <ProgressBar
                            value={activeActivityProgress(activity.id)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {view === "Site map" && (
                <div
                  className={
                    mapFullscreen
                      ? "fixed inset-0 z-[100] flex h-screen flex-col overflow-hidden bg-slate-950"
                      : "rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-7"
                  }
                >
                  <div
                    className={
                      mapFullscreen
                        ? "hidden"
                        : "flex flex-wrap items-start justify-between gap-3"
                    }
                  >
                    <div>
                      <h2 className="text-sm font-bold text-[#1c3041]">
                        Facility map
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">
                        {data.siteMap
                          ? `Map: ${data.siteMap.filename}`
                          : "Upload an approved facility map to place buildings."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3 text-[10px] text-slate-500">
                      <Legend color="bg-emerald-500" label="Finished" />
                      <Legend color="bg-amber-500" label="In progress" />
                      <Legend color="bg-slate-300" label="Not started" />
                      <Legend color="bg-slate-500" label="Removed from scope" />
                      <Legend color="bg-yellow-700" label="Hold" />
                      <Legend color="bg-red-600" label="Delayed" />
                    </div>
                  </div>
                  {!mapFullscreen && data.userRole === "Site Manager" && (
                    <form
                      onSubmit={uploadSiteMap}
                      className="mt-4 flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 p-3"
                    >
                      <label className="min-w-[220px] flex-1 text-[11px] font-semibold text-slate-600">
                        {data.siteMap ? "Replace site map" : "Upload site map"}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(event) =>
                            setMapFile(event.target.files?.[0] ?? null)
                          }
                          className="mt-1.5 block w-full text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-700"
                        />
                      </label>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-slate-400">
                          PNG, JPEG, WebP · max 16 MB
                        </span>
                        <button
                          type="submit"
                          disabled={!mapFile || mapUploading}
                          className="rounded-lg bg-[#142b3c] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1d3b50] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {mapUploading ? "Uploading…" : "Save map"}
                        </button>
                      </div>
                    </form>
                  )}
                  {!mapFullscreen && mapFeedback && (
                    <div role="status" className="mt-3 text-xs text-slate-600">
                      {mapFeedback}
                    </div>
                  )}
                  {data.siteMap ? (
                    <>
                      <div
                        className={`mt-4 flex flex-wrap items-center gap-3 ${mapFullscreen ? "hidden" : ""}`}
                      >
                        <label className="text-[11px] font-semibold text-slate-600">
                          Select building
                          <select
                            value={selectedMapBuildingId}
                            onChange={(event) => {
                              setSelectedMapBuildingId(event.target.value);
                              setDraftPolygon([]);
                              setMapDrawing(false);
                              setMapFeedback("");
                            }}
                            className="ml-2 h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700"
                          >
                            <option value="">Select a building…</option>
                            {data.buildings.map((building) => (
                              <option key={building.id} value={building.id}>
                                {building.buildingNumber} · {building.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <span className="text-[11px] text-slate-400">
                          {data.userRole === "Site Manager"
                            ? mapPanMode
                              ? "Pan mode is on. Turn it off to draw a polygon."
                              : mapDrawing
                                ? "Click the map to add polygon vertices."
                                : selectedMapBuilding
                                  ? "Draw or clear its polygon on the map."
                                  : "Select a building to see its status and activities."
                            : "Select a building to see its status and activities."}
                        </span>
                        {data.userRole === "Site Manager" &&
                          selectedMapBuilding && (
                            <div className="flex flex-wrap gap-2">
                              {mapDrawing ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMapDrawing(false);
                                      setDraftPolygon([]);
                                    }}
                                    className="rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={saveDraftPolygon}
                                    disabled={
                                      draftPolygon.length < 3 ||
                                      savePolygonMutation.isPending
                                    }
                                    className="rounded-md bg-[#142b3c] px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40"
                                  >
                                    Finish &amp; save
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDraftPolygon([]);
                                    setMapDrawing(true);
                                    setMapFeedback("");
                                  }}
                                  className="rounded-md bg-[#142b3c] px-2.5 py-1.5 text-[11px] font-semibold text-white"
                                >
                                  Draw polygon
                                </button>
                              )}
                              {!mapDrawing &&
                              selectedMapBuilding.geometry?.points.length ? (
                                <button
                                  type="button"
                                  onClick={clearSelectedPolygon}
                                  disabled={savePolygonMutation.isPending}
                                  className="rounded-md border border-rose-200 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 disabled:opacity-40"
                                >
                                  Clear polygon
                                </button>
                              ) : null}
                            </div>
                          )}
                      </div>
                      <div
                        className={`mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-2.5 ${mapFullscreen ? "hidden" : ""}`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setMapZoom((zoom) => Math.max(100, zoom - 25))
                          }
                          disabled={mapZoom <= 100}
                          aria-label="Zoom out"
                          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-bold text-slate-700 disabled:opacity-40"
                        >
                          −
                        </button>
                        <input
                          type="range"
                          aria-label="Map zoom"
                          min="100"
                          max="600"
                          step="25"
                          value={mapZoom}
                          onChange={(event) =>
                            setMapZoom(Number(event.target.value))
                          }
                          className="w-32 accent-[#142b3c]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setMapZoom((zoom) => Math.min(600, zoom + 25))
                          }
                          disabled={mapZoom >= 600}
                          aria-label="Zoom in"
                          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-bold text-slate-700 disabled:opacity-40"
                        >
                          +
                        </button>
                        <span className="w-12 text-center text-xs font-semibold tabular-nums text-slate-600">
                          {mapZoom}%
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setMapZoom(100);
                            if (mapViewportRef.current) {
                              mapViewportRef.current.scrollLeft = 0;
                              mapViewportRef.current.scrollTop = 0;
                            }
                          }}
                          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
                        >
                          Reset
                        </button>
                        <button
                          type="button"
                          aria-pressed={mapPanMode}
                          onClick={() => setMapPanMode((enabled) => !enabled)}
                          className={`rounded-md border px-3 py-1.5 text-[11px] font-semibold ${mapPanMode ? "border-[#142b3c] bg-[#142b3c] text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"}`}
                        >
                          {mapPanMode ? "Pan: on" : "Pan tool"}
                        </button>
                        {null}
                      </div>
                      <div
                        className={`relative ${mapFullscreen ? "min-h-0 flex-1" : "mt-3 h-[72vh]"}`}
                      >
                        {selectedMapBuilding && (
                          <section
                            className="pointer-events-auto absolute right-3 top-3 z-30 max-h-[75%] w-[360px] max-w-[calc(100vw-1.5rem)] origin-top-right scale-75 overflow-y-auto rounded-lg border border-slate-200 bg-white/30 p-3 shadow-xl backdrop-blur-sm"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="text-xs font-bold text-slate-800">
                                  {selectedMapBuilding.buildingNumber} ·{" "}
                                  {selectedMapBuilding.name}
                                </div>
                                <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                                  <span
                                    className="h-2 w-2 rounded-full"
                                    style={{
                                      backgroundColor:
                                        polygonColors[
                                          buildingStatus(selectedMapBuilding)
                                        ].stroke,
                                    }}
                                  />
                                  {buildingStatus(selectedMapBuilding)}
                                  <span>·</span>
                                  {selectedMapBuilding.progress.toFixed(1)}%
                                  overall
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-2">
                              {selectedMapBuilding.activities.map(
                                (activity) => (
                                  <div key={activity.id}>
                                    <div className="mb-1 flex justify-between gap-2 text-[10px]">
                                      <span className="min-w-0 whitespace-normal break-words text-slate-700">
                                        {activity.name}
                                      </span>
                                      <span className="shrink-0 font-semibold tabular-nums text-slate-500">
                                        {activity.progress.toFixed(1)}%
                                      </span>
                                    </div>
                                    <ProgressBar value={activity.progress} />
                                  </div>
                                ),
                              )}
                            </div>
                            {mapDrawing && (
                              <div className="mt-2 text-[10px] text-slate-400">
                                Click at least 3 points on the map, then finish
                                and save.
                              </div>
                            )}
                          </section>
                        )}
                        <div
                          ref={mapViewportRef}
                          className={`absolute inset-0 overflow-auto ${mapFullscreen ? "rounded-none border-0 bg-slate-950" : "rounded-xl border border-slate-200 bg-slate-50"} ${mapDragging ? "cursor-grabbing" : mapPanMode ? "cursor-grab" : mapDrawing && data.userRole === "Site Manager" ? "cursor-crosshair" : ""}`}
                        >
                          <button
                            type="button"
                            aria-label={
                              mapFullscreen
                                ? "Exit map full screen"
                                : "Show map full screen"
                            }
                            aria-pressed={mapFullscreen}
                            onClick={() =>
                              setMapFullscreen((fullscreen) => !fullscreen)
                            }
                            className="sticky left-3 top-3 z-20 -mb-9 ml-3 mr-auto block rounded-lg bg-[#142b3c]/20 p-2 text-white opacity-20 shadow-lg hover:opacity-100"
                          >
                            <IconMaximize size={18} aria-hidden="true" />
                          </button>
                          <div
                            className="relative max-w-none shrink-0"
                            style={{ width: `${mapZoom}%` }}
                            onPointerDown={startMapPan}
                            onPointerMove={moveMapPan}
                            onPointerUp={stopMapPan}
                            onPointerCancel={stopMapPan}
                            onAuxClick={(event) => event.preventDefault()}
                            onClick={addPolygonPoint}
                          >
                            <img
                              src={`/site-map-image?v=${encodeURIComponent(data.siteMap.updatedAt)}`}
                              alt="Uploaded facility site map"
                              className="block h-auto w-full select-none"
                              draggable={false}
                            />
                            {data.buildings
                              .filter(
                                (building) =>
                                  (building.geometry?.points.length ?? 0) >= 3,
                              )
                              .map((building) => {
                                const points = building.geometry!.points;
                                const colors =
                                  polygonColors[buildingStatus(building)];
                                const minX = Math.min(
                                  ...points.map((point) => point.x),
                                );
                                const maxX = Math.max(
                                  ...points.map((point) => point.x),
                                );
                                const minY = Math.min(
                                  ...points.map((point) => point.y),
                                );
                                const maxY = Math.max(
                                  ...points.map((point) => point.y),
                                );
                                const centerX = (minX + maxX) / 2;
                                const centerY = (minY + maxY) / 2;
                                const polygonWidth = maxX - minX;
                                const polygonHeight = maxY - minY;
                                const labelWidth = Math.max(
                                  6,
                                  Math.min(36, polygonWidth * 0.82),
                                );
                                const labelHeight = Math.max(
                                  4,
                                  Math.min(18, polygonHeight * 0.68),
                                );
                                const fontSize = Math.max(
                                  0.55,
                                  Math.min(
                                    1.5,
                                    labelWidth /
                                      Math.max(8, building.name.length * 0.48),
                                    labelHeight * 0.24,
                                  ),
                                );
                                return (
                                  <svg
                                    key={building.id}
                                    viewBox="0 0 100 100"
                                    preserveAspectRatio="none"
                                    className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                                  >
                                    <polygon
                                      points={polygonPoints(points)}
                                      fill={colors.fill}
                                      stroke={colors.stroke}
                                      strokeWidth={
                                        selectedMapBuildingId === building.id
                                          ? 0.7
                                          : 0.45
                                      }
                                      vectorEffect="non-scaling-stroke"
                                      className="pointer-events-auto cursor-pointer"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        selectMapBuilding(building.id);
                                      }}
                                    />
                                    {points.map((point, index) => (
                                      <circle
                                        key={index}
                                        cx={point.x}
                                        cy={point.y}
                                        r="0.65"
                                        fill="white"
                                        stroke={colors.stroke}
                                        strokeWidth="0.25"
                                        vectorEffect="non-scaling-stroke"
                                        className="pointer-events-auto cursor-pointer"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          selectMapBuilding(building.id);
                                        }}
                                      />
                                    ))}
                                  </svg>
                                );
                              })}
                            {data.buildings
                              .filter(
                                (building) =>
                                  (building.geometry?.points.length ?? 0) >= 3,
                              )
                              .map((building) => {
                                const points = building.geometry!.points;
                                const minX = Math.min(
                                  ...points.map((point) => point.x),
                                );
                                const maxX = Math.max(
                                  ...points.map((point) => point.x),
                                );
                                const minY = Math.min(
                                  ...points.map((point) => point.y),
                                );
                                const maxY = Math.max(
                                  ...points.map((point) => point.y),
                                );
                                const colors =
                                  polygonColors[buildingStatus(building)];
                                return (
                                  <div
                                    key={`label-${building.id}`}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      selectMapBuilding(building.id);
                                    }}
                                    className="pointer-events-auto absolute z-10 -translate-x-1/2 -translate-y-1/2 overflow-hidden px-1 text-center font-bold leading-tight"
                                    style={{
                                      left: `${(minX + maxX) / 2}%`,
                                      top: `${(minY + maxY) / 2}%`,
                                      width: `${Math.max(6, Math.min(36, (maxX - minX) * 0.82))}%`,
                                      maxHeight: `${Math.max(4, Math.min(18, (maxY - minY) * 0.72))}%`,
                                      color: colors.stroke,
                                      fontSize: "clamp(8px, 0.95vw, 13px)",
                                      overflowWrap: "anywhere",
                                      textShadow:
                                        "0 0 2px rgba(255,255,255,0.95)",
                                    }}
                                  >
                                    {building.name}
                                  </div>
                                );
                              })}
                            {mapDrawing && draftPolygon.length > 0 && (
                              <svg
                                viewBox="0 0 100 100"
                                preserveAspectRatio="none"
                                className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                              >
                                <polygon
                                  points={polygonPoints(draftPolygon)}
                                  fill={
                                    draftPolygon.length >= 3
                                      ? polygonColors[
                                          buildingStatus(selectedMapBuilding!)
                                        ].fill
                                      : "none"
                                  }
                                  stroke={
                                    polygonColors[
                                      buildingStatus(selectedMapBuilding!)
                                    ].stroke
                                  }
                                  strokeWidth="0.55"
                                  vectorEffect="non-scaling-stroke"
                                />
                                {draftPolygon.map((point, index) => (
                                  <circle
                                    key={index}
                                    cx={point.x}
                                    cy={point.y}
                                    r="0.7"
                                    fill="white"
                                    stroke={
                                      polygonColors[
                                        buildingStatus(selectedMapBuilding!)
                                      ].stroke
                                    }
                                    strokeWidth="0.25"
                                    vectorEffect="non-scaling-stroke"
                                  />
                                ))}
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="mt-5 flex min-h-[300px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-[#f5f7f8] p-6">
                      <div className="max-w-md text-center">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm">
                          <IconMap2 size={22} />
                        </div>
                        <div className="text-sm font-semibold text-slate-700">
                          No site map uploaded
                        </div>
                        <p className="mt-1.5 text-xs leading-5 text-slate-500">
                          A Site Manager can upload a PNG, JPEG, or WebP
                          facility map up to 16 MB. Building locations can be
                          assigned after upload.
                        </p>
                        <button
                          type="button"
                          onClick={() => setView("Buildings")}
                          className="mt-4 rounded-lg bg-[#142b3c] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1d3b50]"
                        >
                          Browse building records
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {view === "Reports" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <ReportCard
                    title="Active buildings"
                    subtitle="Scope-filtered progress summary"
                    value={`${data.activeCount} buildings · ${pct(data.overall)} overall`}
                    onClick={() => setView("Buildings")}
                  />
                  <ReportCard
                    title="Removed from scope"
                    subtitle="Separate list; excluded from project totals"
                    value={`${data.removedCount} preserved records`}
                    onClick={() => {
                      setSearch("Removed from scope");
                      setView("Buildings");
                    }}
                  />
                  <ReportCard
                    title="Activity summary"
                    subtitle="Progress against configured activity weights"
                    value={`${data.activities.length} active activities`}
                    onClick={() => setView("Activities")}
                  />
                  <ReportCard
                    title="Update history"
                    subtitle="Recent progress changes and responsible users"
                    value={`${data.history.length} recent changes`}
                    onClick={() => setView("Progress history")}
                  />
                </div>
              )}

              {view === "Progress history" && (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 p-5">
                    <h2 className="text-sm font-bold text-[#1c3041]">
                      Progress history
                    </h2>
                    <p className="mt-1 text-xs text-slate-400">
                      Most recent recorded activity updates
                    </p>
                  </div>
                  {data.history.length ? (
                    <div className="divide-y divide-slate-100">
                      {data.history.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                        >
                          <div>
                            <div className="text-xs font-semibold text-slate-700">
                              {item.buildingNumber} · {item.buildingName}{" "}
                              <span className="font-normal text-slate-400">
                                / {item.activityName}
                              </span>
                            </div>
                            <div className="mt-1 text-[11px] text-slate-400">
                              {item.changedBy}
                              {item.note ? ` · ${item.note}` : ""}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs tabular-nums text-slate-500">
                              {Number(item.previousProgress)}%
                            </span>
                            <IconArrowUpRight
                              size={14}
                              className="text-slate-300"
                            />
                            <span className="text-xs font-bold tabular-nums text-[#29475d]">
                              {Number(item.newProgress)}%
                            </span>
                            <span className="w-20 text-right text-[10px] text-slate-400">
                              {dateText(item.changedAt)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No progress history is available yet.
                    </div>
                  )}
                </div>
              )}

              {view === "Settings" && (
                <div className="max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-5">
                    <h2 className="text-sm font-bold text-[#1c3041]">
                      Project settings
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Project configuration is read from the database.
                    </p>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {[
                      ["Project", "Amreya Petroleum Refining Company"],
                      ["System", "Fire Alarm & Firefighting Alarm System"],
                      ["Active buildings", String(data.activeCount)],
                      [
                        "Buildings removed from scope",
                        String(data.removedCount),
                      ],
                      [
                        "Configured activity weight total",
                        `${data.activities.reduce((sum, item) => sum + Number(item.weight), 0)}%`,
                      ],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="flex justify-between gap-4 py-3 text-xs"
                      >
                        <span className="text-slate-500">{label}</span>
                        <span className="text-right font-semibold text-slate-700">
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                  {data.userRole === "Site Manager" ? (
                    <div className="mt-6 border-t border-slate-100 pt-5">
                      <h3 className="text-sm font-bold text-[#1c3041]">
                        User management
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Create accounts with a username and initial password.
                        Email addresses are not required.
                      </p>
                      <form
                        onSubmit={createManagedUser}
                        className="mt-4 grid gap-3 sm:grid-cols-2"
                      >
                        <label className="text-[11px] font-semibold text-slate-600">
                          Username
                          <input
                            required
                            minLength={3}
                            maxLength={32}
                            pattern="[A-Za-z0-9._-]+"
                            value={newUsername}
                            onChange={(event) =>
                              setNewUsername(event.target.value)
                            }
                            className="mt-1 block h-10 w-full rounded-lg border border-slate-200 px-3 text-xs font-normal outline-none focus:border-[#829aaa]"
                          />
                        </label>
                        <label className="text-[11px] font-semibold text-slate-600">
                          Display name
                          <input
                            required
                            maxLength={100}
                            value={newDisplayName}
                            onChange={(event) =>
                              setNewDisplayName(event.target.value)
                            }
                            className="mt-1 block h-10 w-full rounded-lg border border-slate-200 px-3 text-xs font-normal outline-none focus:border-[#829aaa]"
                          />
                        </label>
                        <label className="text-[11px] font-semibold text-slate-600">
                          Initial password
                          <input
                            required
                            minLength={8}
                            maxLength={128}
                            type="password"
                            autoComplete="new-password"
                            value={newUserPassword}
                            onChange={(event) =>
                              setNewUserPassword(event.target.value)
                            }
                            className="mt-1 block h-10 w-full rounded-lg border border-slate-200 px-3 text-xs font-normal outline-none focus:border-[#829aaa]"
                          />
                        </label>
                        <label className="text-[11px] font-semibold text-slate-600">
                          Role
                          <select
                            value={newUserRole}
                            onChange={(event) =>
                              setNewUserRole(
                                event.target.value as "Supervisor" | "Viewer",
                              )
                            }
                            className="mt-1 block h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-normal outline-none focus:border-[#829aaa]"
                          >
                            <option>Supervisor</option>
                            <option>Viewer</option>
                          </select>
                        </label>
                        <div className="flex items-center justify-between gap-3 sm:col-span-2">
                          <span className="text-[11px] text-slate-500">
                            {userFeedback}
                          </span>
                          <button
                            disabled={
                              createUserMutation.isPending ||
                              !newUsername ||
                              !newDisplayName ||
                              !newUserPassword
                            }
                            className="rounded-lg bg-[#142b3c] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#1d3b50] disabled:opacity-50"
                          >
                            {createUserMutation.isPending
                              ? "Creating…"
                              : "Create account"}
                          </button>
                        </div>
                      </form>
                      <div className="mt-5 overflow-x-auto rounded-lg border border-slate-100">
                        <table className="w-full min-w-[520px] text-left">
                          <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
                            <tr>
                              <th className="px-3 py-2">Username</th>
                              <th className="px-3 py-2">Display name</th>
                              <th className="px-3 py-2">Role</th>
                              <th className="px-3 py-2">Status</th>
                              <th className="px-3 py-2">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(managedUsers.data ?? []).map((user) => (
                              <tr key={user.username} className="text-xs">
                                <td className="px-3 py-2.5 font-semibold text-slate-700">
                                  {user.username}
                                </td>
                                <td className="px-3 py-2.5 text-slate-600">
                                  {user.displayName}
                                </td>
                                <td className="px-3 py-2.5 text-slate-600">
                                  {user.role}
                                </td>
                                <td className="px-3 py-2.5 text-slate-500">
                                  {user.active ? "Active" : "Inactive"}
                                </td>
                                <td className="px-3 py-2.5">
                                  {user.active ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        deactivateUser(user.username)
                                      }
                                      disabled={
                                        deactivateUserMutation.isPending
                                      }
                                      className="rounded-md px-2 py-1 font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-wait disabled:opacity-50"
                                    >
                                      {deactivateUserMutation.isPending &&
                                      deactivateUserMutation.variables
                                        ?.username === user.username
                                        ? "Deactivating…"
                                        : "Deactivate"}
                                    </button>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-lg bg-amber-50 p-3 text-[11px] leading-5 text-amber-900">
                      Only the provisioned Site Manager can create or manage
                      project accounts.
                    </div>
                  )}
                </div>
              )}

              {buildingEditor && (
                <div
                  className="fixed inset-0 z-50 flex items-end justify-center bg-[#081722]/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
                  onMouseDown={(event) => {
                    if (event.target === event.currentTarget)
                      setBuildingEditor(null);
                  }}
                >
                  <form
                    onSubmit={saveBuilding}
                    className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl"
                  >
                    <div className="mb-5 flex items-start justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-[#152c3d]">
                          {buildingEditor === "new"
                            ? "Add building"
                            : `Edit ${buildingEditor.buildingNumber}`}
                        </h2>
                        <p className="mt-1 text-xs text-slate-500">
                          Building details and project weight
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setBuildingEditor(null)}
                        aria-label="Close building editor"
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                      >
                        ×
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-[11px] font-semibold text-slate-600">
                        Building number
                        <input
                          required
                          maxLength={60}
                          value={buildingNumberDraft}
                          onChange={(event) =>
                            setBuildingNumberDraft(event.target.value)
                          }
                          className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-slate-400"
                        />
                      </label>
                      <label className="text-[11px] font-semibold text-slate-600">
                        Building name
                        <input
                          required
                          maxLength={200}
                          value={buildingNameDraft}
                          onChange={(event) =>
                            setBuildingNameDraft(event.target.value)
                          }
                          className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-slate-400"
                        />
                      </label>
                      <label className="text-[11px] font-semibold text-slate-600">
                        Status
                        <select
                          value={buildingStatusDraft}
                          onChange={(event) =>
                            setBuildingStatusDraft(event.target.value)
                          }
                          className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-slate-400"
                        >
                          <option value="">Automatic from progress</option>
                          <option value="Removed from scope">
                            Removed from scope
                          </option>
                          <option value="Hold">Hold</option>
                          <option value="Delayed">Delayed</option>
                        </select>
                      </label>
                      {["Hold", "Delayed"].includes(buildingStatusDraft) && (
                        <label className="text-[11px] font-semibold text-slate-600 sm:col-span-2">
                          Reason
                          <textarea
                            required
                            maxLength={1000}
                            value={buildingReasonDraft}
                            onChange={(event) =>
                              setBuildingReasonDraft(event.target.value)
                            }
                            className="mt-1.5 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-slate-400"
                          />
                        </label>
                      )}
                      <label className="text-[11px] font-semibold text-slate-600">
                        Relative weight
                        <input
                          required
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={buildingWeightDraft}
                          onChange={(event) =>
                            setBuildingWeightDraft(event.target.value)
                          }
                          className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-slate-400"
                        />
                      </label>
                    </div>
                    {buildingFeedback && (
                      <p role="alert" className="mt-3 text-xs text-rose-700">
                        {buildingFeedback}
                      </p>
                    )}
                    <div className="mt-5 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setBuildingEditor(null)}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={saveBuildingMutation.isPending}
                        className="rounded-lg bg-[#142b3c] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Save building
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {selected && (
                <div
                  className="fixed inset-0 z-50 flex items-end justify-center bg-[#081722]/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
                  onMouseDown={(event) => {
                    if (event.target === event.currentTarget) setSelected(null);
                  }}
                >
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="building-heading"
                    className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
                  >
                    <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white px-5 py-4 md:px-6">
                      <div>
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                          Building {selected.buildingNumber}
                        </div>
                        <h2
                          id="building-heading"
                          className="text-lg font-bold tracking-tight text-[#152c3d]"
                        >
                          {selected.name}
                        </h2>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-slate-600">
                            {buildingStatus(selected)}
                          </span>
                          {selected.statusReason && (
                            <span className="text-xs text-slate-400">
                              {selected.statusReason}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setSelected(null)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                        aria-label="Close details"
                      >
                        ×
                      </button>
                    </div>
                    <div className="p-5 md:p-6">
                      <div className="mb-5 flex items-end justify-between rounded-xl bg-[#f5f7f8] p-4">
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            Building progress
                          </div>
                          <div className="mt-1 text-2xl font-bold tracking-tight text-[#1b3345]">
                            {pct(selected.progress)}
                          </div>
                        </div>
                        <div className="text-right text-[10px] text-slate-500">
                          Relative weight
                          <br />
                          <strong className="text-xs text-slate-700">
                            {Number(selected.relativeWeight).toFixed(2)}
                          </strong>
                        </div>
                      </div>
                      {isRemoved(selected) && (
                        <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                          Removed from Scope — this building is excluded from
                          project progress calculations. Its recorded activity
                          progress and history are retained.
                        </div>
                      )}
                      <div className="space-y-4">
                        {selected.activities.map((activity) => (
                          <div key={activity.id}>
                            <div className="mb-2 flex justify-between gap-4">
                              <div className="text-xs font-semibold text-slate-700">
                                {activity.name}
                                <span className="ml-2 font-normal text-slate-400">
                                  {Number(activity.weight)}% weight
                                </span>
                              </div>
                              <div className="text-xs font-semibold text-slate-600">
                                {pct(activity.progress)}
                              </div>
                            </div>
                            <ProgressBar value={activity.progress} />
                            <div className="mt-1 text-right text-[10px] text-slate-400">
                              Contribution {pct(activity.contribution)}
                            </div>
                          </div>
                        ))}
                      </div>
                      {!isRemoved(selected) && (
                        <div className="mt-6 border-t border-slate-100 pt-5">
                          <h3 className="mb-3 text-xs font-bold text-[#1c3041]">
                            Update activity progress
                          </h3>
                          <div className="grid gap-3 sm:grid-cols-[1fr_110px]">
                            <select
                              value={updateActivity}
                              onChange={(event) => {
                                setUpdateActivity(event.target.value);
                                setUpdateValue(
                                  String(
                                    selected.activities.find(
                                      (item) => item.id === event.target.value,
                                    )?.progress ?? 0,
                                  ),
                                );
                              }}
                              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-[#829aaa]"
                            >
                              <option value="">Select activity</option>
                              {selected.activities.map((activity) => (
                                <option key={activity.id} value={activity.id}>
                                  {activity.name}
                                </option>
                              ))}
                            </select>
                            <div className="relative">
                              <input
                                aria-label="Activity progress percentage"
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={updateValue}
                                onChange={(event) =>
                                  setUpdateValue(event.target.value)
                                }
                                className="h-10 w-full rounded-lg border border-slate-200 px-3 pr-8 text-xs outline-none focus:border-[#829aaa]"
                              />
                              <span className="absolute right-3 top-3 text-xs text-slate-400">
                                %
                              </span>
                            </div>
                          </div>
                          <textarea
                            value={updateNote}
                            onChange={(event) =>
                              setUpdateNote(event.target.value)
                            }
                            maxLength={1000}
                            rows={2}
                            placeholder="Optional update note"
                            className="mt-3 w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-xs outline-none placeholder:text-slate-400 focus:border-[#829aaa]"
                          />
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                            <span
                              className={`text-[11px] ${feedback && !feedback.startsWith("Progress saved") ? "text-rose-600" : "text-slate-500"}`}
                            >
                              {feedback ||
                                "Progress values are validated and saved with history."}
                            </span>
                            <button
                              disabled={
                                !updateActivity ||
                                updateValue === "" ||
                                Number(updateValue) < 0 ||
                                Number(updateValue) > 100 ||
                                updateMutation.isPending
                              }
                              onClick={saveProgress}
                              className="rounded-lg bg-[#142b3c] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#1d3b50] disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              {updateMutation.isPending
                                ? "Saving…"
                                : "Save progress"}
                            </button>
                          </div>
                        </div>
                      )}
                      {isRemoved(selected) && (
                        <div className="mt-5 text-[11px] text-slate-400">
                          Progress updates are disabled for excluded buildings.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  tone: "blue" | "amber" | "slate";
}) {
  const colors = {
    blue: "bg-sky-50 text-sky-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(17,33,49,0.025)]">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
          {label}
        </span>
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${colors[tone]}`}
        >
          {icon}
        </span>
      </div>
      <div className="mt-5 text-[32px] font-bold leading-none tracking-[-0.04em] text-[#192e3e]">
        {value}
      </div>
      <div className="mt-2 text-[11px] text-slate-400">{detail}</div>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-[6px] overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full transition-[width] duration-300 ${value >= 99.99 ? "bg-emerald-500" : value > 0 ? "bg-amber-500" : "bg-slate-300"}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function BuildingTable({
  buildings,
  onOpen,
  onAssignOnMap,
  onEdit,
  onDelete,
}: {
  buildings: Building[];
  onOpen: (building: Building) => void;
  onAssignOnMap?: (building: Building) => void;
  onEdit?: (building: Building) => void;
  onDelete?: (building: Building) => void;
}) {
  const [sort, setSort] = useState<{
    key: "building" | "status" | "progress" | "weight";
    direction: "asc" | "desc";
  }>({ key: "building", direction: "asc" });
  const sortedBuildings = useMemo(
    () =>
      [...buildings].sort((a, b) => {
        const comparison =
          sort.key === "building"
            ? `${a.buildingNumber} ${a.name}`.localeCompare(
                `${b.buildingNumber} ${b.name}`,
                undefined,
                { numeric: true, sensitivity: "base" },
              )
            : sort.key === "status"
              ? buildingStatus(a).localeCompare(buildingStatus(b), undefined, {
                  sensitivity: "base",
                })
              : sort.key === "progress"
                ? a.progress - b.progress
                : Number(a.relativeWeight) - Number(b.relativeWeight);
        return sort.direction === "asc" ? comparison : -comparison;
      }),
    [buildings, sort],
  );
  function sortButton(key: typeof sort.key, label: string) {
    return (
      <button
        type="button"
        onClick={() =>
          setSort((current) => ({
            key,
            direction:
              current.key === key && current.direction === "asc"
                ? "desc"
                : "asc",
          }))
        }
        className="inline-flex items-center gap-1 hover:text-slate-700"
      >
        {label}
        <span aria-hidden="true">
          {sort.key === key ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    );
  }
  if (!buildings.length)
    return (
      <div className="p-8 text-center text-xs text-slate-400">
        No buildings match this search.
      </div>
    );
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] border-collapse text-left">
        <thead>
          <tr className="bg-[#f8fafb] text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-400">
            <th className="px-5 py-3 md:px-6">
              {sortButton("building", "Building")}
            </th>
            <th className="px-4 py-3">{sortButton("status", "Status")}</th>
            <th className="w-[240px] px-4 py-3">
              {sortButton("progress", "Progress")}
            </th>
            <th className="px-4 py-3">{sortButton("weight", "Weight")}</th>
            <th className="px-4 py-3">Map assignment</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sortedBuildings.map((building) => (
            <tr
              key={building.id}
              onClick={() => onOpen(building)}
              className="cursor-pointer transition-colors hover:bg-[#f9fbfc]"
            >
              <td className="px-5 py-3.5 md:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <IconBuilding size={15} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#243c4e]">
                      {building.buildingNumber}
                      <span className="ml-2 font-medium text-slate-600">
                        {building.name}
                      </span>
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400">
                      Updated {mostRecentUpdate(building)}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3.5">
                <div>
                  <span
                    className={`text-[11px] ${buildingStatus(building) === "Finished" ? "font-semibold text-emerald-700" : buildingStatus(building) === "Hold" || buildingStatus(building) === "Delayed" ? "font-semibold text-amber-700" : "text-slate-500"}`}
                  >
                    {buildingStatus(building)}
                  </span>
                  {building.statusReason && (
                    <div className="mt-1 max-w-48 text-[10px] text-slate-400">
                      {building.statusReason}
                    </div>
                  )}
                </div>
              </td>
              <td className="px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="min-w-[95px] flex-1">
                    <ProgressBar value={building.progress} />
                  </div>
                  <span
                    className={`w-11 text-right text-[11px] font-bold tabular-nums ${isRemoved(building) ? "text-slate-400" : "text-slate-700"}`}
                  >
                    {pct(building.progress)}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3.5 text-xs tabular-nums text-slate-600">
                {Number(building.relativeWeight).toFixed(2)}
              </td>
              <td className="px-4 py-3.5">
                {onAssignOnMap && !building.geometry?.points.length && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onAssignOnMap(building);
                    }}
                    className="whitespace-nowrap rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-[#335a72] hover:border-slate-300 hover:bg-slate-50"
                  >
                    Assign on map
                  </button>
                )}
              </td>
              <td className="px-4 py-3.5">
                <div className="flex items-center gap-2">
                  {onEdit && (
                    <button
                      type="button"
                      aria-label={`Edit ${building.buildingNumber}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit(building);
                      }}
                      className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    >
                      <IconPencil size={15} />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      aria-label={`Delete ${building.buildingNumber}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(building);
                      }}
                      className="rounded p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                    >
                      <IconTrash size={15} />
                    </button>
                  )}
                  <IconChevronRight size={15} className="text-slate-300" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScopeBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.04em] text-slate-600">
      Removed from scope
    </span>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function ReportCard({
  title,
  subtitle,
  value,
  onClick,
}: {
  title: string;
  subtitle: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <div className="text-sm font-bold text-[#1c3041]">{title}</div>
      <div className="mt-1 text-xs text-slate-400">{subtitle}</div>
      <div className="mt-6 flex items-center justify-between text-xs font-semibold text-[#335a72]">
        {value}
        <IconChevronRight size={15} />
      </div>
    </button>
  );
}

function dateText(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function mostRecentUpdate(building: Building) {
  const dates = building.activities
    .map((activity) => activity.updatedAt)
    .filter((value): value is string => Boolean(value))
    .sort();
  const date = dates[dates.length - 1];
  return date ? dateText(date) : "not updated";
}
