import { useEffect, useState } from "react";
import "~src/style.css";
import type { CaptureSession, ExportOptions } from "~src/types";
import { StorageManager } from "~src/utils/storage";

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
      format: "markdown",
      includeScreenshots: true,
      blurSensitiveData: true,
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
      const markdown = generateMarkdown(state.session, state.exportOptions);

      if (state.exportOptions.format === "markdown") {
        await downloadFile(
          markdown,
          `${state.session.title}.md`,
          "text/markdown"
        );
      } else if (state.exportOptions.format === "html") {
        const html = markdownToHtml(markdown);
        await downloadFile(html, `${state.session.title}.html`, "text/html");
      }
    } catch (error) {
      console.error("Erreur export:", error);
    } finally {
      setState((prev) => ({ ...prev, isExporting: false }));
    }
  };

  const generateMarkdown = (
    session: CaptureSession,
    options: ExportOptions
  ): string => {
    let markdown = `# ${session.title}\n\n`;
    markdown += `**URL:** ${session.url}\n`;
    markdown += `**Date:** ${new Date(session.startTime).toLocaleString()}\n`;
    markdown += `**Durée:** ${
      session.endTime
        ? Math.round((session.endTime - session.startTime) / 1000)
        : "?"
    } secondes\n\n`;
    markdown += `## Étapes\n\n`;

    session.actions.forEach((action, index) => {
      markdown += `### ${index + 1}. ${
        action.description || "Action sans description"
      }\n\n`;

      if (options.includeScreenshots && action.screenshot) {
        markdown += `![Capture d'écran étape ${index + 1}](${
          action.screenshot
        })\n\n`;
      }

      markdown += `**Élément:** \`${action.element.selector}\`\n`;
      if (action.element.text) {
        markdown += `**Texte:** ${action.element.text}\n`;
      }
      if (action.element.value && !options.blurSensitiveData) {
        markdown += `**Valeur:** ${action.element.value}\n`;
      }
      markdown += `**Horodatage:** ${new Date(
        action.timestamp
      ).toLocaleTimeString()}\n\n`;
    });

    return markdown;
  };

  const markdownToHtml = (markdown: string): string => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${state.session?.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    img { max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px; }
    code { background: #f5f5f5; padding: 2px 4px; border-radius: 3px; }
    h1, h2, h3 { color: #333; }
  </style>
</head>
<body>
${markdown
  .replace(/^# (.*$)/gm, "<h1>$1</h1>")
  .replace(/^## (.*$)/gm, "<h2>$1</h2>")
  .replace(/^### (.*$)/gm, "<h3>$1</h3>")
  .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
  .replace(/`(.*?)`/g, "<code>$1</code>")
  .replace(/!\[(.*?)\]\((.*?)\)/g, '<img alt="$1" src="$2">')
  .replace(/\n\n/g, "</p><p>")
  .replace(/^/, "<p>")
  .replace(/$/, "</p>")}
</body>
</html>`;
  };

  const sanitizeFilename = (filename: string): string => {
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .substring(0, 100);
  };

  const downloadFile = async (
    content: string,
    filename: string,
    mimeType: string
  ) => {
    const sanitizedFilename = sanitizeFilename(filename);
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    try {
      await chrome.downloads.download({
        url: url,
        filename: sanitizedFilename,
        saveAs: true,
      });
    } catch (error) {
      console.error("Erreur téléchargement:", error);
      throw new Error(`Échec du téléchargement: ${error.message}`);
    } finally {
      URL.revokeObjectURL(url);
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

          <div className="grid grid-cols-3 gap-4 text-sm text-gray-600">
            <div>
              <span className="font-medium">URL:</span> {state.session.url}
            </div>
            <div>
              <span className="font-medium">Actions:</span>{" "}
              {state.session.actions.length}
            </div>
            <div>
              <span className="font-medium">Date:</span>{" "}
              {new Date(state.session.startTime).toLocaleString()}
            </div>
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
