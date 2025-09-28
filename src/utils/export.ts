import type { CaptureSession, ExportOptions } from "~src/types";

// Utilitaires pour l'export des sessions
export class ExportManager {
  static async exportSession(session: CaptureSession, options: ExportOptions): Promise<void> {
    switch (options.format) {
      case "html":
        await this.exportToHtml(session, options);
        break;
      case "markdown":
        await this.exportToMarkdown(session, options);
        break;
      case "zip":
        await this.exportToZip(session, options);
        break;
      default:
        throw new Error(`Format d'export non supporté: ${options.format}`);
    }
  }

  private static async exportToHtml(session: CaptureSession, options: ExportOptions): Promise<void> {
    const html = this.generateHtml(session, options);
    await this.downloadFile(html, `${session.title}.html`, "text/html");
  }

  private static async exportToMarkdown(session: CaptureSession, options: ExportOptions): Promise<void> {
    const markdown = this.generateMarkdown(session, options);
    await this.downloadFile(markdown, `${session.title}.md`, "text/markdown");
  }

  private static async exportToZip(session: CaptureSession, options: ExportOptions): Promise<void> {
    // Pour l'export ZIP, nous allons créer un fichier HTML avec des images séparées
    const { html, images } = this.generateHtmlWithSeparateImages(session, options);

    // Charger JSZip dynamiquement si pas encore disponible
    await this.loadJSZip();

    const JSZip = (window as any).JSZip;
    if (!JSZip) {
      throw new Error("Impossible de charger JSZip. Export ZIP non supporté.");
    }

    const zip = new JSZip();

    // Ajouter le fichier HTML
    zip.file(`${session.title}.html`, html);

    // Ajouter les images
    const imagesFolder = zip.folder("images");
    for (const [filename, dataUrl] of Object.entries(images)) {
      // Convertir dataUrl en blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      imagesFolder?.file(filename, blob);
    }

    // Générer et télécharger le ZIP
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);

    try {
      await chrome.downloads.download({
        url: url,
        filename: this.sanitizeFilename(`${session.title}.zip`),
        saveAs: true,
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  private static async loadJSZip(): Promise<void> {
    if ((window as any).JSZip) {
      return; // Déjà chargé
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Impossible de charger JSZip depuis le CDN'));
      document.head.appendChild(script);
    });
  }

  private static generateHtml(session: CaptureSession, options: ExportOptions): string {
    const actionsHtml = session.actions.map((action, index) => {
      let screenshotHtml = "";
      if (options.includeScreenshots && action.screenshot) {
        if (options.imageFormat === "embedded") {
          screenshotHtml = `
            <div class="screenshot">
              <img src="${action.screenshot}" alt="Capture d'écran étape ${index + 1}" />
            </div>
          `;
        }
      }

      return `
        <div class="action-step">
          <div class="step-header">
            <span class="step-number">${index + 1}</span>
            <span class="action-type action-type-${action.type}">${action.type}</span>
            <span class="timestamp">${new Date(action.timestamp).toLocaleTimeString()}</span>
          </div>
          <div class="step-content">
            <h3>${action.description || "Action sans description"}</h3>
            ${screenshotHtml}
            <div class="action-details">
              <p><strong>Élément:</strong> <code>${action.element.selector}</code></p>
              ${action.element.text ? `<p><strong>Texte:</strong> ${action.element.text}</p>` : ""}
              ${action.element.value && !options.blurSensitiveData ? `<p><strong>Valeur:</strong> ${action.element.value}</p>` : ""}
            </div>
          </div>
        </div>
      `;
    }).join("");

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${session.title}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f5f5f5;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
    }

    .header {
      background: white;
      padding: 30px;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      margin-bottom: 30px;
    }

    .header h1 {
      color: #2563eb;
      margin-bottom: 15px;
      font-size: 2rem;
    }

    .session-info {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      padding: 20px;
      background: #f8fafc;
      border-radius: 8px;
      border-left: 4px solid #2563eb;
    }

    .info-item {
      display: flex;
      flex-direction: column;
    }

    .info-label {
      font-weight: 600;
      color: #64748b;
      font-size: 0.875rem;
      margin-bottom: 4px;
    }

    .info-value {
      color: #1e293b;
      word-break: break-all;
    }

    .actions-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .action-step {
      background: white;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      overflow: hidden;
      transition: transform 0.2s ease;
    }

    .action-step:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    }

    .step-header {
      background: #f8fafc;
      padding: 15px 20px;
      display: flex;
      align-items: center;
      gap: 15px;
      border-bottom: 1px solid #e2e8f0;
    }

    .step-number {
      background: #2563eb;
      color: white;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 0.875rem;
    }

    .action-type {
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    .action-type-click {
      background: #dcfce7;
      color: #166534;
    }

    .action-type-input {
      background: #dbeafe;
      color: #1d4ed8;
    }

    .action-type-scroll {
      background: #fef3c7;
      color: #92400e;
    }

    .action-type-navigation {
      background: #f3e8ff;
      color: #7c3aed;
    }

    .timestamp {
      margin-left: auto;
      color: #64748b;
      font-size: 0.875rem;
    }

    .step-content {
      padding: 20px;
    }

    .step-content h3 {
      margin-bottom: 15px;
      color: #1e293b;
    }

    .screenshot {
      margin: 15px 0;
      text-align: center;
    }

    .screenshot img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      border: 1px solid #e2e8f0;
    }

    .action-details {
      background: #f8fafc;
      padding: 15px;
      border-radius: 8px;
      margin-top: 15px;
    }

    .action-details p {
      margin-bottom: 8px;
    }

    .action-details p:last-child {
      margin-bottom: 0;
    }

    code {
      background: #e2e8f0;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 0.875rem;
    }

    .footer {
      text-align: center;
      margin-top: 40px;
      padding: 20px;
      color: #64748b;
      font-size: 0.875rem;
    }

    @media print {
      body {
        background: white;
      }

      .action-step {
        box-shadow: none;
        border: 1px solid #e2e8f0;
        break-inside: avoid;
        margin-bottom: 20px;
      }

      .action-step:hover {
        transform: none;
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${session.title}</h1>
      <div class="session-info">
        <div class="info-item">
          <span class="info-label">URL</span>
          <span class="info-value">${session.url}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Date</span>
          <span class="info-value">${new Date(session.startTime).toLocaleString()}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Nombre d'actions</span>
          <span class="info-value">${session.actions.length}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Durée</span>
          <span class="info-value">${
            session.endTime
              ? Math.round((session.endTime - session.startTime) / 1000)
              : "?"
          } secondes</span>
        </div>
      </div>
    </div>

    <div class="actions-container">
      ${actionsHtml}
    </div>

    <div class="footer">
      <p>Guide généré automatiquement par Action Capture Extension</p>
      <p>Généré le ${new Date().toLocaleString()}</p>
    </div>
  </div>
</body>
</html>`;
  }

  private static generateHtmlWithSeparateImages(session: CaptureSession, options: ExportOptions): { html: string; images: Record<string, string> } {
    const images: Record<string, string> = {};

    const actionsHtml = session.actions.map((action, index) => {
      let screenshotHtml = "";
      if (options.includeScreenshots && action.screenshot) {
        const imageName = `screenshot_${index + 1}.png`;
        images[imageName] = action.screenshot;
        screenshotHtml = `
          <div class="screenshot">
            <img src="images/${imageName}" alt="Capture d'écran étape ${index + 1}" />
          </div>
        `;
      }

      return `
        <div class="action-step">
          <div class="step-header">
            <span class="step-number">${index + 1}</span>
            <span class="action-type action-type-${action.type}">${action.type}</span>
            <span class="timestamp">${new Date(action.timestamp).toLocaleTimeString()}</span>
          </div>
          <div class="step-content">
            <h3>${action.description || "Action sans description"}</h3>
            ${screenshotHtml}
            <div class="action-details">
              <p><strong>Élément:</strong> <code>${action.element.selector}</code></p>
              ${action.element.text ? `<p><strong>Texte:</strong> ${action.element.text}</p>` : ""}
              ${action.element.value && !options.blurSensitiveData ? `<p><strong>Valeur:</strong> ${action.element.value}</p>` : ""}
            </div>
          </div>
        </div>
      `;
    }).join("");

    const html = this.generateHtml(session, options).replace(
      /<div class="actions-container">.*<\/div>/s,
      `<div class="actions-container">${actionsHtml}</div>`
    );

    return { html, images };
  }

  private static generateMarkdown(session: CaptureSession, options: ExportOptions): string {
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
  }

  private static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .substring(0, 100);
  }

  private static async downloadFile(
    content: string,
    filename: string,
    mimeType: string
  ): Promise<void> {
    const sanitizedFilename = this.sanitizeFilename(filename);
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
      throw new Error(`Échec du téléchargement: ${error instanceof Error ? error.message : error}`);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}