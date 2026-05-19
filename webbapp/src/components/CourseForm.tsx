'use client';

import type { FormEvent } from 'react';

export type CourseFormValues = {
  clubName: string;
  courseName: string;
  teeName: string;
  holeCount: 9 | 18;
};

type Props = {
  values: CourseFormValues;
  onChange: (next: CourseFormValues) => void;
  onSubmit: () => void;
  submitLabel: string;
};

export function CourseForm({ values, onChange, onSubmit, submitLabel }: Props) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
      <input className="input" placeholder="Golfklubb" value={values.clubName} onChange={(e) => onChange({ ...values, clubName: e.target.value })} />
      <input className="input" placeholder="Bana/slinga" value={values.courseName} onChange={(e) => onChange({ ...values, courseName: e.target.value })} />
      <input className="input" placeholder="Tee-färg (valfritt)" value={values.teeName} onChange={(e) => onChange({ ...values, teeName: e.target.value })} />
      <div className="flex gap-2 mt-1.5">
        {[9, 18].map((value) => {
          const selected = values.holeCount === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onChange({ ...values, holeCount: value as 9 | 18 })}
              className={`flex-1 rounded-xl border-2 py-3 font-semibold transition ${
                selected ? 'bg-primary text-white border-primary' : 'bg-white text-primary border-primary'
              }`}
            >
              {value} hål
            </button>
          );
        })}
      </div>
      <button type="submit" className="btn-primary mt-3">
        {submitLabel}
      </button>
    </form>
  );
}
