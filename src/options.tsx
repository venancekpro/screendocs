import { useEffect, useState } from "react";
import "~src/style.css";
import type { CaptureSession, ExportOptions } from "~src/types";
import { StorageManager } from "~src/utils/storage";
import { ExportManager } from "~src/utils/export";

interface EditorState {
  session: CaptureSession | null;
  selectedActions: Set<string>;
  exportOptions: ExportOptions;
  isExporting: boolean;
}

export default function Options() {
  const [state, setState] = useState<EditorState>({
    session: null,
    selectedActions: new Set(),
    exportOptions: {
      format: "html",
      includeScreenshots: true,
      blurSensitiveData: true,
      imageFormat: "embedded",
    },
    isExporting: false,
  });

  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get("session");

    if (sessionId) {
      const data = await StorageManager.getData();
      const session = data.sessions.find((s) => s.id === sessionId);
      if (session) {
        setState((prev) => ({ ...prev, session }));
      }
    }
  };

  const updateActionDescription = async (
    actionId: string,
    newDescription: string
  ) => {
    if (!state.session) return;

    const updatedSession = {
      ...state.session,
      actions: state.session.actions.map((action) =>
        action.id === actionId
          ? { ...action, description: newDescription }
          : action
      ),
    };

    setState((prev) => ({ ...prev, session: updatedSession }));
    await StorageManager.saveSession(updatedSession);
  };

  const deleteAction = async (actionId: string) => {
    if (!state.session) return;

    const updatedSession = {
      ...state.session,
      actions: state.session.actions.filter((action) => action.id !== actionId),
    };

    setState((prev) => ({ ...prev, session: updatedSession }));
    await StorageManager.saveSession(updatedSession);
  };

  const moveAction = async (actionId: string, direction: "up" | "down") => {
    if (!state.session) return;

    const actions = [...state.session.actions];
    const index = actions.findIndex((a) => a.id === actionId);

    if (index === -1) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === actions.length - 1) return;

    const newIndex = direction === "up" ? index - 1 : index + 1;
    [actions[index], actions[newIndex]] = [actions[newIndex], actions[index]];

    const updatedSession = { ...state.session, actions };
    setState((prev) => ({ ...prev, session: updatedSession }));
    await StorageManager.saveSession(updatedSession);
  };

  const exportGuide = async () => {
    if (!state.session) return;

    setState((prev) => ({ ...prev, isExporting: true }));

    try {
      await ExportManager.exportSession(state.session, state.exportOptions);
    } catch (error) {
      console.error("Erreur export:", error);
      alert(`Erreur lors de l'export: ${error instanceof Error ? error.message : error}`);
    } finally {
      setState((prev) => ({ ...prev, isExporting: false }));
    }
  };


  const deleteCurrentSession = async () => {
    if (!state.session) return;

    if (
      confirm(
        `Êtes-vous sûr de vouloir supprimer la session "${state.session.title}" ?`
      )
    ) {
      await chrome.runtime.sendMessage({
        type: "DELETE_SESSION",
        sessionId: state.session.id,
      });

      // Rediriger vers la page popup ou fermer l'onglet
      window.close();
    }
  };

  if (!state.session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement de la session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-800">
              {state.session.title}
            </h1>
            <div className="flex gap-2">
              <button
                onClick={deleteCurrentSession}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                title="Supprimer cette session"
              >
                🗑️ Supprimer
              </button>
              <button
                onClick={exportGuide}
                disabled={state.isExporting}
                className="btn-primary flex items-center gap-2"
              >
                {state.isExporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Export...
                  </>
                ) : (
                  <>📄 Exporter</>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
            <div>
              <span className="font-medium">URL:</span> {state.session.url}
            </div>
            <div>
              <span className="font-medium">Actions:</span>{" "}
              {state.session.actions.length}
            </div>
            <div>
              <span className="font-medium">Captures:</span>{" "}
              <span className={`${
                state.session.actions.filter(a => a.screenshot).length === state.session.actions.length
                  ? "text-green-600"
                  : "text-orange-600"
              }`}>
                {state.session.actions.filter(a => a.screenshot).length}/{state.session.actions.length}
              </span>
            </div>
            <div>
              <span className="font-medium">Date:</span>{" "}
              {new Date(state.session.startTime).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Options d'export */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Options d'export</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Format */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Format
              </label>
              <select
                value={state.exportOptions.format}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    exportOptions: {
                      ...prev.exportOptions,
                      format: e.target.value as "markdown" | "html" | "zip",
                    },
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="html">HTML (Recommandé)</option>
                <option value="markdown">Markdown</option>
                <option value="zip">ZIP avec images</option>
              </select>
            </div>

            {/* Images */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Images
              </label>
              <select
                value={state.exportOptions.imageFormat || "embedded"}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    exportOptions: {
                      ...prev.exportOptions,
                      imageFormat: e.target.value as "embedded" | "separate",
                    },
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={state.exportOptions.format === "zip"}
              >
                <option value="embedded">Intégrées</option>
                <option value="separate">Séparées</option>
              </select>
            </div>

            {/* Options */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Options
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={state.exportOptions.includeScreenshots}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        exportOptions: {
                          ...prev.exportOptions,
                          includeScreenshots: e.target.checked,
                        },
                      }))
                    }
                    className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">Inclure captures</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={state.exportOptions.blurSensitiveData}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        exportOptions: {
                          ...prev.exportOptions,
                          blurSensitiveData: e.target.checked,
                        },
                      }))
                    }
                    className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">Masquer données sensibles</span>
                </label>
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-600">
            <p><strong>HTML:</strong> Format optimal avec styles intégrés pour une meilleure présentation</p>
            <p><strong>ZIP:</strong> Archive contenant un fichier HTML et un dossier images séparé</p>
            <p><strong>Markdown:</strong> Format texte simple (images en base64)</p>
          </div>
        </div>

        {/* Liste des actions */}
        <div className="space-y-4">
          {state.session.actions.map((action, index) => (
            <div
              key={action.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        action.type === "click"
                          ? "bg-green-100 text-green-700"
                          : action.type === "input"
                          ? "bg-blue-100 text-blue-700"
                          : action.type === "scroll"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-purple-100 text-purple-700"
                      }`}
                    >
                      {action.type}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(action.timestamp).toLocaleTimeString()}
                    </span>
                    {/* Indicateur de capture */}
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        action.screenshot
                          ? "bg-green-100 text-green-700"
                          : "bg-orange-100 text-orange-700"
                      }`}
                      title={action.screenshot ? "Capture disponible" : "Aucune capture"}
                    >
                      {action.screenshot ? "📸" : "❌"}
                    </span>
                  </div>

                  <textarea
                    value={action.description || ""}
                    onChange={(e) =>
                      updateActionDescription(action.id, e.target.value)
                    }
                    placeholder="Description de l'action..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={2}
                  />

                  <div className="mt-2 text-xs text-gray-500">
                    <span className="font-medium">Élément:</span>{" "}
                    {action.element.selector}
                    {action.element.text && (
                      <span className="ml-2">
                        <span className="font-medium">Texte:</span>{" "}
                        {action.element.text}
                      </span>
                    )}
                  </div>
                </div>

                {action.screenshot && (
                  <div className="flex-shrink-0">
                    <img
                      src={action.screenshot}
                      alt={`Capture étape ${index + 1}`}
                      className="w-20 h-20 object-cover rounded border border-gray-200"
                    />
                  </div>
                )}

                <div className="flex-shrink-0 flex flex-col gap-1">
                  <button
                    onClick={() => moveAction(action.id, "up")}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveAction(action.id, "down")}
                    disabled={index === state.session.actions.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => deleteAction(action.id)}
                    className="p-1 text-red-400 hover:text-red-600"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
