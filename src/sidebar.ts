import * as vscode from "vscode";

export type SidebarMessage =
  | { command: "generateModule"; moduleName: string; fields: string; language: string; database: string; dblink: string; port: string; structure: string }
  | { command: "generateAuth"; language: string }
  | { command: "generateFullBackend"; moduleName: string; fields: string; language: string; database: string; dblink: string; port: string }
  | { command: "addModule"; moduleName: string; fields: string };

export class BackendGeneratorSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = "backendGeneratorSidebar";
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext
  ) {}

  // Called by VS Code when the sidebar becomes visible
  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    const backendGenerated = this._context.workspaceState.get<boolean>('backendGenerated', false);
    webviewView.webview.html = this._getHtml(backendGenerated);

    webviewView.webview.onDidReceiveMessage(async (msg: SidebarMessage) => {
      try {
        if (msg.command === "generateModule") {
          vscode.window.showInformationMessage("Sidebar: Generate Module button clicked. Starting generation...");
          await vscode.commands.executeCommand(
            "nodeforge.generateMernModuleFromSidebar",
            msg
          );
        } else if (msg.command === "generateAuth") {
          vscode.window.showInformationMessage("Sidebar: Generate Auth button clicked.");
          await vscode.commands.executeCommand(
            "nodeforge.generateAuthFromSidebar",
            msg
          );
        } else if (msg.command === "generateFullBackend") {
          vscode.window.showInformationMessage("Sidebar: Generate Full Backend clicked.");
          await vscode.commands.executeCommand(
            "nodeforge.generateFullBackendFromSidebar",
            msg
          );
        } else if (msg.command === "addModule") {
          vscode.window.showInformationMessage(`Sidebar: Adding module ${msg.moduleName}...`);
          await vscode.commands.executeCommand(
            "nodeforge.addModuleToBackend",
            msg
          );
        }
      } catch (err) {
        vscode.window.showErrorMessage(`Sidebar Error: ${(err as Error).message}`);
        this.postStatus(`Error: ${(err as Error).message}`, "error");
      }
    });
  }

  /** Post a status message back into the sidebar log panel */
  public postStatus(text: string, type: "info" | "success" | "error" = "info"): void {
    this._view?.webview.postMessage({ command: "status", text, type });
  }

  /** Tell the sidebar a backend was successfully generated — switches to add-module mode */
  public postBackendGenerated(): void {
    this._context.workspaceState.update('backendGenerated', true);
    this._view?.webview.postMessage({ command: "backendGenerated" });
  }

  private _getHtml(backendGenerated: boolean): string {
    const bgFlag = backendGenerated ? "true" : "false";
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    background: var(--vscode-sideBar-background);
    padding: 10px;
    overflow-x: hidden;
  }

  /* ── Header ── */
  .header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--vscode-panel-border);
    margin-bottom: 12px;
  }
  .header-icon { font-size: 18px; }
  .header h1  { font-size: 13px; font-weight: 700; letter-spacing: 0.3px; }
  .badge {
    margin-left: auto;
    font-size: 9px;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    padding: 2px 6px;
    border-radius: 10px;
    font-weight: 600;
  }

  /* ── Tabs ── */
  .tabs {
    display: flex;
    border-bottom: 1px solid var(--vscode-panel-border);
    margin-bottom: 14px;
  }
  .tab {
    flex: 1;
    padding: 6px 0;
    font-size: 11px;
    font-weight: 600;
    text-align: center;
    cursor: pointer;
    border: none;
    background: transparent;
    color: var(--vscode-foreground);
    opacity: 0.5;
    border-bottom: 2px solid transparent;
    transition: opacity 0.15s, border-color 0.15s;
  }
  .tab.active {
    opacity: 1;
    border-bottom-color: var(--vscode-button-background);
    color: var(--vscode-button-background);
  }

  /* ── Panels ── */
  .panel { display: none; }
  .panel.active { display: block; }

  /* ── Form ── */
  .form-group { margin-bottom: 10px; }
  label {
    display: block;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    opacity: 0.65;
    margin-bottom: 4px;
  }
  input, select {
    width: 100%;
    padding: 5px 8px;
    font-size: 12px;
    font-family: var(--vscode-font-family);
    color: var(--vscode-input-foreground);
    background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border, #555);
    border-radius: 4px;
    outline: none;
  }
  input:focus, select:focus {
    border-color: var(--vscode-focusBorder);
  }
  input::placeholder { opacity: 0.45; }

  .hint {
    font-size: 9px;
    opacity: 0.5;
    margin-top: 3px;
  }

  /* ── Divider ── */
  .divider {
    height: 1px;
    background: var(--vscode-panel-border);
    margin: 14px 0;
  }

  /* ── Buttons ── */
  .btn {
    width: 100%;
    padding: 7px 0;
    font-size: 12px;
    font-weight: 600;
    font-family: var(--vscode-font-family);
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
    margin-top: 4px;
  }
  .btn:hover  { background: var(--vscode-button-hoverBackground); }
  .btn:active { opacity: 0.8; }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-secondary {
    background: transparent;
    border: 1px solid var(--vscode-button-background);
    color: var(--vscode-button-background);
    margin-top: 6px;
  }
  .btn-secondary:hover {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
  }

  /* ── Log area ── */
  .log-header {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    opacity: 0.55;
    margin-bottom: 6px;
  }
  #log {
    background: var(--vscode-terminal-background, #1e1e1e);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px;
    padding: 8px;
    font-size: 11px;
    font-family: var(--vscode-editor-font-family, monospace);
    min-height: 60px;
    max-height: 140px;
    overflow-y: auto;
    line-height: 1.5;
  }
  .log-entry { padding: 1px 0; }
  .log-info    { color: var(--vscode-terminal-ansiBlue,    #6cb6ff); }
  .log-success { color: var(--vscode-terminal-ansiGreen,   #56d364); }
  .log-error   { color: var(--vscode-terminal-ansiRed,     #ff7b72); }
  .log-muted   { opacity: 0.35; font-style: italic; }
</style>
</head>
<body>

<!-- Header -->
<div class="header">
  <span class="header-icon">⚡</span>
  <h1>NodeForge</h1>
  <span class="badge">v2</span>
</div>

<!-- Tabs -->
<div class="tabs">
  <button class="tab active" id="tabModule">📦 Module</button>
  <button class="tab"        id="tabAuth">🔐 Auth</button>
  <button class="tab"        id="tabFull">🚀 Full</button>
  <button class="tab"        id="tabAdd">➕ Add</button>
</div>

<!-- Module Panel -->
<div id="tab-module" class="panel active">

  <div class="form-group">
    <label>Module Name</label>
    <input id="moduleName" type="text" placeholder="e.g. Product" />
  </div>

  <div class="form-group">
    <label>Fields</label>
    <input id="fields" type="text" placeholder="name:string, price:number" />
    <div class="hint">Format: fieldName:type  — types: string · number · boolean · date</div>
  </div>

  <div class="form-group" id="fgLanguage">
    <label>Language</label>
    <select id="language">
      <option value="TypeScript">TypeScript</option>
      <option value="JavaScript">JavaScript</option>
    </select>
  </div>

  <div class="form-group" id="fgDatabase">
    <label>Database</label>
    <select id="database">
      <option value="MongoDB">MongoDB</option>
      <option value="MySQL">MySQL</option>
      <option value="PostgreSQL">PostgreSQL</option>
    </select>
  </div>

  <div class="form-group" id="fgDblink">
    <label>Connection String</label>
    <input id="dblink" type="text" placeholder="mongodb://localhost:27017/mydb" />
  </div>

  <div class="form-group" id="fgPort">
    <label>Port</label>
    <input id="port" type="text" placeholder="3000" value="3000" />
  </div>

  <div class="form-group" id="fgStructure">
    <label>Folder Structure</label>
    <select id="structure">
      <option value="simple">Simple (flat)</option>
      <option value="advanced">Advanced (src/)</option>
      <option value="clean">Clean Architecture</option>
    </select>
    <div class="hint" id="structureHint">models/  controllers/  routes/  DB/</div>
  </div>

  <button class="btn" id="btnModule">
    ▶ Generate Module
  </button>
</div>

<!-- Auth Panel -->
<div id="tab-auth" class="panel">
  <p style="font-size:11px;opacity:0.7;margin-bottom:14px;line-height:1.5;">
    Generates JWT authentication with register, login, protected <code>/me</code> route, bcrypt password hashing, and middleware.
  </p>

  <div class="form-group">
    <label>Language</label>
    <select id="authLanguage">
      <option value="TypeScript">TypeScript</option>
      <option value="JavaScript">JavaScript</option>
    </select>
  </div>

  <div class="divider"></div>

  <div style="font-size:10px;opacity:0.55;margin-bottom:8px;">Generated files</div>
  <div style="font-size:11px;line-height:1.8;opacity:0.75;">
    📄 middleware/auth.middleware<br/>
    📄 models/User<br/>
    📄 controllers/auth.controller<br/>
    📄 routes/auth.routes<br/>
    🔑 .env  ←  JWT_SECRET appended
  </div>

  <button class="btn" id="btnAuth" style="margin-top:14px;">
    ▶ Generate Auth
  </button>
  <button class="btn btn-secondary" id="btnCopy">
    📋 Copy Mount Snippet
  </button>
</div>

<!-- Full Backend Panel -->
<div id="tab-full" class="panel">
  <p style="font-size:11px;opacity:0.7;margin-bottom:12px;line-height:1.5;">
    One click generates a complete <strong>Advanced</strong> backend — module + auth + server + config.
  </p>
  <div style="font-family:monospace;font-size:10px;opacity:0.6;line-height:1.7;margin-bottom:12px;padding:6px 8px;background:var(--vscode-terminal-background,#1e1e1e);border-radius:4px;">
    src/ ├ controllers/ ├ models/ ├ routes/<br/>
    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├ services/ ├ middleware/ ├ utils/ └ config/<br/>
    .env&nbsp; server.ts&nbsp; package.json&nbsp; tsconfig.json
  </div>

  <div class="form-group">
    <label>Module Name</label>
    <input id="fullModuleName" type="text" placeholder="e.g. Product" />
  </div>

  <div class="form-group">
    <label>Fields</label>
    <input id="fullFields" type="text" placeholder="name:string, price:number" />
    <div class="hint">Format: fieldName:type</div>
  </div>

  <div class="form-group">
    <label>Language</label>
    <select id="fullLanguage">
      <option value="TypeScript">TypeScript</option>
      <option value="JavaScript">JavaScript</option>
    </select>
  </div>

  <div class="form-group">
    <label>Database</label>
    <select id="fullDatabase">
      <option value="MongoDB">MongoDB</option>
      <option value="MySQL">MySQL</option>
      <option value="PostgreSQL">PostgreSQL</option>
    </select>
  </div>

  <div class="form-group">
    <label>Connection String</label>
    <input id="fullDblink" type="text" placeholder="mongodb://localhost:27017/mydb" />
  </div>

  <div class="form-group">
    <label>Port</label>
    <input id="fullPort" type="text" placeholder="3000" value="3000" />
  </div>

  <button class="btn" id="btnFull" style="margin-top:8px;">
    🚀 Generate Full Backend
  </button>
</div>

<!-- Add Module Panel -->
<div id="tab-add" class="panel">
  <div style="font-size:11px;padding:8px 10px;margin-bottom:12px;border-radius:4px;background:var(--vscode-editorInfo-background,#1e3a5f);border:1px solid var(--vscode-editorInfo-border,#4fc3f7);color:var(--vscode-editorInfo-foreground,#90caf9);line-height:1.6;">
    🔍 <strong>Auto-detects</strong> your project's language, database &amp; folder structure.<br/>
    Generates model + controller + routes and updates <code>server.ts/js</code> automatically.
  </div>

  <div class="form-group">
    <label>Module Name</label>
    <input id="addModuleName" type="text" placeholder="e.g. Order" />
  </div>

  <div class="form-group">
    <label>Fields</label>
    <input id="addFields" type="text" placeholder="name:string, qty:number" />
    <div class="hint">Format: fieldName:type  — types: string · number · boolean · date</div>
  </div>

  <div class="divider"></div>

  <div style="font-size:10px;opacity:0.55;margin-bottom:6px;">What gets generated</div>
  <div style="font-size:11px;line-height:1.9;opacity:0.75;">
    📄 [modelsDir] / ModuleName<br/>
    📄 [controllersDir] / ModuleName.controller<br/>
    📄 [routesDir] / ModuleName.routes<br/>
    🔄 server.ts/js  ←  route mount added automatically
  </div>

  <button class="btn" id="btnAdd" style="margin-top:14px;">
    ➕ Add Module to Backend
  </button>
</div>

<!-- Log -->
<div class="divider"></div>
<div class="log-header">Output</div>
<div id="log"><span class="log-muted">Ready. Fill in the form and click Generate.</span></div>

<script>
  const vscode = acquireVsCodeApi();

  // ── Init: switch to Add tab if backend was already generated ──────────────
  if (${bgFlag}) { switchTab('add'); }

  // ── Attach event listeners after DOM is ready ─────────────────────────────
  document.getElementById('tabModule').addEventListener('click', () => switchTab('module'));
  document.getElementById('tabAuth').addEventListener('click',   () => switchTab('auth'));
  document.getElementById('tabFull').addEventListener('click',   () => switchTab('full'));
  document.getElementById('tabAdd').addEventListener('click',    () => switchTab('add'));
  document.getElementById('database').addEventListener('change', updatePlaceholder);
  document.getElementById('structure').addEventListener('change', updateStructureHint);
  document.getElementById('fullDatabase').addEventListener('change', updateFullPlaceholder);
  document.getElementById('btnModule').addEventListener('click', submitModule);
  document.getElementById('btnAuth').addEventListener('click',   submitAuth);
  document.getElementById('btnCopy').addEventListener('click',   copyMountSnippet);
  document.getElementById('btnFull').addEventListener('click',   submitFull);
  document.getElementById('btnAdd').addEventListener('click',    submitAddModule);

  // ── Tab switching ──────────────────────────────────────────────────────────
  function switchTab(name) {
    document.querySelectorAll('.tab').forEach((t, i) => {
      t.classList.toggle('active',
        (i === 0 && name === 'module') ||
        (i === 1 && name === 'auth')   ||
        (i === 2 && name === 'full')   ||
        (i === 3 && name === 'add'));
    });
    document.getElementById('tab-module').classList.toggle('active', name === 'module');
    document.getElementById('tab-auth').classList.toggle('active',   name === 'auth');
    document.getElementById('tab-full').classList.toggle('active',   name === 'full');
    document.getElementById('tab-add').classList.toggle('active',    name === 'add');
  }

  // ── Update DB placeholder ──────────────────────────────────────────────────
  const placeholders = {
    MongoDB:    'mongodb://localhost:27017/mydb',
    MySQL:      'mysql://user:password@localhost:3306/mydb',
    PostgreSQL: 'postgresql://user:password@localhost:5432/mydb',
  };
  function updatePlaceholder() {
    const db = document.getElementById('database').value;
    document.getElementById('dblink').placeholder = placeholders[db];
  }

  // ── Update structure hint ──────────────────────────────────────────────────
  const structureHints = {
    simple:   'models/  controllers/  routes/  DB/',
    advanced: 'src/models/  src/controllers/  src/routes/  src/config/',
    clean:    'src/domain/models/  src/presentation/controllers/  src/infrastructure/db/',
  };
  function updateStructureHint() {
    document.getElementById('structureHint').textContent = structureHints[document.getElementById('structure').value];
  }

  // ── Update Full Backend DB placeholder ────────────────────────────────────
  function updateFullPlaceholder() {
    const db = document.getElementById('fullDatabase').value;
    document.getElementById('fullDblink').placeholder = placeholders[db];
  }

  // ── Submit Module ──────────────────────────────────────────────────────────
  function submitModule() {
    try {
      const moduleName = document.getElementById('moduleName').value.trim();
      const fields     = document.getElementById('fields').value.trim();

      if (!moduleName) { log('Module name is required.', 'error'); return; }
      if (!/^[A-Za-z][A-Za-z0-9]*$/.test(moduleName)) { log("Module name must start with a letter and contain only letters and digits (e.g. Product).", 'error'); return; }
      if (!fields)     { log('Fields are required.',      'error'); return; }

      const language   = document.getElementById('language').value;
      const database   = document.getElementById('database').value;
      const dblink     = document.getElementById('dblink').value.trim();
      const port       = document.getElementById('port').value.trim() || '3000';

      if (!dblink) { log('Connection string is required.', 'error'); return; }

      setLoading('btnModule', true);
      log('Starting module generation...', 'info');
      const structure = document.getElementById('structure').value;
      vscode.postMessage({ command: 'generateModule', moduleName, fields, language, database, dblink, port, structure });
    } catch (e) {
      log('UI Error: ' + e.message, 'error');
    }
  }

  // ── Submit Full Backend ────────────────────────────────────────────────────
  function submitFull() {
    try {
      const moduleName = document.getElementById('fullModuleName').value.trim();
      const fields     = document.getElementById('fullFields').value.trim();
      const language   = document.getElementById('fullLanguage').value;
      const database   = document.getElementById('fullDatabase').value;
      const dblink     = document.getElementById('fullDblink').value.trim();
      const port       = document.getElementById('fullPort').value.trim() || '3000';

      if (!moduleName) { log('Module name is required.', 'error'); return; }
      if (!/^[A-Za-z][A-Za-z0-9]*$/.test(moduleName)) { log("Module name must start with a letter and contain only letters and digits (e.g. Product).", 'error'); return; }
      if (!fields)     { log('Fields are required.',      'error'); return; }
      if (!dblink)     { log('Connection string is required.', 'error'); return; }

      setLoading('btnFull', true);
      log('Starting full backend generation (Advanced structure)...', 'info');
      vscode.postMessage({ command: 'generateFullBackend', moduleName, fields, language, database, dblink, port });
    } catch (e) {
      log('UI Error: ' + e.message, 'error');
    }
  }

  // ── Submit Add Module ──────────────────────────────────────────────────────
  function submitAddModule() {
    try {
      const moduleName = document.getElementById('addModuleName').value.trim();
      const fields     = document.getElementById('addFields').value.trim();

      if (!moduleName) { log('Module name is required.', 'error'); return; }
      if (!/^[A-Za-z][A-Za-z0-9]*$/.test(moduleName)) { log("Module name must start with a letter and contain only letters and digits (e.g. Order).", 'error'); return; }
      if (!fields)     { log('Fields are required.',     'error'); return; }

      setLoading('btnAdd', true);
      log('Detecting project structure and adding module...', 'info');
      vscode.postMessage({ command: 'addModule', moduleName, fields });
    } catch (e) {
      log('UI Error: ' + e.message, 'error');
    }
  }

  // ── Submit Auth ────────────────────────────────────────────────────────────
  function submitAuth() {
    try {
      const language = document.getElementById('authLanguage').value;
      setLoading('btnAuth', true);
      log('Starting auth generation...', 'info');
      vscode.postMessage({ command: 'generateAuth', language });
    } catch (e) {
      log('UI Error: ' + e.message, 'error');
    }
  }

  // ── Copy mount snippet ─────────────────────────────────────────────────────
  function copyMountSnippet() {
    try {
      const lang = document.getElementById('authLanguage').value;
      const snip = lang === 'TypeScript'
        ? "import authRouter from './routes/auth.routes';\\napp.use('/api/auth', authRouter);"
        : "const authRouter = require('./routes/auth.routes');\\napp.use('/api/auth', authRouter);";
      
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(snip).then(() => log('Mount snippet copied to clipboard ✓', 'success')).catch(e => log('Copy failed: ' + e.message, 'error'));
      } else {
        log('Clipboard API not available in this context.', 'error');
      }
    } catch (e) {
      log('Copy error: ' + e.message, 'error');
    }
  }

  // ── Log helpers ────────────────────────────────────────────────────────────
  function log(text, type = 'info') {
    const el = document.getElementById('log');
    // Clear placeholder on first real message
    if (el.querySelector('.log-muted')) el.innerHTML = '';
    const line = document.createElement('div');
    line.className = 'log-entry log-' + type;
    line.textContent = (type === 'success' ? '✓ ' : type === 'error' ? '✗ ' : '» ') + text;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
  }

  function setLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) { return; }
    btn.disabled = loading;
    if (btnId === 'btnModule') {
      btn.textContent = loading ? '⏳ Working...' : '▶ Generate Module';
    } else if (btnId === 'btnAuth') {
      btn.textContent = loading ? '⏳ Working...' : '▶ Generate Auth';
    } else if (btnId === 'btnFull') {
      btn.textContent = loading ? '⏳ Working...' : '🚀 Generate Full Backend';
    } else if (btnId === 'btnAdd') {
      btn.textContent = loading ? '⏳ Adding...' : '➕ Add Module to Backend';
    }
  }

  // ── Receive messages from extension ───────────────────────────────────────
  window.addEventListener('message', (e) => {
    const { command, text, type } = e.data;
    if (command === 'status') {
      log(text, type);
      if (type === 'success' || type === 'error') {
        setLoading('btnModule', false);
        setLoading('btnAuth',   false);
        setLoading('btnFull',   false);
        setLoading('btnAdd',    false);
      }
    } else if (command === 'backendGenerated') {
      switchTab('add');
      log('Backend generated — use the ➕ Add tab to add more modules.', 'success');
    }
  });
</script>
</body>
</html>`;
  }
}
