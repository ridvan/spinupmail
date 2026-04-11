export class SpinupMailError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class SpinupMailValidationError extends SpinupMailError {
  readonly source: "request" | "response";
  readonly issues: string[];

  constructor(args: {
    message: string;
    source: "request" | "response";
    issues?: string[];
    cause?: unknown;
  }) {
    super(args.message, args.cause ? { cause: args.cause } : undefined);
    this.source = args.source;
    this.issues = args.issues ?? [];
  }
}

export class SpinupMailApiError extends SpinupMailError {
  readonly status: number;
  readonly response: Response;
  readonly body?: unknown;

  constructor(args: {
    message: string;
    status: number;
    response: Response;
    body?: unknown;
  }) {
    super(args.message);
    this.status = args.status;
    this.response = args.response;
    this.body = args.body;
  }
}

export class SpinupMailTimeoutError extends SpinupMailError {
  readonly timeoutMs: number;

  constructor(message: string, timeoutMs: number, options?: ErrorOptions) {
    super(message, options);
    this.timeoutMs = timeoutMs;
  }
}
