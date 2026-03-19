import type { ComponentType } from "react";
import ReactQrCode, { type QRCodeProps } from "react-qr-code";

type QRCodeModuleShape = {
  QRCode?: ComponentType<QRCodeProps>;
  default?: ComponentType<QRCodeProps>;
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const moduleValue = ReactQrCode as unknown;

// Vite resolves this CJS package as a wrapped namespace, so normalize it here.
const QRCode =
  (isObject(moduleValue) && "default" in moduleValue
    ? (moduleValue as QRCodeModuleShape).default
    : undefined) ??
  (isObject(moduleValue) && "QRCode" in moduleValue
    ? (moduleValue as QRCodeModuleShape).QRCode
    : undefined) ??
  (ReactQrCode as unknown as ComponentType<QRCodeProps>);

export { QRCode };
export type { QRCodeProps };
export default QRCode;
