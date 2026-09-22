export function createDashboardStore(initialData = null, onListenerError = () => {}) {
  let state = { status: initialData ? 'ready' : 'welcome', data: initialData };
  const listeners = new Set();
  function notify() {
    for (const listener of listeners) {
      try { listener(state); }
      catch (error) { onListenerError(error); }
    }
  }

  return {
    getState() { return state; },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    replaceData(data) {
      state = { status: 'ready', data };
      notify();
      return state;
    },
    showWelcome() {
      state = { ...state, status: 'welcome' };
      notify();
      return state;
    },
  };
}
