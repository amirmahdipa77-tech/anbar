import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CommitDetailScreen } from './src/screens/CommitDetail';
import { DashboardScreen, type ProjectSummary } from './src/screens/Dashboard';
import { DiffScreen } from './src/screens/Diff';
import { EditorScreen } from './src/screens/Editor';
import { FindScreen } from './src/screens/Find';
import { LockScreen } from './src/screens/Lock';
import { SettingsScreen } from './src/screens/Settings';
import { ViewerScreen } from './src/screens/Viewer';
import { WorkspaceScreen } from './src/screens/Workspace';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './src/security/pin';
import * as db from './src/storage/db';
import type { Change, Commit, Project, ProjectData, Settings } from './src/types';

type ToastValue = (message: string, kind?: 'info' | 'success' | 'error') => void;
import { ThemeProvider, ToastProvider } from './src/ui/kit';

type Route =
  | { name: 'dashboard' }
  | { name: 'workspace'; projectId: string }
  | { name: 'editor'; projectId: string; path: string }
  | { name: 'diff'; projectId: string; title: string; subtitle?: string; changes: Change[] }
  | { name: 'commit'; projectId: string; commit: Commit }
  | { name: 'viewer'; title: string; subtitle?: string; content: string }
  | { name: 'find'; projectId: string }
  | { name: 'settings' };

function haptic(kind: 'light' | 'success' | 'warning') {
  if (Platform.OS === 'web') return;
  const map = {
    light: Haptics.ImpactFeedbackStyle.Light,
    success: Haptics.NotificationFeedbackType.Success,
    warning: Haptics.NotificationFeedbackType.Warning,
  } as const;
  if (kind === 'light') void Haptics.impactAsync(map.light).catch(() => undefined);
  else void Haptics.notificationAsync(map[kind]).catch(() => undefined);
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}

function Root() {
  const scheme = useColorScheme();
  const toastRef = useRef<ToastValue>(() => undefined);
  const toast = useCallback<ToastValue>((message, kind) => toastRef.current(message, kind), []);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [route, setRoute] = useState<Route>({ name: 'dashboard' });
  const [project, setProject] = useState<Project | null>(null);
  const [data, setData] = useState<ProjectData>({ files: {}, commits: [] });
  const [changes, setChanges] = useState<Change[]>([]);
  const [locked, setLocked] = useState(false);
  const [ready, setReady] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  const theme = useMemo<'light' | 'dark'>(
    () => (settings.theme === 'system' ? (scheme === 'dark' ? 'dark' : 'light') : settings.theme),
    [settings.theme, scheme],
  );

  const refreshProjects = useCallback(async () => {
    const list = await db.listProjects();
    const summaries: ProjectSummary[] = [];
    for (const item of list) {
      const projectData = await db.getProjectData(item.id);
      summaries.push({
        project: item,
        files: Object.keys(projectData.files).length,
        commits: projectData.commits.length,
        lastMessage: projectData.commits[0]?.message ?? null,
      });
    }
    setProjects(summaries);
  }, []);

  const loadProject = useCallback(async (projectId: string) => {
    const found = await db.getProject(projectId);
    if (!found) return null;
    const projectData = await db.getProjectData(projectId);
    const pending = await db.workingChanges(projectId);
    setProject(found);
    setData(projectData);
    setChanges(pending);
    return { project: found, data: projectData, changes: pending };
  }, []);

  useEffect(() => {
    (async () => {
      const stored = await loadSettings();
      setSettings(stored);
      if (stored.lockEnabled) setLocked(true);
      await refreshProjects();
      setReady(true);
    })();
  }, [refreshProjects]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        backgroundedAt.current = Date.now();
        return;
      }
      if (state === 'active') {
        const away = backgroundedAt.current ? Date.now() - backgroundedAt.current : 0;
        if (settings.lockEnabled && away >= settings.autoLockMs) setLocked(true);
        backgroundedAt.current = null;
      }
    });
    return () => subscription.remove();
  }, [settings.lockEnabled, settings.autoLockMs]);

  const persistSettings = useCallback(async (next: Settings) => {
    setSettings(next);
    await saveSettings(next);
  }, []);

  const back = useCallback(() => {
    if (route.name === 'dashboard') return;
    if (route.name === 'workspace') {
      setRoute({ name: 'dashboard' });
      void refreshProjects();
      return;
    }
    if (route.name === 'viewer') {
      setRoute({ name: 'dashboard' });
      void refreshProjects();
      return;
    }
    if (route.name === 'editor' || route.name === 'find' || route.name === 'commit') {
      setRoute({ name: 'workspace', projectId: route.projectId });
      void loadProject(route.projectId);
      return;
    }
    if (route.name === 'diff') {
      setRoute({ name: 'workspace', projectId: route.projectId });
      void loadProject(route.projectId);
      return;
    }
    setRoute({ name: 'dashboard' });
  }, [route, refreshProjects, loadProject]);

  if (!ready) {
    return (
      <ThemeProvider name={theme}>
        <View style={{ flex: 1 }} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider name={theme}>
      <ToastProvider onMount={(show) => { toastRef.current = show; }}>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        {locked ? (
          <LockScreen settings={settings} onUnlock={() => setLocked(false)} />
        ) : (
          <Router
            route={route}
            setRoute={setRoute}
            back={back}
            projects={projects}
            project={project}
            data={data}
            changes={changes}
            settings={settings}
            persistSettings={persistSettings}
            refreshProjects={refreshProjects}
            loadProject={loadProject}
            toast={toast}
            lock={() => setLocked(true)}
          />
        )}
      </ToastProvider>
    </ThemeProvider>
  );
}



function Router({
  route,
  setRoute,
  back,
  projects,
  project,
  data,
  changes,
  settings,
  persistSettings,
  refreshProjects,
  loadProject,
  toast,
  lock,
}: {
  route: Route;
  setRoute: (next: Route) => void;
  back: () => void;
  projects: ProjectSummary[];
  project: Project | null;
  data: ProjectData;
  changes: Change[];
  settings: Settings;
  persistSettings: (next: Settings) => Promise<void>;
  refreshProjects: () => Promise<void>;
  loadProject: (projectId: string) => Promise<unknown>;
  toast: (message: string, kind?: 'info' | 'success' | 'error') => void;
  lock: () => void;
}) {
  if (route.name === 'settings') {
    return (
      <SettingsScreen
        settings={settings}
        onChange={persistSettings}
        onBack={back}
        onExport={db.exportBackup}
        onImport={async (raw) => {
          const count = await db.importBackup(raw);
          await refreshProjects();
          return count;
        }}
        onErase={async () => {
          const list = await db.listProjects();
          for (const item of list) await db.deleteProject(item.id);
          await refreshProjects();
          setRoute({ name: 'dashboard' });
        }}
      />
    );
  }

  if (route.name === 'dashboard') {
    return (
      <DashboardScreen
        projects={projects}
        locked={settings.lockEnabled}
        onSettings={() => setRoute({ name: 'settings' })}
        onOpen={async (target) => {
          await loadProject(target.id);
          setRoute({ name: 'workspace', projectId: target.id });
        }}
        onCreate={async (input) => {
          const created = await db.createProject({ ...input, author: settings.author });
          await refreshProjects();
          await loadProject(created.id);
          setRoute({ name: 'workspace', projectId: created.id });
          haptic('success');
        }}
        onRename={async (target, input) => {
          await db.updateProject(target.id, {
            name: input.name.trim(),
            description: input.description.trim(),
          });
          await refreshProjects();
          haptic('light');
        }}
        onDelete={async (target) => {
          await db.deleteProject(target.id);
          await refreshProjects();
          haptic('warning');
          toast('Project deleted', 'success');
        }}
        onSeed={async () => {
          const seeded = await db.seedDemo(settings.author);
          await refreshProjects();
          await loadProject(seeded.id);
          setRoute({ name: 'workspace', projectId: seeded.id });
          haptic('success');
        }}
      />
    );
  }

  if (!project) {
    return <View style={{ flex: 1 }} />;
  }

  if (route.name === 'workspace') {
    return (
      <WorkspaceScreen
        project={project}
        data={data}
        changes={changes}
        onBack={back}
        onSettings={() => setRoute({ name: 'settings' })}
        onFind={() => setRoute({ name: 'find', projectId: project.id })}
        onOpenFile={(path) => setRoute({ name: 'editor', projectId: project.id, path })}
        onCreateFile={async (path) => {
          await db.writeFile(project.id, path, '');
          await loadProject(project.id);
          haptic('light');
          setRoute({ name: 'editor', projectId: project.id, path: path.trim() });
        }}
        onDeleteFile={async (path) => {
          await db.deleteFile(project.id, path);
          await loadProject(project.id);
          haptic('warning');
          toast(`Deleted ${path}`, 'success');
        }}
        onCommit={async (message) => {
          await db.commit(project.id, message, settings.author);
          await loadProject(project.id);
          await refreshProjects();
          haptic('success');
          toast('Committed', 'success');
        }}
        onOpenChange={(change) =>
          setRoute({
            name: 'diff',
            projectId: project.id,
            title: 'Working changes',
            subtitle: change.path,
            changes: [change],
          })
        }
        onOpenCommit={(commit) => setRoute({ name: 'commit', projectId: project.id, commit })}
      />
    );
  }

  if (route.name === 'editor') {
    const content = data.files[route.path] ?? '';
    return (
      <EditorScreen
        path={route.path}
        initialContent={content}
        isChanged={changes.some((change) => change.path === route.path)}
        onSave={async (next) => {
          await db.writeFile(project.id, route.path, next);
          await loadProject(project.id);
        }}
        onBack={back}
        onDelete={async () => {
          await db.deleteFile(project.id, route.path);
          await loadProject(project.id);
          haptic('warning');
          toast(`Deleted ${route.path}`, 'success');
          setRoute({ name: 'workspace', projectId: project.id });
        }}
      />
    );
  }

  if (route.name === 'diff') {
    return (
      <DiffScreen title={route.title} subtitle={route.subtitle} changes={route.changes} onBack={back} />
    );
  }

  if (route.name === 'commit') {
    return (
      <CommitDetailScreen
        projectId={project.id}
        commit={route.commit}
        onBack={back}
        onRestore={async () => {
          await db.restoreCommit(project.id, route.commit.id);
          await loadProject(project.id);
          haptic('success');
          toast('Files restored — review and commit', 'success');
        }}
        onViewSnapshot={(path, content) =>
          setRoute({
            name: 'viewer',
            title: path,
            subtitle: `at ${route.commit.id.slice(0, 7)}`,
            content,
          })
        }
      />
    );
  }

  if (route.name === 'viewer') {
    return <ViewerScreen path={route.title} subtitle={route.subtitle} content={route.content} onBack={back} />;
  }

  if (route.name === 'find') {
    return (
      <FindScreen
        files={data.files}
        onBack={back}
        onOpen={(path) => setRoute({ name: 'editor', projectId: project.id, path })}
      />
    );
  }

  return <View style={{ flex: 1 }} />;
}
