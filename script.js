document.addEventListener('DOMContentLoaded', () => {

  // ─── STATE ───────────────────────────────────────────────────────────────
  const state = {
    projects: [
      { id: 1, name: 'hostack-deploy', repo: 'https://github.com/user/hostack-deploy', framework: 'next', branch: 'main', status: 'active' },
      { id: 2, name: 'api-server', repo: 'https://github.com/user/api-server', framework: 'express', branch: 'main', status: 'active' },
      { id: 3, name: 'frontend', repo: 'https://github.com/user/frontend', framework: 'react', branch: 'main', status: 'active' },
      { id: 4, name: 'n8n-automation', repo: 'https://github.com/user/n8n-automation', framework: 'other', branch: 'main', status: 'idle' },
    ],
    deployments: [
      { id: 1, project: 'hostack-deploy', commit: 'a1b2c3d', message: 'feat: add deploy button', status: 'success', duration: '38s', triggered: '2 min ago', logs: '> pnpm install --frozen-lockfile\nDone in 12.3s\n> pnpm run build\nvite v5.0.0 building...\n✓ 142 modules transformed\ndist/index.html  0.45 kB\ndist/assets/index-abc.js  142.3 kB\n✓ Build complete in 26s\n✓ Deployed successfully' },
      { id: 2, project: 'api-server', commit: 'e4f5g6h', message: 'fix: cors headers', status: 'success', duration: '22s', triggered: '1 hr ago', logs: '> pnpm install --frozen-lockfile\nDone in 8.1s\n> pnpm run build\nCompiled successfully\n✓ Build complete in 14s\n✓ Deployed successfully' },
      { id: 3, project: 'frontend', commit: 'i7j8k9l', message: 'chore: update deps', status: 'failed', duration: '15s', triggered: '3 hr ago', logs: '> pnpm install --frozen-lockfile\nDone in 9.2s\n> pnpm run build\nERROR: Cannot find module \'react-dom\'\n✗ Build failed after 15s' },
      { id: 4, project: 'hostack-deploy', commit: 'm1n2o3p', message: 'refactor: clean up routes', status: 'success', duration: '41s', triggered: '1 day ago', logs: '> pnpm install --frozen-lockfile\nDone in 11.8s\n> pnpm run build\n✓ 138 modules transformed\n✓ Build complete in 29s\n✓ Deployed successfully' },
      { id: 5, project: 'n8n-automation', commit: 'q4r5s6t', message: 'init: first commit', status: 'building', duration: '—', triggered: 'just now', logs: '> pnpm install --frozen-lockfile\nInstalling dependencies...' },
    ],
    envVars: [
      { id: 1, project: 'hostack-deploy', key: 'DATABASE_URL', value: 'postgres://user:pass@host/db', env: 'production', hidden: true },
      { id: 2, project: 'hostack-deploy', key: 'JWT_SECRET', value: 'super-secret-key-123', env: 'production', hidden: true },
      { id: 3, project: 'api-server', key: 'PORT', value: '3000', env: 'production', hidden: false },
      { id: 4, project: 'api-server', key: 'REDIS_URL', value: 'redis://localhost:6379', env: 'production', hidden: true },
      { id: 5, project: 'frontend', key: 'VITE_API_URL', value: 'https://api.example.com', env: 'production', hidden: false },
    ],
    domains: ['hostack.example.com', 'deploy.myapp.io'],
    buildRules: {
      buildCmd: 'pnpm run build',
      outputDir: 'dist',
      installCmd: 'pnpm install --frozen-lockfile',
      nodeVersion: '20',
    },
    currentTab: 'dashboard',
    deploymentFilter: 'all',
    envVarProject: 'hostack-deploy',
    nextProjectId: 5,
    nextDeploymentId: 6,
    nextEnvId: 6,
  };

  // ─── TOAST ────────────────────────────────────────────────────────────────
  let toastTimeout;
  function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const icon = document.getElementById('toast-icon');
    const msg = document.getElementById('toast-message');
    icon.textContent = type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ';
    msg.textContent = message;
    toast.classList.remove('hidden');
    toast.style.backgroundColor = type === 'error' ? '#dc2626' : type === 'warning' ? '#d97706' : '#111827';
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.add('hidden'), 3500);
  }

  // ─── TAB SWITCHING ────────────────────────────────────────────────────────
  function switchTab(tabName) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.remove('active-tab', 'border-blue-600', 'text-blue-600');
      b.classList.add('border-transparent', 'text-gray-500');
    });
    const panel = document.getElementById('tab-' + tabName);
    if (panel) panel.classList.remove('hidden');
    const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    if (activeBtn) {
      activeBtn.classList.add('active-tab', 'border-blue-600', 'text-blue-600');
      activeBtn.classList.remove('border-transparent', 'text-gray-500');
    }
    state.currentTab = tabName;
    if (tabName === 'dashboard') renderDashboard();
    if (tabName === 'projects') renderProjects();
    if (tabName === 'deployments') renderDeployments();
    if (tabName === 'envvars') renderEnvVars();
    if (tabName === 'settings') renderSettings();
  }

  // Initialize tab styles
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.add('border-transparent', 'text-gray-500');
  });

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });

  // ─── RENDER DASHBOARD ─────────────────────────────────────────────────────
  function renderDashboard() {
    document.getElementById('stat-projects').textContent = state.projects.length;
    document.getElementById('stat-deployments').textContent = state.deployments.length;

    const container = document.getElementById('dashboard-recent-deployments');
    const recent = state.deployments.slice(0, 4);
    container.innerHTML = recent.map(d => `
      <div class="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
        <div class="flex items-center gap-3">
          <div class="w-2 h-2 rounded-full ${d.status === 'success' ? 'bg-green-500' : d.status === 'failed' ? 'bg-red-500' : 'bg-yellow-400'}"></div>
          <div>
            <div class="text-sm font-medium text-gray-900">${d.project}</div>
            <div class="text-xs text-gray-500">${d.message} · ${d.triggered}</div>
          </div>
        </div>
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(d.status)}">${d.status}</span>
      </div>
    `).join('');
  }

  // ─── RENDER PROJECTS ──────────────────────────────────────────────────────
  function renderProjects() {
    const grid = document.getElementById('projects-grid');
    const frameworkLabels = { react: 'React / Vite', next: 'Next.js', express: 'Express API', static: 'Static HTML', other: 'Other' };
    grid.innerHTML = state.projects.map(p => `
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col gap-4">
        <div class="flex items-start justify-between">
          <div>
            <h3 class="text-base font-semibold text-gray-900">${p.name}</h3>
            <p class="text-xs text-gray-500 mt-0.5 truncate max-w-[180px]">${p.repo}</p>
          </div>
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}">${p.status}</span>
        </div>
        <div class="flex items-center gap-2 text-xs text-gray-500">
          <span class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">${frameworkLabels[p.framework] || p.framework}</span>
          <span>branch: <strong>${p.branch}</strong></span>
        </div>
        <div class="flex gap-2 mt-auto">
          <button class="btn-deploy-project flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium py-1.5 px-3 rounded-lg transition-colors" data-id="${p.id}">Deploy</button>
          <button class="btn-delete-project bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium py-1.5 px-3 rounded-lg transition-colors" data-id="${p.id}">Delete</button>
        </div>
      </div>
    `).join('');

    // Wire project deploy buttons
    document.querySelectorAll('.btn-deploy-project').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        const project = state.projects.find(p => p.id === id);
        if (!project) return;
        triggerDeployForProject(project.name);
      });
    });

    // Wire project delete buttons
    document.querySelectorAll('.btn-delete-project').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        if (!confirm('Are you sure you want to delete this project?')) return;
        state.projects = state.projects.filter(p => p.id !== id);
        renderProjects();
        renderDashboard();
        showToast('Project deleted', 'success');
      });
    });
  }

  // ─── RENDER DEPLOYMENTS ───────────────────────────────────────────────────
  function renderDeployments() {
    const tbody = document.getElementById('deployments-tbody');
    const filter = state.deploymentFilter;
    const filtered = filter === 'all' ? state.deployments : state.deployments.filter(d => d.project === filter);

    tbody.innerHTML = filtered.map(d => `
      <tr class="hover:bg-gray-50 transition-colors">
        <td class="px-6 py-4 text-sm font-medium text-gray-900">${d.project}</td>
        <td class="px-6 py-4 text-sm text-gray-600 font-mono">${d.commit} <span class="text-gray-400 font-sans text-xs">${d.message}</span></td>
        <td class="px-6 py-4"><span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(d.status)}">${d.status}</span></td>
        <td class="px-6 py-4 text-sm text-gray-600">${d.duration}</td>
        <td class="px-6 py-4 text-sm text-gray-500">${d.triggered}</td>
        <td class="px-6 py-4">
          <button class="btn-view-logs text-blue-600 hover:text-blue-800 text-xs font-medium underline" data-id="${d.id}">View Logs</button>
        </td>
      </tr>
    `).join('');

    // Wire log buttons
    document.querySelectorAll('.btn-view-logs').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        const dep = state.deployments.find(d => d.id === id);
        if (!dep) return;
        document.getElementById('log-modal-title').textContent = `Build Logs — ${dep.project} @ ${dep.commit}`;
        document.getElementById('log-modal-content').textContent = dep.logs;
        document.getElementById('log-modal').classList.remove('hidden');
      });
    });
  }

  // ─── RENDER ENV VARS ──────────────────────────────────────────────────────
  function renderEnvVars() {
    const tbody = document.getElementById('envvars-tbody');
    const project = state.envVarProject;
    const vars = state.envVars.filter(v => v.project === project);

    tbody.innerHTML = vars.length === 0
      ? `<tr><td colspan="4" class="px-6 py-8 text-center text-sm text-gray-400">No environment variables for this project.</td></tr>`
      : vars.map(v => `
        <tr class="hover:bg-gray-50 transition-colors">
          <td class="px-6 py-4 text-sm font-mono font-medium text-gray-900">${v.key}</td>
          <td class="px-6 py-4 text-sm font-mono text-gray-600">
            <span id="env-val-${v.id}">${v.hidden ? '••••••••••••' : v.value}</span>
            <button class="btn-toggle-env ml-2 text-xs text-blue-500 hover:text-blue-700" data-id="${v.id}">${v.hidden ? 'Show' : 'Hide'}</button>
          </td>
          <td class="px-6 py-4"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">${v.env}</span></td>
          <td class="px-6 py-4">
            <button class="btn-delete-env text-red-500 hover:text-red-700 text-xs font-medium" data-id="${v.id}">Delete</button>
          </td>
        </tr>
      `).join('');

    // Wire toggle visibility
    document.querySelectorAll('.btn-toggle-env').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        const envVar = state.envVars.find(v => v.id === id);
        if (!envVar) return;
        envVar.hidden = !envVar.hidden;
        renderEnvVars();
      });
    });

    // Wire delete env var
    document.querySelectorAll('.btn-delete-env').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        if (!confirm('Delete this environment variable?')) return;
        state.envVars = state.envVars.filter(v => v.id !== id);
        renderEnvVars();
        showToast('Environment variable deleted', 'success');
      });
    });
  }

  // ─── RENDER SETTINGS ──────────────────────────────────────────────────────
  function renderSettings() {
    document.getElementById('setting-build-cmd').value = state.buildRules.buildCmd;
    document.getElementById('setting-output-dir').value = state.buildRules.outputDir;
    document.getElementById('setting-install-cmd').value = state.buildRules.installCmd;
    document.getElementById('setting-node-version').value = state.buildRules.nodeVersion;
    renderDomains();
  }

  function renderDomains() {
    const list = document.getElementById('domains-list');
    list.innerHTML = state.domains.length === 0
      ? `<p class="text-sm text-gray-400">No custom domains added.</p>`
      : state.domains.map((d, i) => `
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full bg-green-500"></div>
            <span class="text-sm font-medium text-gray-900">${d}</span>
          </div>
          <button class="btn-remove-domain text-red-500 hover:text-red-700 text-xs font-medium" data-index="${i}">Remove</button>
        </div>
      `).join('');

    document.querySelectorAll('.btn-remove-domain').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        const removed = state.domains[idx];
        state.domains.splice(idx, 1);
        renderDomains();
        showToast(`Domain "${removed}" removed`, 'success');
      });
    });
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────
  function statusBadgeClass(status) {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-700';
      case 'failed': return 'bg-red-100 text-red-700';
      case 'building': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  }

  function triggerDeployForProject(projectName) {
    const newDeploy = {
      id: state.nextDeploymentId++,
      project: projectName,
      commit: Math.random().toString(16).slice(2, 9),
      message: 'manual: triggered deploy',
      status: 'building',
      duration: '—',
      triggered: 'just now',
      logs: `> pnpm install --frozen-lockfile\nInstalling dependencies...\n[Build in progress]`,
    };
    state.deployments.unshift(newDeploy);
    showToast(`Deploy triggered for ${projectName}`, 'success');

    // Simulate build completing after 3s
    setTimeout(() => {
      const dep = state.deployments.find(d => d.id === newDeploy.id);
      if (dep) {
        dep.status = 'success';
        dep.duration = Math.floor(Math.random() * 30 + 20) + 's';
        dep.logs += '\n> pnpm run build\n✓ Build complete\n✓ Deployed successfully';
        if (state.currentTab === 'deployments') renderDeployments();
        if (state.currentTab === 'dashboard') renderDashboard();
        showToast(`${projectName} deployed successfully!`, 'success');
      }
    }, 3000);

    if (state.currentTab === 'deployments') renderDeployments();
    if (state.currentTab === 'dashboard') renderDashboard();
  }

  // ─── BUTTON: NEW PROJECT (nav) ────────────────────────────────────────────
  document.getElementById('btn-new-project').addEventListener('click', () => {
    switchTab('projects');
    document.getElementById('add-project-form').classList.remove('hidden');
    document.getElementById('new-project-name').focus();
  });

  // ─── BUTTON: ADD PROJECT ──────────────────────────────────────────────────
  document.getElementById('btn-add-project').addEventListener('click', () => {
    const form = document.getElementById('add-project-form');
    form.classList.toggle('hidden');
    if (!form.classList.contains('hidden')) {
      document.getElementById('new-project-name').focus();
    }
  });

  // ─── BUTTON: SAVE PROJECT ─────────────────────────────────────────────────
  document.getElementById('btn-save-project').addEventListener('click', () => {
    const name = document.getElementById('new-project-name').value.trim();
    const repo = document.getElementById('new-project-repo').value.trim();
    const framework = document.getElementById('new-project-framework').value;
    const branch = document.getElementById('new-project-branch').value.trim() || 'main';

    if (!name) { showToast('Project name is required', 'error'); return; }
    if (!repo) { showToast('GitHub repo URL is required', 'error'); return; }
    if (!repo.startsWith('https://github.com/')) { showToast('Please enter a valid GitHub URL', 'error'); return; }
    if (state.projects.find(p => p.name === name)) { showToast('A project with that name already exists', 'error'); return; }

    const newProject = { id: state.nextProjectId++, name, repo, framework, branch, status: 'active' };
    state.projects.push(newProject);

    // Reset form
    document.getElementById('new-project-name').value = '';
    document.getElementById('new-project-repo').value = '';
    document.getElementById('new-project-branch').value = 'main';
    document.getElementById('add-project-form').classList.add('hidden');

    renderProjects();
    renderDashboard();
    showToast(`Project "${name}" connected successfully!`, 'success');

    // Simulate API call
    fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('token') || '') },
      body: JSON.stringify({ name, repo, framework, branch }),
    }).catch(() => { /* offline mode — state already updated */ });
  });

  // ─── BUTTON: CANCEL PROJECT ───────────────────────────────────────────────
  document.getElementById('btn-cancel-project').addEventListener('click', () => {
    document.getElementById('add-project-form').classList.add('hidden');
    document.getElementById('new-project-name').value = '';
    document.getElementById('new-project-repo').value = '';
    document.getElementById('new-project-branch').value = 'main';
  });

  // ─── BUTTON: TRIGGER DEPLOY ───────────────────────────────────────────────
  document.getElementById('btn-trigger-deploy').addEventListener('click', () => {
    const filter = state.deploymentFilter;
    const projectName = filter === 'all' ? state.projects[0]?.name : filter;
    if (!projectName) { showToast('No projects available to deploy', 'error'); return; }
    triggerDeployForProject(projectName);

    fetch('/api/deployments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('token') || '') },
      body: JSON.stringify({ project: projectName }),
    }).catch(() => {});
  });

  // ─── BUTTON: CLOSE LOG MODAL ──────────────────────────────────────────────
  document.getElementById('btn-close-log').addEventListener('click', () => {
    document.getElementById('log-modal').classList.add('hidden');
  });

  // Close modal on backdrop click
  document.getElementById('log-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('log-modal')) {
      document.getElementById('log-modal').classList.add('hidden');
    }
  });

  // ─── DEPLOYMENT FILTER ────────────────────────────────────────────────────
  document.getElementById('deployment-filter').addEventListener('change', (e) => {
    state.deploymentFilter = e.target.value;
    renderDeployments();
  });

  // ─── BUTTON: ADD ENV VAR ──────────────────────────────────────────────────
  document.getElementById('btn-add-env').addEventListener('click', () => {
    const form = document.getElementById('add-env-form');
    form.classList.toggle('hidden');
    if (!form.classList.contains('hidden')) {
      document.getElementById('new-env-key').focus();
    }
  });

  // ─── BUTTON: SAVE ENV VAR ─────────────────────────────────────────────────
  document.getElementById('btn-save-env').addEventListener('click', () => {
    const key = document.getElementById('new-env-key').value.trim().toUpperCase();
    const value = document.getElementById('new-env-value').value.trim();
    const project = state.envVarProject;

    if (!key) { showToast('Variable key is required', 'error'); return; }
    if (!value) { showToast('Variable value is required', 'error'); return; }
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) { showToast('Key must be uppercase letters, numbers, and underscores', 'error'); return; }
    if (state.envVars.find(v => v.project === project && v.key === key)) {
      showToast(`Variable "${key}" already exists for this project`, 'error'); return;
    }

    state.envVars.push({ id: state.nextEnvId++, project, key, value, env: 'production', hidden: true });
    document.getElementById('new-env-key').value = '';
    document.getElementById('new-env-value').value = '';
    document.getElementById('add-env-form').classList.add('hidden');
    renderEnvVars();
    showToast(`Variable "${key}" saved`, 'success');

    fetch('/api/env-vars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('token') || '') },
      body: JSON.stringify({ project, key, value }),
    }).catch(() => {});
  });

  // ─── BUTTON: CANCEL ENV VAR ───────────────────────────────────────────────
  document.getElementById('btn-cancel-env').addEventListener('click', () => {
    document.getElementById('add-env-form').classList.add('hidden');
    document.getElementById('new-env-key').value = '';
    document.getElementById('new-env-value').value = '';
  });

  // ─── ENV VAR PROJECT SELECT ───────────────────────────────────────────────
  document.getElementById('envvar-project-select').addEventListener('change', (e) => {
    state.envVarProject = e.target.value;
    renderEnvVars();
  });

  // ─── BUTTON: SAVE BUILD RULES ─────────────────────────────────────────────
  document.getElementById('btn-save-build-rules').addEventListener('click', () => {
    const buildCmd = document.getElementById('setting-build-cmd').value.trim();
    const outputDir = document.getElementById('setting-output-dir').value.trim();
    const installCmd = document.getElementById('setting-install-cmd').value.trim();
    const nodeVersion = document.getElementById('setting-node-version').value;

    if (!buildCmd) { showToast('Build command cannot be empty', 'error'); return; }
    if (!outputDir) { showToast('Output directory cannot be empty', 'error'); return; }
    if (!installCmd) { showToast('Install command cannot be empty', 'error'); return; }

    state.buildRules = { buildCmd, outputDir, installCmd, nodeVersion };

    fetch('/api/settings/build-rules', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('token') || '') },
      body: JSON.stringify(state.buildRules),
    }).then(res => {
      if (!res.ok) throw new Error('Failed to save');
      showToast('Build rules saved successfully!', 'success');
    }).catch(() => {
      showToast('Build rules saved locally', 'success');
    });
  });

  // ─── BUTTON: ADD DOMAIN ───────────────────────────────────────────────────
  document.getElementById('btn-add-domain').addEventListener('click', () => {
    const input = document.getElementById('new-domain-input');
    const domain = input.value.trim().toLowerCase();
    if (!domain) { showToast('Please enter a domain name', 'error'); return; }
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) { showToast('Please enter a valid domain (e.g. app.example.com)', 'error'); return; }
    if (state.domains.includes(domain)) { showToast('Domain already added', 'error'); return; }

    state.domains.push(domain);
    input.value = '';
    renderDomains();
    showToast(`Domain "${domain}" added`, 'success');

    fetch('/api/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('token') || '') },
      body: JSON.stringify({ domain }),
    }).catch(() => {});
  });

  // ─── BUTTON: RESET SETTINGS ───────────────────────────────────────────────
  document.getElementById('btn-reset-settings').addEventListener('click', () => {
    if (!confirm('Are you sure you want to reset ALL settings? This cannot be undone.')) return;
    state.buildRules = {
      buildCmd: 'pnpm run build',
      outputDir: 'dist',
      installCmd: 'pnpm install --frozen-lockfile',
      nodeVersion: '20',
    };
    state.domains = [];