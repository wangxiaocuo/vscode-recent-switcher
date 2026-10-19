/* global acquireVsCodeApi */
const vscode = acquireVsCodeApi();
const root = document.getElementById('projects');
const element = (tag, className, text) => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
window.addEventListener('message', ({ data }) => {
  if (data.type !== 'projects') return;
  const focused = document.activeElement;
  const focusKey = focused?.dataset.key;
  const focusIndex = Array.from(root.children).indexOf(focused?.closest('.project'));
  root.replaceChildren();
  data.projects.forEach((project, index) => {
    const row = element('div', `project ${project.state === 'open' ? 'is-open' : project.current ? 'current' : 'closed'}`);
    const open = element('button', 'open');
    open.dataset.key = `open:${project.key}`;
    open.title = `${project.tooltip}\nOpen Project`;
    open.setAttribute('aria-label', `${project.name}${project.current ? ', current project' : project.state === 'open' ? ', open in another window' : ', not detected in an open window'}, ${project.path}. Open project`);
    if (project.current) open.setAttribute('aria-current', 'true');
    const avatar = element('span', 'avatar', project.initials);
    avatar.setAttribute('aria-hidden', 'true');
    const copy = element('span', 'copy');
    copy.append(element('span', 'name', project.name), element('span', 'path', project.path));
    open.append(avatar, copy);
    if (project.current) {
      const check = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      check.setAttribute('class', 'check');
      check.setAttribute('viewBox', '0 0 16 16');
      check.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M3 8.5 6.3 12 13 4');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.6');
      check.append(path);
      open.append(check);
    }
    open.addEventListener('click', () => vscode.postMessage({ type: 'open', revision: data.revision, index }));
    row.append(open);
    if (project.state === 'closed') {
      const remove = element('button', 'remove', '×');
      remove.dataset.key = `remove:${project.key}`;
      remove.title = 'Remove from Recently Opened';
      remove.setAttribute('aria-label', `Remove ${project.name} from recently opened`);
      remove.addEventListener('click', () => {
        remove.disabled = true;
        vscode.postMessage({ type: 'remove', revision: data.revision, index });
      });
      row.append(remove);
    }
    root.append(row);
  });
  if (!data.projects.length) {
    const status = element('div', 'status', data.status?.label ?? 'No recent projects yet');
    status.title = data.status?.tooltip ?? '';
    const recent = element('button', '', 'Open Recent…');
    recent.addEventListener('click', () => vscode.postMessage({ type: 'recent' }));
    status.append(recent);
    root.append(status);
  }
  if (focusKey) {
    const previous = Array.from(root.querySelectorAll('button')).find(button => button.dataset.key === focusKey);
    const neighbor = root.children[Math.min(focusIndex, root.children.length - 1)];
    (previous ?? neighbor?.querySelector(focused.classList.contains('remove') ? '.remove' : '.open') ?? neighbor?.querySelector('.open') ?? root.querySelector('button'))?.focus();
  }
});
root.addEventListener('keydown', event => {
  const buttons = Array.from(root.querySelectorAll('.open'));
  const index = buttons.indexOf(document.activeElement);
  if (index < 0) return;
  const next = { ArrowDown: Math.min(index + 1, buttons.length - 1), ArrowUp: Math.max(0, index - 1), Home: 0, End: buttons.length - 1 }[event.key];
  if (next !== undefined) { event.preventDefault(); buttons[next]?.focus(); }
});
vscode.postMessage({ type: 'ready' });
