const { STATES, EVENTS, transition } = require("../../../../src/modules/journeys/dialog/dialog.manager");

describe("DialogManager (FSM)", () => {
  test("deve iniciar e transicionar corretamente a partir do estado IDLE", () => {
    expect(transition(STATES.IDLE, EVENTS.START)).toBe(STATES.WAITING_DESTINATION);
    expect(transition(STATES.IDLE, EVENTS.DESTINATION_RESOLVED)).toBe(STATES.JOURNEY_DISPLAYED);
    expect(transition(STATES.IDLE, EVENTS.DESTINATION_AMBIGUOUS)).toBe(STATES.WAITING_DESTINATION_SELECTION);
    expect(transition(STATES.IDLE, EVENTS.DESTINATION_NEEDS_CONFIRMATION)).toBe(STATES.WAITING_CONFIRMATION);
  });

  test("deve transicionar corretamente a partir de WAITING_DESTINATION_SELECTION", () => {
    expect(transition(STATES.WAITING_DESTINATION_SELECTION, EVENTS.OPTION_SELECTED)).toBe(STATES.JOURNEY_DISPLAYED);
    expect(transition(STATES.WAITING_DESTINATION_SELECTION, EVENTS.CANCEL)).toBe(STATES.IDLE);
    expect(transition(STATES.WAITING_DESTINATION_SELECTION, EVENTS.REJECT)).toBe(STATES.WAITING_DESTINATION);
  });

  test("deve transicionar corretamente a partir de WAITING_CONFIRMATION", () => {
    expect(transition(STATES.WAITING_CONFIRMATION, EVENTS.CONFIRM)).toBe(STATES.JOURNEY_DISPLAYED);
    expect(transition(STATES.WAITING_CONFIRMATION, EVENTS.REJECT)).toBe(STATES.WAITING_DESTINATION);
    expect(transition(STATES.WAITING_CONFIRMATION, EVENTS.CANCEL)).toBe(STATES.IDLE);
  });

  test("deve manter o mesmo estado caso o evento seja inválido para a transição", () => {
    expect(transition(STATES.JOURNEY_DISPLAYED, EVENTS.CONFIRM)).toBe(STATES.JOURNEY_DISPLAYED);
    expect(transition(STATES.WAITING_CONFIRMATION, EVENTS.DESTINATION_RESOLVED)).toBe(STATES.WAITING_CONFIRMATION);
  });
});
