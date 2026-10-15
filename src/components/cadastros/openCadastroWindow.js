/**
 * Abertura única de Visualizador de Cadastros Gerais.
 * Usa uniqueKey do WindowManager para impedir duas janelas no mesmo clique
 * (Card + botão Abrir / duplo clique). Guard síncrono cobre race do setState.
 */

/** @type {Set<string>} */
const pendingOpenKeys = new Set();

/**
 * @param {(component: unknown, props?: object, options?: object) => string} openWindow
 * @param {object} args
 * @param {unknown} args.component
 * @param {string} args.entityName
 * @param {string} args.title
 * @param {object} [args.props]
 * @param {number} [args.width]
 * @param {number} [args.height]
 */
export function openCadastroEntityWindow(openWindow, {
  component,
  entityName,
  title,
  props = {},
  width = 1400,
  height = 800,
} = {}) {
  const entity = String(entityName || '').trim();
  const uniqueKey = entity ? `Cadastros.${entity}.visualizador` : `Cadastros.${String(title || 'janela')}`;
  if (pendingOpenKeys.has(uniqueKey)) {
    return openWindow(component, props, {
      title: title || entity || 'Cadastro',
      width,
      height,
      uniqueKey,
    });
  }
  pendingOpenKeys.add(uniqueKey);
  try {
    return openWindow(component, props, {
      title: title || entity || 'Cadastro',
      width,
      height,
      uniqueKey,
    });
  } finally {
    queueMicrotask(() => {
      pendingOpenKeys.delete(uniqueKey);
    });
  }
}
