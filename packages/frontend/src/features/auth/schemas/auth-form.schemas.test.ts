import {
  validateSignIn,
  validateSignUp,
} from "@/features/auth/schemas/auth-form.schemas";

describe("auth form validation", () => {
  it("validates sign-in required fields", () => {
    const errors = validateSignIn({
      email: "",
      password: "",
      captchaToken: "",
    });

    expect(errors.email).toBe("Email is required");
    expect(errors.password).toBe("Password is required");
    expect(errors.captchaToken).toBe("Complete the captcha challenge");
  });

  it("validates sign-up password and email format", () => {
    const errors = validateSignUp({
      name: "A",
      email: "not-an-email",
      password: "short",
      captchaToken: "token",
    });

    expect(errors.name).toContain("at least 2");
    expect(errors.email).toBe("Enter a valid email");
    expect(errors.password).toContain("at least 8");
  });
});
