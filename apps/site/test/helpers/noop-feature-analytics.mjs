// These UI fixtures exercise interaction behavior without loading the analytics transport.
const noOp = () => {};
const actions = new Proxy({}, { get: () => noOp });

export const noopFeatureAnalytics = { useAnalytics: () => actions };
