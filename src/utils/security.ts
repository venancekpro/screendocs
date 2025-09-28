// Utilitaires de sécurité pour flouter les données sensibles

export class SecurityManager {
  // Patterns pour détecter les données sensibles
  private static readonly SENSITIVE_PATTERNS = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /(\+\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g,
    creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
    password: /password|pwd|pass/i,
  };

  // Attributs et types d'éléments sensibles
  private static readonly SENSITIVE_ATTRIBUTES = [
    "password",
    "credit-card",
    "cc-number",
    "cc-exp",
    "cc-csc",
    "social-security",
    "ssn",
    "tax-id",
  ];

  private static readonly SENSITIVE_INPUT_TYPES = [
    "password",
    "email",
    "tel",
    "credit-card-number",
  ];

  static isSensitiveElement(element: Element): boolean {
    const tagName = element.tagName.toLowerCase();

    // Vérifier les inputs sensibles
    if (tagName === "input") {
      const input = element as HTMLInputElement;

      // Type d'input sensible
      if (this.SENSITIVE_INPUT_TYPES.includes(input.type)) {
        return true;
      }

      // Attributs sensibles
      const autocomplete = input.autocomplete?.toLowerCase();
      if (
        autocomplete &&
        this.SENSITIVE_ATTRIBUTES.some((attr) => autocomplete.includes(attr))
      ) {
        return true;
      }

      // Nom ou ID contenant des mots-clés sensibles
      const name = (input.name || input.id || "").toLowerCase();
      if (this.SENSITIVE_PATTERNS.password.test(name)) {
        return true;
      }
    }

    return false;
  }

  static blurSensitiveText(text: string): string {
    if (!text) return text;

    let blurred = text;

    // Flouter les emails
    blurred = blurred.replace(this.SENSITIVE_PATTERNS.email, (match) => {
      const [local, domain] = match.split("@");
      return `${local.charAt(0)}***@${domain}`;
    });

    // Flouter les numéros de téléphone
    blurred = blurred.replace(this.SENSITIVE_PATTERNS.phone, (match) => {
      return match.replace(/\d/g, "*");
    });

    // Flouter les numéros de carte de crédit
    blurred = blurred.replace(this.SENSITIVE_PATTERNS.creditCard, (match) => {
      const cleaned = match.replace(/[-\s]/g, "");
      return `****-****-****-${cleaned.slice(-4)}`;
    });

    // Flouter les SSN
    blurred = blurred.replace(this.SENSITIVE_PATTERNS.ssn, "***-**-****");

    return blurred;
  }

  static getSafeElementValue(element: Element): string {
    if (this.isSensitiveElement(element)) {
      const input = element as HTMLInputElement;
      if (input.type === "password") {
        return "••••••••";
      } else {
        return this.blurSensitiveText(input.value || "");
      }
    }

    return (element as HTMLInputElement).value || "";
  }

  static getSafeElementText(element: Element): string {
    const text = element.textContent?.trim() || "";
    return this.blurSensitiveText(text);
  }

  // Flouter une image (canvas manipulation)
  static async blurScreenshot(
    imageDataUrl: string,
    blurAreas: Array<{ x: number; y: number; width: number; height: number }>
  ): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          resolve(imageDataUrl);
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;

        // Dessiner l'image originale
        ctx.drawImage(img, 0, 0);

        // Appliquer le flou sur les zones sensibles
        blurAreas.forEach((area) => {
          const imageData = ctx.getImageData(
            area.x,
            area.y,
            area.width,
            area.height
          );
          const blurredData = this.applyGaussianBlur(imageData, 10);
          ctx.putImageData(blurredData, area.x, area.y);
        });

        resolve(canvas.toDataURL("image/png"));
      };
      img.src = imageDataUrl;
    });
  }

  private static applyGaussianBlur(
    imageData: ImageData,
    radius: number
  ): ImageData {
    // Implémentation simplifiée du flou gaussien
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const output = new Uint8ClampedArray(data);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0,
          g = 0,
          b = 0,
          a = 0;
        let count = 0;

        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const ny = y + dy;
            const nx = x + dx;

            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              const idx = (ny * width + nx) * 4;
              r += data[idx];
              g += data[idx + 1];
              b += data[idx + 2];
              a += data[idx + 3];
              count++;
            }
          }
        }

        const idx = (y * width + x) * 4;
        output[idx] = r / count;
        output[idx + 1] = g / count;
        output[idx + 2] = b / count;
        output[idx + 3] = a / count;
      }
    }

    return new ImageData(output, width, height);
  }

  // Détecter les zones sensibles dans une page
  static detectSensitiveAreas(): Array<{ element: Element; rect: DOMRect }> {
    const sensitiveElements: Array<{ element: Element; rect: DOMRect }> = [];

    // Trouver tous les éléments sensibles visibles
    const allInputs = document.querySelectorAll("input, textarea");

    allInputs.forEach((element) => {
      if (this.isSensitiveElement(element)) {
        const rect = element.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          sensitiveElements.push({ element, rect });
        }
      }
    });

    return sensitiveElements;
  }
}
