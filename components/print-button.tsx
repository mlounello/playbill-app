"use client";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} type="button">
      Print / Save PDF
    </button>
  );
}
