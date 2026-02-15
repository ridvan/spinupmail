export type SignInFormValues = {
  captchaToken: string;
  email: string;
  password: string;
};

export type SignUpFormValues = {
  captchaToken: string;
  name: string;
  email: string;
  password: string;
};

export type SignInFormErrors = Partial<Record<keyof SignInFormValues, string>>;
export type SignUpFormErrors = Partial<Record<keyof SignUpFormValues, string>>;
