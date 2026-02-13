import { useMutation } from "@tanstack/react-query";
import {
  type SignInFormValues,
  type SignUpFormValues,
} from "@/features/auth/types/auth.types";
import { authClient } from "@/lib/auth";

export const useSignInMutation = () => {
  return useMutation({
    mutationFn: async (values: SignInFormValues) => {
      const result = await authClient.signIn.email({
        email: values.email.trim(),
        password: values.password,
      });

      if (result.error) {
        throw new Error(result.error.message || "Sign in failed");
      }

      const signInData = result.data as { twoFactorRedirect?: boolean } | null;
      if (signInData?.twoFactorRedirect) {
        return { requiresTwoFactor: true };
      }

      await authClient.getSession();
      return { requiresTwoFactor: false };
    },
  });
};

export const useSignUpMutation = () => {
  return useMutation({
    mutationFn: async (values: SignUpFormValues) => {
      const result = await authClient.signUp.email({
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
      });

      if (result.error) {
        throw new Error(result.error.message || "Sign up failed");
      }

      await authClient.getSession();
      return result.data;
    },
  });
};
