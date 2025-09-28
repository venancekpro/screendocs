import { useEffect, useState } from "react";
import "~src/style.css";
import type { CaptureSession } from "~src/types";
import { StorageManager } from "~src/utils/storage";

interface PopupState {
  isRecording: boolean;
  currentSession: CaptureSession | null;
  sessions: CaptureSession[];
  newSessionTitle: string;
  isCreatingSession: boolean;
  isStartingRecording: boolean;
  isStoppingRecording: boolean;
}

export default function Popup() {
  const [state, setState] = useState<PopupState>({
    isRecording: false,
    currentSession: null,
    sessions: [],
    newSessionTitle: "",
    isCreatingSession: false,
    isStartingRecording: false,
    isStoppingRecording: false,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const data = await StorageManager.getData();
    const currentSession = await StorageManager.getCurrentSession();

    setState((prev) => ({
      ...prev,
      sessions: data.sessions,
      currentSession: currentSession,
      isRecording: currentSession?.isRecording || false,
    }));
  };

  const createNewSession = async () => {
    if (state.isCreatingSession) return;

    setState((prev) => ({ ...prev, isCreatingSession: true }));

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const title =
        state.newSessionTitle || `Session ${new Date().toLocaleString()}`;

      const response = await chrome.runtime.sendMessage({
        type: "CREATE_SESSION",
        title: title,
        url: tab.url,
      });

      setState((prev) => ({ ...prev, newSessionTitle: "" }));
      await loadData();
    } catch (error) {
      console.error("Erreur création session:", error);
    } finally {
      setState((prev) => ({ ...prev, isCreatingSession: false }));
    }
  };

  const startRecording = async () => {
    if (state.isStartingRecording || state.isCreatingSession) return;

    setState((prev) => ({ ...prev, isStartingRecording: true }));

    try {
      let session = state.currentSession;

      // Créer une nouvelle session si nécessaire
      if (!session) {
        await createNewSession();
        await loadData();
        const data = await StorageManager.getData();
        session = data.sessions[data.sessions.length - 1];
      }

      if (!session) {
        throw new Error("Impossible de créer ou récupérer une session");
      }

      await chrome.runtime.sendMessage({
        type: "START_RECORDING",
        sessionId: session.id,
      });

      setState((prev) => ({ ...prev, isRecording: true }));
    } catch (error) {
      console.error("Erreur démarrage enregistrement:", error);
    } finally {
      setState((prev) => ({ ...prev, isStartingRecording: false }));
    }
  };

  const stopRecording = async () => {
    if (state.isStoppingRecording) return;

    setState((prev) => ({ ...prev, isStoppingRecording: true }));

    try {
      await chrome.runtime.sendMessage({
        type: "STOP_RECORDING",
      });

      setState((prev) => ({ ...prev, isRecording: false }));
      await loadData();
    } catch (error) {
      console.error("Erreur arrêt enregistrement:", error);
    } finally {
      setState((prev) => ({ ...prev, isStoppingRecording: false }));
    }
  };

  const openEditor = (sessionId: string) => {
    chrome.tabs.create({
      url: chrome.runtime.getURL(`options.html?session=${sessionId}`),
    });
  };

  const deleteSession = async (sessionId: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette session ?")) {
      await chrome.runtime.sendMessage({
        type: "DELETE_SESSION",
        sessionId: sessionId,
      });
      await loadData();
    }
  };

  const deleteAllSessions = async () => {
    if (confirm("Êtes-vous sûr de vouloir supprimer TOUTES les sessions ?")) {
      await chrome.runtime.sendMessage({
        type: "DELETE_ALL_SESSIONS",
      });
      await loadData();
    }
  };

  return (
    <div className="w-80 p-4 bg-white" data-extension="action-capture">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
        <h1 className="text-lg font-semibold text-gray-800">Action Capture</h1>
      </div>

      {/* Status actuel */}
      <div className="card mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">Statut</span>
          <div
            className={`flex items-center gap-1 text-sm ${
              state.isRecording ? "text-red-600" : "text-gray-500"
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                state.isRecording ? "bg-red-500 animate-pulse" : "bg-gray-400"
              }`}
            ></div>
            {state.isRecording ? "Enregistrement..." : "Arrêté"}
          </div>
        </div>

        {state.currentSession && (
          <div className="text-xs text-gray-500 mb-3">
            Session: {state.currentSession.title}
          </div>
        )}

        <div className="flex gap-2">
          {!state.isRecording ? (
            <button
              onClick={startRecording}
              disabled={state.isStartingRecording || state.isCreatingSession}
              className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {state.isStartingRecording || state.isCreatingSession ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {state.isCreatingSession ? "Création..." : "Démarrage..."}
                </>
              ) : (
                <>
                  <div className="w-3 h-3 bg-white rounded-full"></div>
                  Démarrer
                </>
              )}
            </button>
          ) : (
            <button
              onClick={stopRecording}
              disabled={state.isStoppingRecording}
              className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {state.isStoppingRecording ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Arrêt...
                </>
              ) : (
                <>
                  <div className="w-3 h-3 bg-white"></div>
                  Arrêter
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Nouvelle session */}
      {!state.isRecording && (
        <div className="card mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Nouvelle session
          </h3>
          <input
            type="text"
            placeholder="Nom de la session (optionnel)"
            value={state.newSessionTitle}
            onChange={(e) =>
              setState((prev) => ({ ...prev, newSessionTitle: e.target.value }))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={createNewSession}
            disabled={state.isCreatingSession}
            className="btn-secondary w-full mt-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {state.isCreatingSession ? (
              <>
                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin inline-block mr-2"></div>
                Création...
              </>
            ) : (
              "Créer une session"
            )}
          </button>
        </div>
      )}

      {/* Sessions récentes */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-700">
            Sessions récentes
          </h3>
          {state.sessions.length > 0 && (
            <button
              onClick={deleteAllSessions}
              className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 transition-colors"
              title="Supprimer toutes les sessions"
            >
              🗑️ Tout supprimer
            </button>
          )}
        </div>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {state.sessions.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-2">
              Aucune session enregistrée
            </p>
          ) : (
            state.sessions
              .slice(-5)
              .reverse()
              .map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">
                      {session.title}
                    </div>
                    <div className="text-xs text-gray-500">
                      {session.actions.length} actions •{" "}
                      {new Date(session.startTime).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditor(session.id)}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                      title="Éditer la session"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => deleteSession(session.id)}
                      className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                      title="Supprimer la session"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center">
          Capturez vos actions et générez des guides automatiquement
        </p>
      </div>
    </div>
  );
}
