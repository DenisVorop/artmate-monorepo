export type LoginFormState = {
  error?: string;
  values: {
    login: string;
  };
};

export const initialLoginFormState: LoginFormState = {
  values: {
    login: "",
  },
};
