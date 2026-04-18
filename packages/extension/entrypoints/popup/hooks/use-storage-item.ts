import * as React from "react";

type StorageItem<TValue> = {
  getValue: () => Promise<TValue>;
  setValue: (value: TValue) => Promise<void>;
  watch: (callback: (value: TValue) => void) => () => void;
};

export function useStorageItem<TValue>(item: StorageItem<TValue>) {
  const [value, setValue] = React.useState<TValue | null>(null);

  React.useEffect(() => {
    let mounted = true;

    void item.getValue().then(nextValue => {
      if (mounted) {
        setValue(nextValue);
      }
    });

    const unwatch = item.watch(nextValue => {
      setValue(nextValue);
    });

    return () => {
      mounted = false;
      unwatch();
    };
  }, [item]);

  const setStoredValue = React.useEffectEvent(async (nextValue: TValue) => {
    await item.setValue(nextValue);
  });

  return [value, setStoredValue] as const;
}
