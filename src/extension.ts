import * as vscode from "vscode";
import { parseResearchDocument } from "./research";

const VIEW_TYPE = "battlecodeResearch.replayViewer";

function nonce(): string {
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 36).toString(36)).join("");
}

function sidecarUri(replay: vscode.Uri): vscode.Uri {
  return replay.with({ path: `${replay.path}.research.json` });
}

class ReplayEditorProvider implements vscode.CustomReadonlyEditorProvider<vscode.CustomDocument> {
  constructor(private readonly context: vscode.ExtensionContext) {}

  openCustomDocument(uri: vscode.Uri): vscode.CustomDocument {
    return { uri, dispose: () => undefined };
  }

  async resolveCustomEditor(document: vscode.CustomDocument, panel: vscode.WebviewPanel): Promise<void> {
    const media = vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview");
    const roots = [media, vscode.Uri.joinPath(document.uri, "..")];
    panel.webview.options = { enableScripts: true, localResourceRoots: roots };
    panel.webview.html = this.html(panel.webview, media);
    let researchUri = sidecarUri(document.uri);

    const postOpen = async () => {
      try {
        const replayBytes = await vscode.workspace.fs.readFile(document.uri);
        let researchText: string | undefined;
        try {
          researchText = new TextDecoder().decode(await vscode.workspace.fs.readFile(sidecarUri(document.uri)));
          parseResearchDocument(researchText);
        } catch (error) {
          if (!(error instanceof vscode.FileSystemError && error.code === "FileNotFound")) {
            void vscode.window.showWarningMessage(`Could not load replay research sidecar: ${String(error)}`);
          }
          researchText = undefined;
        }
        const replaySource =
          document.uri.scheme === "file"
            ? { replayUrl: panel.webview.asWebviewUri(document.uri).toString() }
            : { replayBytes: Array.from(replayBytes) };
        await panel.webview.postMessage({
          type: "open",
          name: document.uri.path.split("/").pop() ?? "replay",
          researchText,
          researchPath: researchUri.fsPath,
          ...replaySource,
        });
      } catch (error) {
        await panel.webview.postMessage({ type: "error", message: String(error) });
      }
    };

    panel.webview.onDidReceiveMessage(async (message) => {
      if (message?.type === "ready") await postOpen();
      if (message?.type === "openResearch") {
        const [target] =
          (await vscode.window.showOpenDialog({
            defaultUri: vscode.Uri.joinPath(document.uri, ".."),
            canSelectMany: false,
            filters: { "Battlecode bookmark files": ["json"] },
            title: "Open replay bookmark file",
          })) ?? [];
        if (!target) return;
        try {
          const researchText = new TextDecoder().decode(await vscode.workspace.fs.readFile(target));
          parseResearchDocument(researchText);
          researchUri = target;
          await panel.webview.postMessage({ type: "research-loaded", researchText, path: target.fsPath });
        } catch (error) {
          await panel.webview.postMessage({ type: "research-error", message: `Could not open bookmark file: ${String(error)}` });
        }
      }
      if (message?.type === "save") {
        try {
          const text = `${JSON.stringify(message.document, null, 2)}\n`;
          parseResearchDocument(text);
          await vscode.workspace.fs.writeFile(researchUri, new TextEncoder().encode(text));
          await panel.webview.postMessage({ type: "saved", path: researchUri.fsPath });
        } catch (error) {
          await panel.webview.postMessage({ type: "save-error", message: String(error) });
        }
      }
      if (message?.type === "saveAs") {
        const target = await vscode.window.showSaveDialog({
          defaultUri: sidecarUri(document.uri),
          filters: { "Research JSON": ["json"] },
        });
        if (!target) return;
        try {
          const text = `${JSON.stringify(message.document, null, 2)}\n`;
          parseResearchDocument(text);
          await vscode.workspace.fs.writeFile(target, new TextEncoder().encode(text));
          researchUri = target;
          await panel.webview.postMessage({ type: "saved", path: target.fsPath });
        } catch (error) {
          await panel.webview.postMessage({ type: "save-error", message: String(error) });
        }
      }
    });
  }

  private html(webview: vscode.Webview, media: vscode.Uri): string {
    const script = webview.asWebviewUri(vscode.Uri.joinPath(media, "webview.js"));
    const style = webview.asWebviewUri(vscode.Uri.joinPath(media, "webview.css"));
    const id = nonce();
    const csp = [
      "default-src 'none'",
      `img-src ${webview.cspSource} data: blob:`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `font-src ${webview.cspSource}`,
      `connect-src ${webview.cspSource}`,
      `script-src 'nonce-${id}'`,
    ].join("; ");
    return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><meta http-equiv="Content-Security-Policy" content="${csp}" /><link rel="stylesheet" href="${style}" /></head><body><div id="app"></div><script nonce="${id}" src="${script}"></script></body></html>`;
  }
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(VIEW_TYPE, new ReplayEditorProvider(context), {
      supportsMultipleEditorsPerDocument: false,
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );
}

export function deactivate(): void {}
