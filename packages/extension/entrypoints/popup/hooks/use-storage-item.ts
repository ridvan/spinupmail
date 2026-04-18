import * as React from "react";

type StorageItem<TValue> = {
  getValue: () => Promise<TValue>;
  setValue: (value: TValue) => Promise<void>;
  watch: (callback: (value: TValue) => void) => () => void;
};

type StorageValueUpdater<TValue> = TValue | ((value: TValue | null) => TValue);

export function useStorageItem<TValue>(item: StorageItem<TValue>) {
  const [value, setValue] = React.useState<TValue | null>(null);
  const valueRef = React.useRef<TValue | null>(null);

  React.useEffect(() => {
    valueRef.current = value;
  }, [value]);

  React.useEffect(() => {
    let mounted = true;
    let receivedWatchValue = false;

    const applyValue = (nextValue: TValue) => {
      valueRef.current = nextValue;
      setValue(currentValue =>
        Object.is(currentValue, nextValue) ? currentValue : nextValue
      );
    };

    const unwatch = item.watch(nextValue => {
      receivedWatchValue = true;

      if (!mounted) {
        return;
      }

      applyValue(nextValue);
    });

    void item.getValue().then(nextValue => {
      if (!mounted) {
        return;
      }

      if (receivedWatchValue && !Object.is(valueRef.current, nextValue)) {
        return;
      }

      if (Object.is(valueRef.current, nextValue)) {
        return;
      }

      applyValue(nextValue);
    });

    return () => {
      mounted = false;
      unwatch();
    };
  }, [item]);

  const setStoredValue = React.useEffectEvent(
    async (nextValueOrUpdater: StorageValueUpdater<TValue>) => {
      const nextValue =
        typeof nextValueOrUpdater === "function"
          ? (nextValueOrUpdater as (value: TValue | null) => TValue)(
              valueRef.current
            )
          : nextValueOrUpdater;

      valueRef.current = nextValue;
      setValue(nextValue);
      await item.setValue(nextValue);
    }
  );

  return [value, setStoredValue] as const;
}
