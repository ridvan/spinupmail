import type {
  SignInFormErrors,
  SignInFormValues,
  SignUpFormErrors,
  SignUpFormValues,
} from "@/features/auth/types/auth.types";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateSignIn = (values: SignInFormValues): SignInFormErrors => {
  const errors: SignInFormErrors = {};

  if (!values.email.trim()) {
    errors.email = "Email is required";
  } else if (!emailRegex.test(values.email.trim())) {
    errors.email = "Enter a valid email";
  }

  if (!values.password) {
    errors.password = "Password is required";
  }

  if (!values.captchaToken) {
    errors.captchaToken = "Complete the captcha challenge";
  }

  return errors;
};

export const validateSignUp = (values: SignUpFormValues): SignUpFormErrors => {
  const errors: SignUpFormErrors = {};

  if (!values.name.trim()) {
    errors.name = "Name is required";
  } else if (values.name.trim().length < 2) {
    errors.name = "Name must be at least 2 characters";
  }

  if (!values.email.trim()) {
    errors.email = "Email is required";
  } else if (!emailRegex.test(values.email.trim())) {
    errors.email = "Enter a valid email";
  }

  if (!values.password) {
    errors.password = "Password is required";
  } else if (values.password.length < 8) {
    errors.password = "Password must be at least 8 characters";
  }

  if (!values.captchaToken) {
    errors.captchaToken = "Complete the captcha challenge";
  }

  return errors;
};
