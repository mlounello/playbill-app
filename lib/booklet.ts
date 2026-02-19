export type BookletPage<T> = {
  pageNumber: number;
  content: T;
};

export type BookletSpread<T> = {
  sheet: number;
  side: "front" | "back";
  left: BookletPage<T>;
  right: BookletPage<T>;
};

export function padToMultipleOf4<T>(items: T[], makePad: (index: number) => T): T[] {
  const remainder = items.length % 4;
  if (remainder === 0) {
    return items;
  }

  const needed = 4 - remainder;
  const padded = [...items];
  for (let i = 0; i < needed; i += 1) {
    padded.push(makePad(i));
  }

  return padded;
}

export function buildBookletSpreads<T>(pages: T[]): BookletSpread<T>[] {
  const total = pages.length;
  const spreads: BookletSpread<T>[] = [];
  const sheets = total / 4;

  for (let i = 0; i < sheets; i += 1) {
    const leftFront = total - 2 * i;
    const rightFront = 1 + 2 * i;
    const leftBack = 2 + 2 * i;
    const rightBack = total - (2 * i + 1);

    spreads.push({
      sheet: i + 1,
      side: "front",
      left: { pageNumber: leftFront, content: pages[leftFront - 1] },
      right: { pageNumber: rightFront, content: pages[rightFront - 1] }
    });

    spreads.push({
      sheet: i + 1,
      side: "back",
      left: { pageNumber: leftBack, content: pages[leftBack - 1] },
      right: { pageNumber: rightBack, content: pages[rightBack - 1] }
    });
  }

  return spreads;
}
