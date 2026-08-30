export function clampOutlinePercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

export function getComparisonProportions(outlinePercent: number) {
  const outline = clampOutlinePercent(outlinePercent);

  return {
    colored: 100 - outline,
    outline,
  };
}

export function getComparisonValueText(outlinePercent: number) {
  const outline = Math.round(clampOutlinePercent(outlinePercent));
  const colored = 100 - outline;

  return `Цветная версия ${colored}%, контур ${outline}%`;
}

export function getComparisonLiveText(outlinePercent: number) {
  const outline = Math.round(clampOutlinePercent(outlinePercent));
  const colored = 100 - outline;

  return `Показано: цветная версия ${colored}%, контур ${outline}%`;
}

export function isComparisonAdjustmentKey(key: string) {
  return [
    "Home",
    "End",
    "ArrowLeft",
    "ArrowDown",
    "ArrowRight",
    "ArrowUp",
    "PageDown",
    "PageUp",
  ].includes(key);
}

export function getComparisonKeyboardValue(key: string, currentValue: number) {
  switch (key) {
    case "Home":
      return 0;
    case "End":
      return 100;
    case "ArrowLeft":
    case "ArrowDown":
      return clampOutlinePercent(currentValue - 1);
    case "ArrowRight":
    case "ArrowUp":
      return clampOutlinePercent(currentValue + 1);
    case "PageDown":
      return clampOutlinePercent(currentValue - 10);
    case "PageUp":
      return clampOutlinePercent(currentValue + 10);
    default:
      return undefined;
  }
}

type ComparisonImageKind = "colored" | "outline";

type ComparisonImageState = {
  attempt: number;
  coloredReady: boolean;
  outlineReady: boolean;
  hasError: boolean;
};

type ComparisonImageAction =
  | { type: "loaded"; kind: ComparisonImageKind; attempt: number }
  | { type: "failed"; attempt: number }
  | { type: "retry" };

export function createComparisonImageState(attempt = 0): ComparisonImageState {
  return {
    attempt,
    coloredReady: false,
    outlineReady: false,
    hasError: false,
  };
}

export function comparisonImageReducer(
  state: ComparisonImageState,
  action: ComparisonImageAction,
): ComparisonImageState {
  if (action.type === "retry") {
    return createComparisonImageState(state.attempt + 1);
  }

  if (action.attempt !== state.attempt) {
    return state;
  }

  if (action.type === "failed") {
    return state.hasError ? state : { ...state, hasError: true };
  }

  return {
    ...state,
    [`${action.kind}Ready`]: true,
  };
}

export function areComparisonImagesReady(state: ComparisonImageState) {
  return state.coloredReady && state.outlineReady && !state.hasError;
}
