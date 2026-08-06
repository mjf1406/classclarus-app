import { contextBridge, ipcRenderer } from "electron";

import { APP_UPDATE_IPC, type AppUpdateStatus } from "../shared/appUpdate.ts";
import { CLASSROOM_IPC, type ClassroomSession } from "./types.ts";

const classroomApi = {
  getSession: (): Promise<ClassroomSession> => ipcRenderer.invoke(CLASSROOM_IPC.getSession),
  onSession: (listener: (session: ClassroomSession) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, session: ClassroomSession) => {
      listener(session);
    };
    ipcRenderer.on(CLASSROOM_IPC.onSession, handler);
    return () => {
      ipcRenderer.removeListener(CLASSROOM_IPC.onSession, handler);
    };
  },
  getUpdateStatus: (): Promise<AppUpdateStatus> => ipcRenderer.invoke(APP_UPDATE_IPC.getStatus),
  onUpdate: (listener: (status: AppUpdateStatus) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: AppUpdateStatus) => {
      listener(status);
    };
    ipcRenderer.on(APP_UPDATE_IPC.onStatus, handler);
    return () => {
      ipcRenderer.removeListener(APP_UPDATE_IPC.onStatus, handler);
    };
  },
  checkForUpdates: (): Promise<void> => ipcRenderer.invoke(APP_UPDATE_IPC.check),
  quitAndInstall: (): Promise<void> => ipcRenderer.invoke(APP_UPDATE_IPC.quitAndInstall),
};

contextBridge.exposeInMainWorld("classroom", classroomApi);

export type ClassroomApi = typeof classroomApi;
