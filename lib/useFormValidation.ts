"use client";

import { useState, useCallback } from "react";

type ValidationRules<T> = {
  [K in keyof T]?: (value: T[K], allValues: T) => string | null;
};

export function useFormValidation<T extends Record<string, unknown>>(
  initialValues: T,
  rules: ValidationRules<T>
) {
  const [errors, setErrors] = useState<Partial<Record<keyof T, string | null>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});

  const validateField = useCallback(
    (field: keyof T, value: unknown, allValues: T) => {
      const rule = rules[field];
      if (rule) {
        const error = rule(value as T[keyof T], allValues);
        setErrors((prev) => ({ ...prev, [field]: error }));
        return error;
      }
      return null;
    },
    [rules]
  );

  const handleBlur = useCallback(
    (field: keyof T) => (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      validateField(field, e.target.value, initialValues);
    },
    [validateField, initialValues]
  );

  const handleChange = useCallback(
    (field: keyof T) => (value: unknown) => {
      if (touched[field]) {
        validateField(field, value, initialValues);
      }
    },
    [validateField, touched, initialValues]
  );

  const validateAll = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof T, string | null>> = {};
    let isValid = true;
    for (const field in rules) {
      const rule = rules[field];
      if (rule) {
        const error = rule(initialValues[field], initialValues);
        newErrors[field] = error;
        if (error) isValid = false;
      }
    }
    setErrors(newErrors);
    setTouched(Object.keys(rules).reduce((acc, k) => ({ ...acc, [k]: true }), {} as Partial<Record<keyof T, boolean>>));
    return isValid;
  }, [rules, initialValues]);

  const clearErrors = useCallback(() => {
    setErrors({});
    setTouched({});
  }, []);

  return {
    errors,
    touched,
    handleBlur,
    handleChange,
    validateAll,
    validateField,
    clearErrors,
    getFieldProps: (field: keyof T) => ({
      onBlur: handleBlur(field),
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> | T[keyof T]) =>
        handleChange(field)(
          e && typeof e === "object" && "target" in e ? (e.target as HTMLInputElement).value as T[keyof T] : (e as T[keyof T])
        ),
      "aria-invalid": !!errors[field],
      "aria-describedby": errors[field] ? `${String(field)}-error` : undefined,
    }),
  };
}
