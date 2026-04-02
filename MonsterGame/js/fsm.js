export class FiniteStateMachine {
  constructor(owner, initialState = 'IDLE') {
    this.owner = owner;
    this.currentState = initialState;
    this.previousState = null;
    this.states = new Map();
  }

  addState(name, config) {
    this.states.set(name, {
      onEnter: config.onEnter || (() => {}),
      onUpdate: config.onUpdate || (() => {}),
      onExit: config.onExit || (() => {}),
      transitions: config.transitions || [],
    });
    return this;
  }

  setState(nextState, context = {}) {
    if (!this.states.has(nextState) || this.currentState === nextState) {
      return;
    }

    const current = this.states.get(this.currentState);
    if (current) {
      current.onExit(this.owner, context);
    }

    this.previousState = this.currentState;
    this.currentState = nextState;
    this.states.get(this.currentState).onEnter(this.owner, context);
  }

  update(context = {}) {
    const active = this.states.get(this.currentState);
    if (!active) {
      return;
    }

    for (const transition of active.transitions) {
      if (transition.condition(this.owner, context)) {
        this.setState(transition.target, context);
        break;
      }
    }

    const refreshed = this.states.get(this.currentState);
    refreshed.onUpdate(this.owner, context);
  }
}
