import type { WalletStatementSnapshot, WalletStatementTransaction } from "../types";

const MONTHS: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

const TRANSACTION_LINE_PATTERN =
  /^(\d+)\s+(.+?)\s+(\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\s+\d{2}:\d{2})\s+([+-]?\d+(?:\.\d+)?)\s+([A-Za-z]+)$/;

function normalizeSpace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function parseUtcDate(value: string) {
  const match = value.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!match) {
    throw new Error(`Unsupported statement date format: ${value}`);
  }

  const [, dayRaw, monthRaw, yearRaw, hourRaw, minuteRaw] = match;
  const month = MONTHS[monthRaw];
  if (month === undefined) {
    throw new Error(`Unsupported statement month: ${monthRaw}`);
  }

  return Date.UTC(
    Number(yearRaw),
    month,
    Number(dayRaw),
    Number(hourRaw),
    Number(minuteRaw),
    0,
    0,
  );
}

async function extractPdfLines(file: File) {
  const [{ GlobalWorkerOptions, getDocument }, pdfWorkerModule] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);

  GlobalWorkerOptions.workerSrc = pdfWorkerModule.default;
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data }).promise;
  const lines: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const buckets = new Map<number, Array<{ x: number; text: string }>>();

    for (const item of content.items) {
      if (!("str" in item)) {
        continue;
      }

      const text = normalizeSpace(item.str);
      if (!text) {
        continue;
      }

      const y = Math.round(item.transform[5]);
      const x = item.transform[4];
      const row = buckets.get(y) ?? [];
      row.push({ x, text });
      buckets.set(y, row);
    }

    const pageLines = Array.from(buckets.entries())
      .sort((left, right) => right[0] - left[0])
      .map(([, row]) =>
        normalizeSpace(
          row
            .sort((left, right) => left.x - right.x)
            .map((entry) => entry.text)
            .join(" "),
        ),
      )
      .filter(Boolean);

    lines.push(...pageLines);
  }

  return lines;
}

function parseTransactions(lines: string[]) {
  const transactions: WalletStatementTransaction[] = [];

  for (const line of lines) {
    if (line.startsWith("Current account statement") || line.startsWith("Time is shown in UTC")) {
      continue;
    }

    const match = line.match(TRANSACTION_LINE_PATTERN);
    if (!match) {
      continue;
    }

    const [, rowRaw, coinName, displayDate, amountRaw, symbol] = match;
    const timestampMs = parseUtcDate(displayDate);
    const amount = Number(amountRaw);

    transactions.push({
      id: `${symbol}|${timestampMs}|${amountRaw}|${rowRaw}`,
      rowNumber: Number(rowRaw),
      coinName: normalizeSpace(coinName),
      symbol: symbol.toUpperCase(),
      amount,
      timestamp: new Date(timestampMs).toISOString(),
      timestampMs,
      displayDate,
      rawLine: line,
    });
  }

  return transactions.sort((left, right) => right.timestampMs - left.timestampMs);
}

function parseMetadata(lines: string[]) {
  const userIdIndex = lines.findIndex((line) => line === "User id:");
  const nameIndex = lines.findIndex((line) => line === "Name:");

  return {
    userId: userIdIndex >= 0 ? normalizeSpace(lines[userIdIndex + 1] ?? "") : "",
    userName: nameIndex >= 0 ? normalizeSpace(lines[nameIndex + 1] ?? "") : "",
  };
}

function buildBalances(transactions: WalletStatementTransaction[]) {
  const balances: Record<string, number> = {};

  for (const transaction of transactions) {
    balances[transaction.symbol] = Number(((balances[transaction.symbol] ?? 0) + transaction.amount).toFixed(8));
  }

  return balances;
}

function createSnapshotSignature(userId: string, statementTimestamp: number, transactionCount: number, fileName: string) {
  return `${userId}|${statementTimestamp}|${transactionCount}|${fileName}`;
}

export async function parseWalletStatementPdf(file: File): Promise<WalletStatementSnapshot> {
  const lines = await extractPdfLines(file);
  const { userId, userName } = parseMetadata(lines);
  const transactions = parseTransactions(lines);

  if (transactions.length === 0) {
    throw new Error("No wallet transactions were found in this PDF.");
  }

  const balances = buildBalances(transactions);
  const statementTimestamp = Math.max(...transactions.map((transaction) => transaction.timestampMs));
  const importedAt = Date.now();

  return {
    id: createSnapshotSignature(userId, statementTimestamp, transactions.length, file.name),
    fileName: file.name,
    importedAt,
    userId,
    userName,
    transactionCount: transactions.length,
    statementTimestamp,
    balances,
    transactions,
  };
}
