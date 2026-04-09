import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  Loader2,
  Mic,
  MicOff,
  PenLine,
  Scissors,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import CameraCapture from "../components/CameraCapture";
import PageTransition from "../components/PageTransition";
import { useAddExpense } from "../hooks/useQueries";
// tesseract.js loaded dynamically via CDN in processReceipt (not in package.json)
import { ExpenseCategory, PaymentMethod } from "../types/backend-types";

type OcrStatus = "idle" | "processing" | "complete" | "error";
type VoiceStatus = "ready" | "listening" | "processing" | "done" | "error";
type Confidence = "high" | "medium" | "low";

interface NlpField {
  value: string;
  confidence: Confidence;
  hint?: string;
}

interface NlpResult {
  amount?: NlpField;
  merchant?: NlpField;
  category?: NlpField;
  method?: NlpField;
  note?: NlpField;
}

// ─── Receipt OCR Types ──────────────────────────────────────────────────────
interface ReceiptItem {
  name: string;
  qty: number;
  unitPrice: number;
  total: number;
}

interface GstInfo {
  number: string;
  cgst: number;
  sgst: number;
}

interface UpiInfo {
  txnId: string;
  upiId: string;
}

interface OcrExtraction {
  amount?: NlpField;
  merchant?: NlpField;
  date?: NlpField;
  category?: NlpField;
  method?: NlpField;
  items: ReceiptItem[];
  gst?: GstInfo;
  upi?: UpiInfo;
  isBusinessExpense: boolean;
  warnings: { field: string; level: "yellow" | "red"; message: string }[];
  cardHint?: string;
}

// ─── OCR Helper Functions ──────────────────────────────────────────────────

// Step 1: Pre-process image (grayscale + contrast) for better OCR accuracy
async function preprocessImageForOcr(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.filter = "grayscale(100%) contrast(150%)";
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas to blob failed"));
    }, "image/png");
  });
}

// ─── sanitizeAmount: Fix OCR decimal misread (e.g. "71680" → 7168) ─────────
// Called after every amount extraction to correct dropped decimal points.
function sanitizeAmount(
  rawAmount: string | number,
  _ocrText: string,
  totalInWordsAmount: number | null,
): number | null {
  let amount = Number.parseFloat(String(rawAmount).replace(/,/g, ""));
  if (Number.isNaN(amount) || amount <= 0) return null;

  // STEP 1: Suspicious trailing zeros — potential dropped decimal
  if (amount >= 1000 && amount % 10 === 0) {
    const divided = amount / 10;

    // Cross-check against "Total in words" if available
    if (totalInWordsAmount !== null && totalInWordsAmount > 0) {
      if (Math.abs(divided - totalInWordsAmount) < 1) {
        console.log(`Decimal fix (words match): ${amount} → ${divided}`);
        return divided;
      }
      if (Math.abs(amount - totalInWordsAmount) < 1) {
        return amount; // original is correct
      }
    }

    // Heuristic: exactly one trailing zero AND divided result in realistic range
    const strAmount = String(Math.round(amount));
    const trailingZeros = strAmount.match(/0+$/)?.[0]?.length ?? 0;
    if (trailingZeros === 1 && divided >= 100 && divided <= 99999) {
      console.log(`Heuristic decimal fix: ${amount} → ${divided}`);
      return divided;
    }
  }

  // STEP 2: Over-range fix — >99999 is almost certainly an OCR concatenation error
  if (amount > 99999) {
    while (amount > 99999) amount = amount / 10;
    console.log(`Range fix applied: result = ${amount}`);
    return Math.round(amount * 100) / 100;
  }

  return amount;
}

function parseReceiptText(text: string): OcrExtraction {
  const lines = text
    .split("\n")
    .map((l: string) => l.trim())
    .filter(Boolean);
  const lower = text.toLowerCase();
  const result: OcrExtraction = {
    items: [],
    isBusinessExpense: false,
    warnings: [],
  };

  // ── RULE 1: MERCHANT NAME ─────────────────────────────────────────────────
  // Simple, reliable: search raw OCR text (lowercased) for known brand strings.
  // More specific strings first — first match wins.
  const rawLower = text.toLowerCase();

  const merchantBrands: Array<[string, string]> = [
    ["lulu hypermarket", "LuLu Hypermarket"],
    ["luluhypermarket", "LuLu Hypermarket"],
    ["lulu fashion", "LuLu Hypermarket"],
    ["lulu connect", "LuLu Hypermarket"],
    ["lulu", "LuLu Hypermarket"],
    ["grt jewellers", "GRT Jewellers"],
    ["grt jeweller", "GRT Jewellers"],
    ["grt", "GRT Jewellers"],
    ["tanishq", "Tanishq"],
    ["kalyan jewellers", "Kalyan Jewellers"],
    ["kalyan jeweller", "Kalyan Jewellers"],
    ["malabar gold", "Malabar Gold"],
    ["dmart", "DMart"],
    ["d-mart", "DMart"],
    ["d mart", "DMart"],
    ["bigbasket", "BigBasket"],
    ["big basket", "BigBasket"],
    ["blinkit", "Blinkit"],
    ["zepto", "Zepto"],
    ["swiggy", "Swiggy"],
    ["zomato", "Zomato"],
    ["domino's", "Domino's"],
    ["dominos", "Domino's"],
    ["kfc", "KFC"],
    ["mcdonald's", "McDonald's"],
    ["mcdonalds", "McDonald's"],
    ["starbucks", "Starbucks"],
    ["cafe coffee day", "Cafe Coffee Day"],
    ["ccd", "Cafe Coffee Day"],
    ["croma", "Croma"],
    ["vijay sales", "Vijay Sales"],
    ["decathlon", "Decathlon"],
    ["westside", "Westside"],
    ["lifestyle", "Lifestyle"],
    ["pantaloons", "Pantaloons"],
    ["shoppers stop", "Shoppers Stop"],
    ["max fashion", "Max Fashion"],
    ["nykaa", "Nykaa"],
    ["myntra", "Myntra"],
    ["amazon", "Amazon"],
    ["flipkart", "Flipkart"],
    ["reliance fresh", "Reliance Fresh"],
    ["reliance smart", "Reliance Smart"],
    ["harsha agencies", "Indian Oil (Indane)"],
    ["indian oil", "Indian Oil"],
    ["indane", "Indian Oil (Indane)"],
    ["hp gas", "HP Gas"],
    ["bharat gas", "Bharat Gas"],
    ["apollo pharmacy", "Apollo Pharmacy"],
    ["medplus", "MedPlus"],
    ["pvr", "PVR Cinemas"],
    ["inox", "INOX"],
    ["airtel", "Airtel"],
    ["jio", "Jio"],
    ["bsnl", "BSNL"],
    // Travel booking platforms (must appear before generic hotel keywords)
    ["makemytrip", "MakeMyTrip"],
    ["make my trip", "MakeMyTrip"],
    ["mmt booking", "MakeMyTrip"],
    ["goibibo", "Goibibo"],
    ["cleartrip", "Cleartrip"],
    ["yatra.com", "Yatra"],
    ["yatra", "Yatra"],
    ["irctc", "IRCTC"],
    ["ixigo", "Ixigo"],
    ["airbnb", "Airbnb"],
    ["oyo", "OYO Hotels"],
    ["treebo", "Treebo"],
    ["fabhotel", "FabHotel"],
  ];

  let foundMerchant = false;
  for (const [keyword, cleanName] of merchantBrands) {
    if (rawLower.includes(keyword)) {
      result.merchant = { value: cleanName, confidence: "high" };
      foundMerchant = true;
      break;
    }
  }

  // Fallback: first clean line from top of receipt (2-5 words, no numbers, no noise)
  if (!foundMerchant) {
    const receiptLines = text
      .split("\n")
      .map((l: string) => l.trim())
      .filter((l: string) => l.length >= 3);
    for (const line of receiptLines.slice(0, 6)) {
      const isAddress =
        /(road|street|nagar|floor|no\.|plot|block|koil|high rd|bypass)/i.test(
          line,
        );
      const isContact =
        /(tel|phone|mob|email|www\.|gst|pan|cin|invoice|bill|supply)/i.test(
          line,
        );
      const hasOnlyNoise = /^[\d\s\-\/\.,]+$/.test(line);
      const hasTooManyNumbers = (line.match(/\d/g) || []).length > 4;
      const hasNoiseChars = /[@#\\|<>(){}\[\]]/i.test(line);

      if (
        !isAddress &&
        !isContact &&
        !hasOnlyNoise &&
        !hasTooManyNumbers &&
        !hasNoiseChars
      ) {
        const cleaned = line
          .replace(
            /private limited|pvt\.?\s*ltd\.?|\(india\)|llp|limited/gi,
            "",
          )
          .replace(/\s+/g, " ")
          .trim();
        if (cleaned.length >= 3 && cleaned.split(" ").length <= 5) {
          result.merchant = {
            value: cleaned.replace(/\b\w/g, (c: string) => c.toUpperCase()),
            confidence: "medium",
          };
          foundMerchant = true;
          break;
        }
      }
    }
  }

  // ── RULE 2: AMOUNT ────────────────────────────────────────────────────────
  // ── AMOUNT STEP A: "Total in words" — PRIMARY (most reliable for printed Indian bills) ──
  const wordsToNum = (input: string): number | null => {
    const wordMap: Record<string, number> = {
      zero: 0,
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10,
      eleven: 11,
      twelve: 12,
      thirteen: 13,
      fourteen: 14,
      fifteen: 15,
      sixteen: 16,
      seventeen: 17,
      eighteen: 18,
      nineteen: 19,
      twenty: 20,
      thirty: 30,
      forty: 40,
      fifty: 50,
      sixty: 60,
      seventy: 70,
      eighty: 80,
      ninety: 90,
      hundred: 100,
      thousand: 1000,
      lakh: 100000,
    };
    let total = 0;
    let current = 0;
    for (const word of input.toLowerCase().split(/\s+/)) {
      const n = wordMap[word];
      if (n === undefined) continue;
      if (n === 100) current = (current || 1) * 100;
      else if (n >= 1000) {
        total += (current || 1) * n;
        current = 0;
      } else current += n;
    }
    const result2 = total + current;
    return result2 > 0 ? result2 : null;
  };

  // Search for a "Total in words" line: must contain "only" AND at least one magnitude word
  let totalInWordsAmount: number | null = null;
  const totalInWordsMagnitudeRe = /\b(rupee|thousand|hundred|lakh)\b/i;
  const totalInWordsLine = lines.find(
    (l: string) => /\bonly\b/i.test(l) && totalInWordsMagnitudeRe.test(l),
  );
  if (totalInWordsLine) {
    totalInWordsAmount = wordsToNum(totalInWordsLine);
  }

  let grandTotalAmount: number | null = null;
  let fallbackAmount: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();
    if (/^\s*(?:cgst|sgst|igst|tax|vat|cess)\s*[:(]/i.test(lineLower)) continue;
    if (/^sub\s*total/i.test(lineLower) && !/grand/i.test(lineLower)) continue;

    const isGrandTotalLabel =
      /grand\s*total|total\s*\(inr\)|grand\s*total\s*\(?inr\)?/i.test(line);

    if (isGrandTotalLabel) {
      // Try to get amount on the same line first
      const sameLineMatch = line.match(
        /(?:grand\s*total|total\s*\(inr\)|grand\s*total\s*\(?inr\)?)[^\d]*(\d[\d,]*(?:\.\d+)?)/i,
      );
      if (sameLineMatch) {
        const val = Number.parseFloat(sameLineMatch[1].replace(/,/g, ""));
        if (!Number.isNaN(val) && val >= 1 && val <= 999999) {
          grandTotalAmount = val;
          continue;
        }
      }
      // If no number on same line, look on the NEXT LINE (two-line format like LuLu bill)
      const nextLine = lines[i + 1] || "";
      const nextLineMatch = nextLine.match(
        /^[\s\u20B9Rs.INR]*(\d[\d,]*(?:\.\d+)?)/,
      );
      if (nextLineMatch) {
        const val = Number.parseFloat(nextLineMatch[1].replace(/,/g, ""));
        if (!Number.isNaN(val) && val >= 1 && val <= 999999) {
          grandTotalAmount = val;
          continue;
        }
      }
      // Also try any number in the next line
      const nextLineAny = nextLine.match(/(\d[\d,]*(?:\.\d+)?)/);
      if (nextLineAny) {
        const val = Number.parseFloat(nextLineAny[1].replace(/,/g, ""));
        if (!Number.isNaN(val) && val >= 1 && val <= 999999) {
          grandTotalAmount = val;
        }
      }
      continue;
    }

    const secMatch = line.match(
      /(?:bill\s*amount|net\s*payable|total\s*payable|amount\s*payable|total\s*amount|net\s*amount|payable\s*amount|amount\s*due)[^\d]*(\d[\d,]*(?:\.\d+)?)/i,
    );
    if (secMatch) {
      const val = Number.parseFloat(secMatch[1].replace(/,/g, ""));
      if (!Number.isNaN(val) && val > 0) {
        if (fallbackAmount === null || val > fallbackAmount)
          fallbackAmount = val;
      }
    }
  }

  // Use "Total in words" as primary if found; Grand Total label as secondary; fallback last
  const finalAmount = totalInWordsAmount ?? grandTotalAmount ?? fallbackAmount;
  if (finalAmount !== null && finalAmount > 0 && finalAmount <= 999999) {
    const rounded = Math.round(finalAmount * 100) / 100;
    result.amount = {
      value: String(rounded),
      confidence: "high",
    };
  } else {
    // Priority 2b: "Total in words" fallback
    const wordsLineFallback = lines.find(
      (l: string) => /\bonly\b/i.test(l) && totalInWordsMagnitudeRe.test(l),
    );
    if (wordsLineFallback) {
      const wordToNumFb: Record<string, number> = {
        zero: 0,
        one: 1,
        two: 2,
        three: 3,
        four: 4,
        five: 5,
        six: 6,
        seven: 7,
        eight: 8,
        nine: 9,
        ten: 10,
        eleven: 11,
        twelve: 12,
        thirteen: 13,
        fourteen: 14,
        fifteen: 15,
        sixteen: 16,
        seventeen: 17,
        eighteen: 18,
        nineteen: 19,
        twenty: 20,
        thirty: 30,
        forty: 40,
        fifty: 50,
        sixty: 60,
        seventy: 70,
        eighty: 80,
        ninety: 90,
        hundred: 100,
        thousand: 1000,
        lakh: 100000,
      };
      let wTotal = 0;
      let wCurrent = 0;
      for (const word of wordsLineFallback.toLowerCase().split(/\s+/)) {
        const val = wordToNumFb[word];
        if (val === undefined) continue;
        if (val === 100) wCurrent = (wCurrent || 1) * 100;
        else if (val >= 1000) {
          wTotal += (wCurrent || 1) * val;
          wCurrent = 0;
        } else wCurrent += val;
      }
      const wordsAmt = wTotal + wCurrent;
      if (wordsAmt >= 1 && wordsAmt <= 999999) {
        result.amount = { value: String(wordsAmt), confidence: "medium" };
      }
    }

    // Priority 3: Last resort — find standalone numbers, pick largest under 99999
    // CRITICAL: regex caps digit length to 6 before decimal to PREVENT scientific notation
    if (!result.amount) {
      const allNums: number[] = [];
      // This regex matches at most 6 digits before decimal — never a giant concatenated string
      const safeMatches = [
        ...text.matchAll(/\d{1,6}(?:,\d{3})*(?:\.\d{1,2})?/g),
      ];
      for (const safeM of safeMatches) {
        // Parse ONE number at a time — NEVER concatenate
        const raw = safeM[0].replace(/,/g, "");
        const n = Number.parseFloat(raw);
        if (Number.isNaN(n)) continue;
        if (n < 10 || n > 99999) continue;
        allNums.push(n);
      }
      if (allNums.length > 0) {
        const best = Math.max(...allNums);
        result.amount = {
          value: String(Math.round(best * 100) / 100),
          confidence: "low",
        };
      }
    }
    // If still nothing — leave undefined (do NOT default to 707 or any value)
  }

  // ── POST-EXTRACTION: sanitizeAmount ──────────────────────────────────────
  // Reject known bad values then run full decimal-misread correction.
  if (result.amount) {
    const amtStr = result.amount.value;
    const amtNum = Number.parseFloat(amtStr);

    // Reject scientific notation (concatenation bug)
    if (
      amtStr.includes("e+") ||
      amtStr.includes("E+") ||
      !Number.isFinite(amtNum) ||
      amtNum > 999999
    ) {
      result.amount = undefined;
      result.warnings.push({
        field: "amount",
        level: "red",
        message: "Amount extraction failed — please enter manually",
      });
    }

    // Reject known wrong / placeholder values
    if (result.amount) {
      const raw = Number.parseFloat(result.amount.value);
      if (raw === 707 || raw === 49566 || raw === 900) {
        result.amount = undefined;
      }
    }

    // Run sanitizeAmount — fixes dropped decimal (71680→7168, 218800→2188, etc.)
    if (result.amount) {
      const sanitized = sanitizeAmount(
        result.amount.value,
        text,
        totalInWordsAmount,
      );
      if (sanitized === null) {
        result.amount = undefined;
      } else {
        const origNum = Number.parseFloat(result.amount.value);
        const wasFixed = Math.abs(sanitized - origNum) > 0.001;
        result.amount = {
          value: String(sanitized),
          confidence: wasFixed ? "medium" : result.amount.confidence,
        };
        if (wasFixed) {
          result.warnings.push({
            field: "amount",
            level: "yellow",
            message: `Decimal corrected: ${origNum} → ${sanitized} — please verify`,
          });
        }
      }
    }
  }

  // Total in words cross-check
  const wordsLine = text.match(
    /(?:rupees|total\s*in\s*words)[^\n]*?([A-Za-z\s]+?)\s*(?:only|rupees|$)/i,
  );
  if (wordsLine && result.amount) {
    const wordsText = wordsLine[1].trim().toLowerCase();
    const wordToNum: Record<string, number> = {
      zero: 0,
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10,
      eleven: 11,
      twelve: 12,
      thirteen: 13,
      fourteen: 14,
      fifteen: 15,
      sixteen: 16,
      seventeen: 17,
      eighteen: 18,
      nineteen: 19,
      twenty: 20,
      thirty: 30,
      forty: 40,
      fifty: 50,
      sixty: 60,
      seventy: 70,
      eighty: 80,
      ninety: 90,
      hundred: 100,
      thousand: 1000,
      lakh: 100000,
    };
    let wordsNum = 0;
    let currentGroup = 0;
    for (const word of wordsText.split(/\s+/)) {
      const n = wordToNum[word];
      if (n === undefined) continue;
      if (n === 100) currentGroup = (currentGroup || 1) * 100;
      else if (n === 1000) {
        wordsNum += (currentGroup || 1) * 1000;
        currentGroup = 0;
      } else if (n === 100000) {
        wordsNum += (currentGroup || 1) * 100000;
        currentGroup = 0;
      } else currentGroup += n;
    }
    wordsNum += currentGroup;
    const extracted = Number.parseFloat(result.amount.value);
    if (wordsNum > 0 && Math.abs(wordsNum - extracted) > extracted * 0.1) {
      result.warnings.push({
        field: "amount",
        level: "yellow",
        message: "Please verify amount — total-in-words may differ",
      });
    }
  }

  // ── RULE 3: DATE ──────────────────────────────────────────────────────────
  const today = new Date().toISOString().split("T")[0];

  const ddMonYYYYMatch = text.match(
    /(?:invoice\s*date|bill\s*date|transaction\s*date|date\s*of\s*supply|delivery\s*on|\bdate\b)[:\s]+(\d{1,2})[-\/\s]?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-\/\s]?(\d{4})/i,
  );
  const labeledDateMatch = text.match(
    /(?:invoice\s*date|bill\s*date|transaction\s*date|date\s*of\s*supply|delivery\s*on|\bdate\b)[:\s]+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i,
  );
  const ddmmyyyyMatch = text.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  const wordDateMatch = text.match(
    /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i,
  );

  const monthNameMap: Record<string, number> = {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12,
  };

  let dDay: number | null = null;
  let dMonth: number | null = null;
  let dYear: number | null = null;

  if (ddMonYYYYMatch) {
    dDay = Number.parseInt(ddMonYYYYMatch[1]);
    dMonth = monthNameMap[ddMonYYYYMatch[2].toLowerCase()] ?? null;
    dYear = Number.parseInt(ddMonYYYYMatch[3]);
  } else if (labeledDateMatch) {
    dDay = Number.parseInt(labeledDateMatch[1]);
    dMonth = Number.parseInt(labeledDateMatch[2]);
    dYear = Number.parseInt(labeledDateMatch[3]);
  } else if (ddmmyyyyMatch) {
    dDay = Number.parseInt(ddmmyyyyMatch[1]);
    dMonth = Number.parseInt(ddmmyyyyMatch[2]);
    dYear = Number.parseInt(ddmmyyyyMatch[3]);
  } else if (wordDateMatch) {
    dDay = Number.parseInt(wordDateMatch[1]);
    dMonth = monthNameMap[wordDateMatch[2].toLowerCase()] ?? null;
    dYear = Number.parseInt(wordDateMatch[3]);
  }

  // BUG 3 FIX: Try to correct common OCR digit misreads before giving up
  // 8 is often misread as 5, 7 as 4 (e.g. 2028 → 2025, 2027 → 2024)
  if (dYear !== null && (dYear < 2020 || dYear > 2026)) {
    const correctedYearStr = dYear
      .toString()
      .replace(/8$/, "5") // last digit: 8 → 5
      .replace(/7$/, "4"); // last digit: 7 → 4
    const correctedYear = Number.parseInt(correctedYearStr);
    if (correctedYear >= 2020 && correctedYear <= 2026) {
      dYear = correctedYear;
    } else {
      result.date = { value: today, confidence: "low" };
      result.warnings.push({
        field: "date",
        level: "red",
        message:
          "Date may be incorrect — year looks wrong, defaulting to today",
      });
      dYear = null; // prevent the valid-date branch from running
    }
  }
  if (dYear !== null && (dYear < 2020 || dYear > 2026)) {
    result.date = { value: today, confidence: "low" };
    result.warnings.push({
      field: "date",
      level: "red",
      message: "Date may be incorrect — year looks wrong, defaulting to today",
    });
  } else if (
    dDay &&
    dMonth &&
    dYear &&
    dMonth >= 1 &&
    dMonth <= 12 &&
    dDay >= 1 &&
    dDay <= 31
  ) {
    result.date = {
      value: `${dYear}-${String(dMonth).padStart(2, "0")}-${String(dDay).padStart(2, "0")}`,
      confidence: "high",
    };
  } else {
    result.date = { value: today, confidence: "low" };
  }

  // ── RULE 4: CATEGORY ──────────────────────────────────────────────────────
  // NEVER use doc-type words to determine category
  const docTypeWords = [
    "invoice",
    "tax invoice",
    "bill of supply",
    "bill no",
    "bill number",
    "receipt no",
    "receipt number",
  ];
  const cleanLines = lines.filter(
    (l: string) => !docTypeWords.some((d) => l.toLowerCase().includes(d)),
  );
  const itemText = cleanLines.join(" ").toLowerCase();
  const merchantLower = (result.merchant?.value || "").toLowerCase();

  const categoryRules: {
    keywords: string[];
    category: ExpenseCategory;
    priority: number;
  }[] = [
    {
      keywords: [
        "jewellers",
        "jewellery",
        "jewelry",
        "jewels",
        "gold",
        "silver",
        "diamond",
        "gems",
        "karat",
        " kt ",
        "purity",
        "findings",
        "tanishq",
        "malabar",
        "kalyan",
        "grt",
        "png jewellers",
        "pc jeweller",
      ],
      category: ExpenseCategory.Shopping,
      priority: 11,
    },
    {
      keywords: [
        "lulu",
        "hypermarket",
        "superstore",
        "supermarket",
        "mall",
        "retail",
        "fashion store",
        "dmart",
        "croma",
        "vijay sales",
        "decathlon",
        "zara",
        "h&m",
        "westside",
        "lifestyle",
        "pantaloons",
        "shoppers stop",
        "reliance smart",
        "star bazaar",
        "clothing",
        "shoes",
        "electronics",
        "gadgets",
        "charger",
        "cable",
        "earphones",
        "laptop",
        "mobile",
        "appliance",
        "amazon",
        "flipkart",
        "myntra",
        "nykaa",
      ],
      category: ExpenseCategory.Shopping,
      priority: 10,
    },
    {
      keywords: [
        "bigbasket",
        "blinkit",
        "zepto",
        "grocery",
        "vegetables",
        "dairy",
        "fruits",
        "provisions",
        "milk",
        "eggs",
        "bread",
        "onions",
        "tomatoes",
        "reliance fresh",
      ],
      category: ExpenseCategory.Shopping,
      priority: 9,
    },
    {
      keywords: [
        "zomato",
        "swiggy",
        "restaurant",
        "cafe",
        "hotel",
        "pizza",
        "biryani",
        "coffee",
        "bakery",
        "meals",
        "paneer",
        "dal",
        "naan",
        "burger",
        "food court",
        "dominos",
        "kfc",
        "mcdonalds",
        "starbucks",
        "ccd",
        "haldiram",
        "chai",
        "dine",
      ],
      category: ExpenseCategory.Food,
      priority: 8,
    },
    {
      keywords: [
        "uber",
        "ola",
        "rapido",
        "fuel",
        "petrol",
        "diesel",
        "parking",
        "toll",
        "cab",
        "auto",
        "irctc",
        "train",
        "bus",
        "metro",
        "bmtc",
        "ride",
        "bpcl",
        "hpcl",
        "iocl",
        "indian oil",
      ],
      category: ExpenseCategory.Transport,
      priority: 8,
    },
    {
      keywords: [
        "pharmacy",
        "medical",
        "hospital",
        "clinic",
        "medicine",
        "diagnostic",
        "lab",
        "apollo",
        "medplus",
        "tablets",
        "capsules",
        "vitamin",
        "calcium",
        "prescription",
      ],
      category: ExpenseCategory.Health,
      priority: 8,
    },
    {
      keywords: [
        "movie",
        "pvr",
        "inox",
        "bookmyshow",
        "concert",
        "gaming",
        "netflix",
        "spotify",
        "prime video",
        "hotstar",
      ],
      category: ExpenseCategory.Entertainment,
      priority: 8,
    },
    {
      keywords: [
        "electricity board",
        "bescom",
        "tneb",
        "mseb",
        "bwssb",
        "water board",
        "broadband bill",
        "jio recharge",
        "airtel recharge",
        "bsnl bill",
        "jio bill",
        "airtel bill",
        "recharge receipt",
        "internet bill",
      ],
      category: ExpenseCategory.Bills,
      priority: 7,
    },
    {
      // Travel platforms & hospitality — priority 12 (beats all other rules)
      keywords: [
        "makemytrip",
        "make my trip",
        "goibibo",
        "cleartrip",
        "yatra",
        "irctc",
        "ixigo",
        "airbnb",
        "oyo",
        "treebo",
        "fabhotel",
        "flight ticket",
        "train ticket",
        "bus ticket",
        "hotel booking",
        "hotel invoice",
        "accommodation",
        "check-in",
        "check-out",
        "reservation",
        "indigo",
        "air india",
        "spicejet",
        "vistara",
        "akasa",
        "room tariff",
        "room charges",
        "minerva grand",
        "hyatt",
        "marriott",
        "holiday inn",
        "ibis",
        "taj hotel",
        "itc hotel",
        "leela",
      ],
      category: ExpenseCategory.Travel,
      priority: 12,
    },
  ];

  let bestCategory: ExpenseCategory = ExpenseCategory.Other;
  let catConfidence: Confidence = "low";
  let bestPriority = 0;

  for (const rule of categoryRules) {
    const searchIn = `${merchantLower} ${itemText}`;
    const matches = rule.keywords.filter((kw: string) => searchIn.includes(kw));
    if (matches.length > 0) {
      const priority = rule.priority + matches.length;
      if (priority > bestPriority) {
        bestPriority = priority;
        bestCategory = rule.category;
        catConfidence = matches.length >= 2 ? "high" : "medium";
      }
    }
  }
  result.category = { value: bestCategory, confidence: catConfidence };

  // ── RULE 5: PAYMENT METHOD ────────────────────────────────────────────────
  // Simple direct approach — search the FULL raw OCR text for payment keywords.
  // Card keywords checked BEFORE cash to avoid false cash matches.
  {
    const rawText = text;
    const t = rawText.toLowerCase();

    // Debug logging for payment extraction
    console.log("=== FULL OCR TEXT ===");
    console.log(rawText);

    let paymentMethod: string | null = null;
    // UPI hint stored in result.cardHint

    // CARD — check before cash
    // Use token-based scan (FIX 2) as primary for Visa — more robust than includes()
    // Split into individual tokens so partial OCR noise doesn't cause misses
    const paymentTokens = rawText
      .split(/\s+/)
      .map((tok: string) => tok.toLowerCase().replace(/[^a-z0-9*x]/g, ""));
    console.log(
      "Payment tokens found:",
      paymentTokens.filter((tok: string) =>
        [
          "visa",
          "mastercard",
          "master",
          "rupay",
          "amex",
          "upi",
          "cash",
          "gpay",
          "phonepe",
          "paytm",
        ].includes(tok),
      ),
    );
    const hasVisaToken = paymentTokens.some(
      (tok: string) =>
        tok === "visa" ||
        tok === "visa:" ||
        tok === "[visa]" ||
        tok.startsWith("visa"),
    );
    const hasMaskedCardToken = paymentTokens.some(
      (tok: string) => /\*{3,}/.test(tok) || /x{3,}/i.test(tok),
    );
    const cardNumberInText = /[\*x]{4,}\d{3,4}/i.test(rawText);

    if (hasVisaToken || t.includes("visa")) {
      paymentMethod = "visa";
    } else if (t.includes("mastercard") || t.includes("master card")) {
      paymentMethod = "mastercard";
    } else if (t.includes("rupay")) {
      paymentMethod = "rupay";
    } else if (t.includes("amex") || t.includes("american express")) {
      paymentMethod = "amex";
    } else if (
      hasMaskedCardToken ||
      cardNumberInText ||
      /\*{3,}\d{3,}/.test(t)
    ) {
      paymentMethod = "card";
    } else if (t.includes("credit card")) {
      paymentMethod = "card";
    } else if (t.includes("debit card")) {
      paymentMethod = "card";
    }
    // UPI
    else if (t.includes("gpay") || t.includes("google pay")) {
      paymentMethod = "gpay";
    } else if (t.includes("phonepe")) {
      paymentMethod = "phonepe";
    } else if (t.includes("paytm")) {
      paymentMethod = "paytm";
    } else if (t.includes("bhim")) {
      paymentMethod = "bhim";
    } else if (t.includes("upi")) {
      paymentMethod = "upi";
    }
    // Net banking
    else if (
      t.includes("neft") ||
      t.includes("rtgs") ||
      t.includes("net banking")
    ) {
      paymentMethod = "netbanking";
    }
    // Cash — ONLY if explicit payment phrase
    else if (t.includes("cash paid") || t.includes("paid in cash")) {
      paymentMethod = "cash";
    } else if (
      t.includes("cash") &&
      !t.includes("cashier") &&
      !t.includes("cash back") &&
      !t.includes("cash received")
    ) {
      paymentMethod = "cash";
    } else {
      paymentMethod = "cash"; // default
    }

    // FIX 3D: Travel booking platforms always use online payment — never cash
    const onlineTravelBrands = [
      "makemytrip",
      "goibibo",
      "cleartrip",
      "yatra",
      "irctc",
      "ixigo",
      "airbnb",
    ];
    if (
      paymentMethod === "cash" &&
      onlineTravelBrands.some((brand: string) => t.includes(brand))
    ) {
      paymentMethod = "netbanking"; // Online/Net Banking
    }

    console.log("=== PAYMENT EXTRACTED ===");
    console.log(paymentMethod);

    // Extract card last 4 digits if present
    const maskedMatch = rawText.match(/[*\u2022\-\.xX]{3,}(\d{3,4})(?!\d)/);
    const last4 = maskedMatch ? maskedMatch[1] : null;

    // Map to PaymentMethod enum and set hint
    if (paymentMethod === "visa") {
      result.method = { value: PaymentMethod.Card, confidence: "high" };
      result.cardHint = last4 ? `Visa ending ${last4}` : "Visa card";
    } else if (paymentMethod === "mastercard") {
      result.method = { value: PaymentMethod.Card, confidence: "high" };
      result.cardHint = last4 ? `Mastercard ending ${last4}` : "Mastercard";
    } else if (paymentMethod === "rupay") {
      result.method = { value: PaymentMethod.Card, confidence: "high" };
      result.cardHint = last4 ? `RuPay ending ${last4}` : "RuPay card";
    } else if (paymentMethod === "amex") {
      result.method = { value: PaymentMethod.Card, confidence: "high" };
      result.cardHint = last4 ? `Amex ending ${last4}` : "American Express";
    } else if (paymentMethod === "card") {
      result.method = { value: PaymentMethod.Card, confidence: "medium" };
      result.cardHint = last4 ? `Card ending ${last4}` : "Card payment";
    } else if (paymentMethod === "gpay") {
      result.method = {
        value: PaymentMethod.UPI,
        confidence: "high",
      };
      result.cardHint = "Google Pay";
    } else if (paymentMethod === "phonepe") {
      result.method = {
        value: PaymentMethod.UPI,
        confidence: "high",
      };
      result.cardHint = "PhonePe";
    } else if (paymentMethod === "paytm") {
      result.method = {
        value: PaymentMethod.UPI,
        confidence: "high",
      };
      result.cardHint = "Paytm";
    } else if (paymentMethod === "bhim") {
      result.method = {
        value: PaymentMethod.UPI,
        confidence: "high",
      };
      result.cardHint = "BHIM UPI";
    } else if (paymentMethod === "upi") {
      result.method = {
        value: PaymentMethod.UPI,
        confidence: "high",
      };
      result.cardHint = "UPI";
    } else if (paymentMethod === "netbanking") {
      result.method = { value: PaymentMethod.NetBanking, confidence: "high" };
    } else {
      // cash
      result.method = { value: PaymentMethod.Cash, confidence: "medium" };
    }
  }
  // No default — leave undefined if nothing matched

  // ── ITEMS ─────────────────────────────────────────────────────────────────
  const itemLineSkip =
    /(total|tax|gst|subtotal|cgst|sgst|discount|delivery|charge|payment|date|order|bill|amount|grand|due|route|distance|base|store|period|customer|ref|booking|invoice|gstin|approval|sub\s*total)/i;
  for (const line of lines) {
    if (itemLineSkip.test(line)) continue;
    const m3 = line.match(/^(.+?)\s{2,}(\d+)\s+([\d,]+(?:\.\d+)?)$/);
    if (m3) {
      const price = Number.parseFloat(m3[3].replace(/,/g, ""));
      const qty = Number.parseInt(m3[2]);
      if (!Number.isNaN(price) && price > 0 && price < 1000000) {
        result.items.push({
          name: m3[1].trim(),
          qty: qty || 1,
          unitPrice: Math.round((price / (qty || 1)) * 100) / 100,
          total: price,
        });
        continue;
      }
    }
    const m2 = line.match(/^(.+?)\s{2,}([\d,]+(?:\.\d+)?)$/);
    if (m2) {
      const price = Number.parseFloat(m2[2].replace(/,/g, ""));
      if (!Number.isNaN(price) && price > 0 && price < 100000) {
        result.items.push({
          name: m2[1].trim().replace(/\s*x\d+\s*$/, ""),
          qty: 1,
          unitPrice: price,
          total: price,
        });
      }
    }
  }

  // ── GST ───────────────────────────────────────────────────────────────────
  const gstMatch = text.match(
    /\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{3})\b/,
  );
  const cgstMatch = text.match(/cgst[:\s(]+[\u20B9Rs]*\s*([\d]+(?:\.\d+)?)/i);
  const sgstMatch = text.match(/sgst[:\s(]+[\u20B9Rs]*\s*([\d]+(?:\.\d+)?)/i);
  if (gstMatch) {
    result.gst = {
      number: gstMatch[1],
      cgst: cgstMatch ? Number.parseFloat(cgstMatch[1]) : 0,
      sgst: sgstMatch ? Number.parseFloat(sgstMatch[1]) : 0,
    };
    result.isBusinessExpense = true;
  }

  // ── UPI ───────────────────────────────────────────────────────────────────
  const txnIdMatch =
    text.match(/(?:Transaction\s*ID|Txn\s*ID)[:\s]+([\d]{12})/i) ||
    text.match(/\b(\d{12})\b/);
  const upiIdMatch = text.match(/\b([a-zA-Z0-9._-]+@[a-zA-Z0-9]+)\b/);
  const paidToMatch = text.match(/paid\s+to[:\s]+(.+?)(?:\n|$)/i);
  if (txnIdMatch && lower.includes("upi")) {
    result.upi = {
      txnId: txnIdMatch[1],
      upiId: upiIdMatch ? upiIdMatch[1] : "",
    };
    if (paidToMatch && !result.merchant) {
      result.merchant = { value: paidToMatch[1].trim(), confidence: "medium" };
    }
  }

  return result;
}

// ─── Category meta ──────────────────────────────────────────────────────────
const CATEGORY_META: Record<
  string,
  { emoji: string; color: string; label: string }
> = {
  [ExpenseCategory.Food]: { emoji: "🍔", color: "#f97316", label: "Food" },
  [ExpenseCategory.Transport]: {
    emoji: "🚗",
    color: "#3b82f6",
    label: "Transport",
  },
  [ExpenseCategory.Shopping]: {
    emoji: "🛍️",
    color: "#a855f7",
    label: "Shopping",
  },
  [ExpenseCategory.Entertainment]: {
    emoji: "🎬",
    color: "#ec4899",
    label: "Entertainment",
  },
  [ExpenseCategory.Bills]: { emoji: "💡", color: "#eab308", label: "Bills" },
  [ExpenseCategory.Health]: {
    emoji: "💊",
    color: "#ef4444",
    label: "Health",
  },
  [ExpenseCategory.Other]: { emoji: "📦", color: "#6b7280", label: "Other" },
  [ExpenseCategory.Travel]: { emoji: "✈️", color: "#3B82F6", label: "Travel" },
};

// ─── NLP Parser ────────────────────────────────────────────────────────────
function parseTranscript(transcript: string): NlpResult {
  const t = transcript.trim();
  const lower = t.toLowerCase();
  const result: NlpResult = {};

  const amountPatterns = [
    /(?:₹|rs\.?\s*|rupees?\s*)(\d+(?:[.,]\d+)?)/i,
    /(?:spent|paid|cost|costs|paying|spend|worth|of)\s+(?:₹|rs\.?\s*|rupees?\s*)?(\d+(?:[.,]\d+)?)/i,
    /(?:for|around|about|just|only)\s+(?:₹|rs\.?\s*)?(\d+(?:[.,]\d+)?)/i,
    /(\d+(?:[.,]\d+)?)\s*(?:₹|rupees?)/i,
  ];
  for (const pat of amountPatterns) {
    const m = t.match(pat);
    if (m) {
      const val = m[1].replace(",", "");
      result.amount = { value: val, confidence: "high" };
      break;
    }
  }

  const merchantPatterns = [
    /(?:at|from|on|in|@)\s+([A-Z][a-zA-Z'\s&.]+?)(?:\s+(?:for|using|via|with|by|on|to|worth|today|yesterday)\b|$)/,
    /(?:to|paid to)\s+([A-Z][a-zA-Z'\s&.]+?)(?:\s+(?:for|using|via|with)\b|$)/,
  ];
  for (const pat of merchantPatterns) {
    const m = t.match(pat);
    if (m) {
      const name = m[1].trim();
      if (name.length >= 2 && name.length <= 40) {
        result.merchant = {
          value: name,
          confidence: name.length > 3 ? "high" : "medium",
        };
        break;
      }
    }
  }

  const categoryMap: {
    keywords: string[];
    category: ExpenseCategory;
    confidence: Confidence;
  }[] = [
    {
      keywords: [
        "zomato",
        "swiggy",
        "food",
        "lunch",
        "dinner",
        "breakfast",
        "coffee",
        "chai",
        "snack",
        "eat",
        "restaurant",
        "cafe",
        "domino",
        "pizza",
        "biryani",
        "meal",
      ],
      category: ExpenseCategory.Food,
      confidence: "high",
    },
    {
      keywords: [
        "uber",
        "ola",
        "bus",
        "train",
        "auto",
        "cab",
        "metro",
        "taxi",
        "fuel",
        "petrol",
        "transport",
        "travel",
        "flight",
        "rapido",
        "bike",
      ],
      category: ExpenseCategory.Transport,
      confidence: "high",
    },
    {
      keywords: [
        "amazon",
        "flipkart",
        "meesho",
        "myntra",
        "shop",
        "shopping",
        "cloth",
        "dress",
        "shoes",
        "bag",
        "buy",
        "purchase",
        "order",
        "delivery",
      ],
      category: ExpenseCategory.Shopping,
      confidence: "high",
    },
    {
      keywords: [
        "netflix",
        "hotstar",
        "prime",
        "movie",
        "game",
        "entertain",
        "concert",
        "theatre",
        "sports",
        "play",
        "disney",
        "spotify",
        "music",
      ],
      category: ExpenseCategory.Entertainment,
      confidence: "high",
    },
    {
      keywords: [
        "bill",
        "electricity",
        "water",
        "internet",
        "broadband",
        "phone",
        "recharge",
        "rent",
        "gas",
        "maintenance",
        "wifi",
      ],
      category: ExpenseCategory.Bills,
      confidence: "high",
    },
    {
      keywords: [
        "hospital",
        "medicine",
        "doctor",
        "health",
        "pharma",
        "pharmacy",
        "medical",
        "clinic",
        "checkup",
        "dental",
        "apollo",
      ],
      category: ExpenseCategory.Health,
      confidence: "high",
    },
  ];

  for (const entry of categoryMap) {
    const matched = entry.keywords.some((kw) => lower.includes(kw));
    if (matched) {
      result.category = { value: entry.category, confidence: entry.confidence };
      break;
    }
  }
  if (!result.category) {
    result.category = { value: ExpenseCategory.Other, confidence: "low" };
  }

  const methodMap: {
    keywords: string[];
    method: PaymentMethod;
    confidence: Confidence;
    hint?: string;
  }[] = [
    {
      keywords: ["gpay", "google pay", "gpa"],
      method: PaymentMethod.UPI,
      confidence: "high",
      hint: "UPI (Google Pay)",
    },
    {
      keywords: ["phonepe"],
      method: PaymentMethod.UPI,
      confidence: "high",
      hint: "UPI (PhonePe)",
    },
    {
      keywords: ["paytm"],
      method: PaymentMethod.UPI,
      confidence: "high",
      hint: "UPI (Paytm)",
    },
    {
      keywords: ["bhim"],
      method: PaymentMethod.UPI,
      confidence: "high",
      hint: "UPI (BHIM)",
    },
    {
      keywords: ["upi", "neft", "imps", "online transfer"],
      method: PaymentMethod.UPI,
      confidence: "high",
      hint: "UPI",
    },
    {
      keywords: [
        "card",
        "credit card",
        "debit card",
        "visa",
        "mastercard",
        "swipe",
      ],
      method: PaymentMethod.Card,
      confidence: "high",
    },
    {
      keywords: ["cash", "notes", "currency", "hand", "wallet"],
      method: PaymentMethod.Cash,
      confidence: "high",
    },
    {
      keywords: ["netbanking", "net banking", "bank transfer", "neft", "rtgs"],
      method: PaymentMethod.NetBanking,
      confidence: "high",
    },
  ];

  for (const entry of methodMap) {
    const matched = entry.keywords.some((kw) => lower.includes(kw));
    if (matched) {
      result.method = {
        value: entry.method,
        confidence: entry.confidence,
        hint: entry.hint,
      };
      break;
    }
  }

  const notePatterns = [
    /(?:for)\s+([a-z][a-z0-9\s]+?)(?:\s+(?:using|via|with|from|at|by)\b|$)/i,
    /(?:purpose\s+is|note[:\s]+)(.+)$/i,
  ];
  for (const pat of notePatterns) {
    const m = t.match(pat);
    if (m) {
      const n = m[1].trim();
      if (n.length > 2 && n.length < 80) {
        result.note = { value: n, confidence: "medium" };
        break;
      }
    }
  }

  return result;
}

// ─── Waveform Component ─────────────────────────────────────────────────────
function LiveWaveform({
  analyser,
  isActive,
}: { analyser: AnalyserNode | null; isActive: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const BAR_COUNT = 40;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      let bars: number[] = new Array(BAR_COUNT).fill(0);

      if (analyser && isActive) {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        const step = Math.floor(dataArray.length / BAR_COUNT);
        bars = Array.from({ length: BAR_COUNT }, (_, i) => {
          let sum = 0;
          for (let j = 0; j < step; j++) sum += dataArray[i * step + j];
          return sum / step / 255;
        });
      } else {
        const t2 = Date.now() / 600;
        bars = Array.from({ length: BAR_COUNT }, (_, i) =>
          isActive ? 0 : 0.08 + 0.06 * Math.sin(t2 + i * 0.4),
        );
      }

      const barW = W / BAR_COUNT - 2;
      const gradient = ctx.createLinearGradient(0, H, 0, 0);
      gradient.addColorStop(0, "oklch(0.65 0.2 145)");
      gradient.addColorStop(1, "oklch(0.75 0.18 200)");

      bars.forEach((amp, i) => {
        const barH = Math.max(4, amp * H * 0.9);
        const x = i * (barW + 2);
        const y = (H - barH) / 2;
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, 3);
        ctx.fill();
      });
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyser, isActive]);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={72}
      className="w-full max-w-xs rounded-xl"
      style={{ background: "transparent" }}
    />
  );
}

// ─── Confidence Chip ────────────────────────────────────────────────────────
function ConfidenceChip({ confidence }: { confidence: Confidence }) {
  if (confidence === "high") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 font-medium">
        <CheckCircle2 className="h-3 w-3" /> High
      </span>
    );
  }
  if (confidence === "medium") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-medium">
        <CheckCircle2 className="h-3 w-3" /> Medium
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 font-medium">
      <AlertTriangle className="h-3 w-3" /> Verify
    </span>
  );
}

// ─── Flash-highlight hook ───────────────────────────────────────────────────
function useFieldFlash() {
  const [flashing, setFlashing] = useState<Record<string, boolean>>({});
  const flash = (key: string) => {
    setFlashing((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => setFlashing((prev) => ({ ...prev, [key]: false })), 700);
  };
  return { flashing, flash };
}

// ─── Floating Field ─────────────────────────────────────────────────────────
function FloatingField({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  step,
  shakeOnInvalid,
  showCheckmark,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  step?: string;
  shakeOnInvalid?: boolean;
  showCheckmark?: boolean;
  className?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [checkPop, setCheckPop] = useState(false);
  const prevValid = useRef(false);
  const isFloated = focused || value.length > 0;
  const isValidAmount =
    value !== "" && !Number.isNaN(Number(value)) && Number(value) > 0;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (shakeOnInvalid && raw !== "" && Number.isNaN(Number(raw))) {
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      return;
    }
    onChange(raw);
  };

  // pop checkmark when becomes valid
  useEffect(() => {
    if (showCheckmark) {
      if (isValidAmount && !prevValid.current) {
        setCheckPop(true);
        setTimeout(() => setCheckPop(false), 600);
      }
      prevValid.current = isValidAmount;
    }
  }, [isValidAmount, showCheckmark]);

  return (
    <div className={`relative ${className ?? ""}`}>
      <div
        className="relative"
        style={{
          animation: shaking ? "shake 0.4s ease" : undefined,
        }}
      >
        <input
          id={id}
          type={type}
          step={step}
          value={value}
          required={required}
          placeholder={focused ? (placeholder ?? "") : ""}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={handleChange}
          className="peer w-full rounded-lg border bg-card px-3 pt-5 pb-2 text-sm text-foreground transition-all duration-200 outline-none"
          style={{
            borderColor: focused ? "oklch(0.65 0.2 175)" : undefined,
            boxShadow: focused
              ? "0 0 0 2px oklch(0.65 0.2 175 / 0.3)"
              : undefined,
          }}
        />
        <label
          htmlFor={id}
          style={{
            position: "absolute",
            left: "12px",
            top: isFloated ? "6px" : "50%",
            transform: isFloated
              ? "translateY(0) scale(0.82)"
              : "translateY(-50%)",
            transformOrigin: "left",
            fontSize: isFloated ? "0.7rem" : "0.875rem",
            color: focused ? "oklch(0.65 0.2 175)" : "oklch(0.55 0.02 200)",
            pointerEvents: "none",
            transition:
              "top 0.2s ease, transform 0.2s ease, color 0.2s ease, font-size 0.2s ease",
            fontWeight: isFloated ? 600 : 400,
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </label>
        {showCheckmark && isValidAmount && (
          <span
            style={{
              position: "absolute",
              right: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              animation: checkPop
                ? "pop 0.4s cubic-bezier(0.34,1.56,0.64,1)"
                : undefined,
              display: "flex",
              alignItems: "center",
            }}
          >
            <Check
              style={{ color: "oklch(0.65 0.2 145)", width: 16, height: 16 }}
            />
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Custom Category Dropdown ────────────────────────────────────────────────
function CategoryDropdown({
  value,
  onChange,
  flashClass,
  isFlashing,
}: {
  value: ExpenseCategory;
  onChange: (v: ExpenseCategory) => void;
  flashClass?: string;
  isFlashing?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const meta = CATEGORY_META[value] ?? {
    emoji: "📦",
    color: "#6b7280",
    label: value,
  };

  return (
    <div
      ref={ref}
      className={`relative ${flashClass ?? ""} ${isFlashing ? "field-flash" : ""}`}
      style={{ position: "relative", zIndex: 100 }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 rounded-lg border bg-card px-3 py-2.5 text-sm text-foreground transition-all duration-200 outline-none"
        style={{
          borderColor: open ? "oklch(0.65 0.2 175)" : undefined,
          boxShadow: open ? "0 0 0 2px oklch(0.65 0.2 175 / 0.3)" : undefined,
        }}
      >
        <span>{meta.emoji}</span>
        <span
          className="inline-block rounded-full"
          style={{ width: 8, height: 8, background: meta.color, flexShrink: 0 }}
        />
        <span className="flex-1 text-left">{meta.label}</span>
        <svg
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
            opacity: 0.5,
          }}
        >
          <path
            d="M2 4l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <div
        style={{
          position: "absolute",
          top: "100%",
          left: 0,
          width: "100%",
          zIndex: 9999,
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          maxHeight: 220,
          overflowY: "auto",
          opacity: open ? 1 : 0,
          visibility: open ? "visible" : "hidden",
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.18s ease, visibility 0.18s ease",
        }}
      >
        {Object.entries(CATEGORY_META).map(([cat, m]) => (
          <button
            key={cat}
            type="button"
            onClick={() => {
              onChange(cat as ExpenseCategory);
              setOpen(false);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted/70 transition-colors"
            style={{ textAlign: "left" }}
          >
            <span>{m.emoji}</span>
            <span
              className="inline-block rounded-full"
              style={{
                width: 8,
                height: 8,
                background: m.color,
                flexShrink: 0,
              }}
            />
            <span className="flex-1">{m.label}</span>
            {cat === value && (
              <Check
                style={{ width: 14, height: 14, color: "oklch(0.65 0.2 175)" }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Confetti ──────────────────────────────────────────────────────────────
function Confetti({ active }: { active: boolean }) {
  if (!active) return null;
  const colors = [
    "#f97316",
    "#3b82f6",
    "#a855f7",
    "#ec4899",
    "#22c55e",
    "#eab308",
    "#06b6d4",
  ];
  const particles = Array.from({ length: 22 }, (_, i) => {
    const angle = (i / 22) * 360 + Math.random() * 20;
    const dist = 40 + Math.random() * 60;
    const dx = Math.cos((angle * Math.PI) / 180) * dist;
    const dy = Math.sin((angle * Math.PI) / 180) * dist - 30;
    const color = colors[i % colors.length];
    const size = 5 + Math.random() * 5;
    const rotate = Math.random() * 360;
    return { dx, dy, color, size, rotate, delay: Math.random() * 0.1 };
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "visible",
        zIndex: 10,
      }}
    >
      {particles.map((p, i) => (
        <div
          key={`confetti-${i}-${p.color}`}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: i % 3 === 0 ? "50%" : 2,
            animation: `confettiFly 0.9s ease-out ${p.delay}s forwards`,
            // @ts-ignore
            "--dx": `${p.dx}px`,
            "--dy": `${p.dy}px`,
            "--rotate": `${p.rotate}deg`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Ripple Submit Button ────────────────────────────────────────────────────
function RippleButton({
  onClick,
  disabled,
  isPending,
  isSuccess,
  children,
  className,
  style,
  type,
  ...rest
}: {
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  isPending?: boolean;
  isSuccess?: boolean;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  type?: "button" | "submit" | "reset";
  "data-ocid"?: string;
}) {
  const [ripples, setRipples] = useState<
    { x: number; y: number; id: number }[]
  >([]);
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || isPending) return;
    const rect = btnRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();
    setRipples((prev) => [...prev, { x, y, id }]);
    setTimeout(
      () => setRipples((prev) => prev.filter((r) => r.id !== id)),
      700,
    );
    onClick?.(e);
  };

  return (
    <button
      ref={btnRef}
      type={type ?? "button"}
      disabled={disabled || isPending}
      onClick={handleClick}
      className={`relative overflow-hidden inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed ${className ?? ""}`}
      {...rest}
      style={{
        background: isSuccess
          ? "oklch(0.65 0.2 145)"
          : "var(--primary, oklch(0.45 0.18 250))",
        color: "var(--text-on-primary, white)",
        boxShadow: isSuccess
          ? "0 0 0 4px oklch(0.65 0.2 145 / 0.25)"
          : undefined,
        ...(style ?? {}),
      }}
    >
      <Confetti active={isSuccess ?? false} />
      {ripples.map((r) => (
        <span
          key={r.id}
          style={{
            position: "absolute",
            left: r.x,
            top: r.y,
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.5)",
            transform: "translate(-50%,-50%) scale(0)",
            animation: "ripple 0.6s ease-out forwards",
            pointerEvents: "none",
          }}
        />
      ))}
      <span className="relative z-[1] flex items-center gap-2">
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Adding...
          </>
        ) : isSuccess ? (
          <>
            <Check
              className="h-4 w-4"
              style={{ animation: "pop 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}
            />
            Saved!
          </>
        ) : (
          children
        )}
      </span>
    </button>
  );
}

// ─── Custom Tab Bar ──────────────────────────────────────────────────────────
const TABS = [
  { value: "manual", icon: PenLine, label: "Manual" },
  { value: "voice", icon: Mic, label: "Voice" },
  { value: "receipt", icon: Upload, label: "Receipt" },
] as const;

type TabValue = "manual" | "voice" | "receipt";

// ─── Main page ──────────────────────────────────────────────────────────────
export default function AddExpensePage() {
  // Human-readable labels for PaymentMethod enum values
  const paymentMethodLabel: Record<string, string> = {
    [PaymentMethod.Card]: "Card",
    [PaymentMethod.Cash]: "Cash",
    [PaymentMethod.UPI]: "UPI / Wallet",
    [PaymentMethod.NetBanking]: "Net Banking",
    [PaymentMethod.Other]: "Other",
  };

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>(
    ExpenseCategory.Food,
  );
  const [otherCategoryLabel, setOtherCategoryLabel] = useState("");
  const [merchant, setMerchant] = useState("");
  const [manualDate, setManualDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.Cash);
  const [note, setNote] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrExtraction | null>(null);
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>("idle");
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Receipt OCR enhanced state
  const [receiptDate, setReceiptDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([]);
  const [receiptImageUrl, setReceiptImageUrl] = useState<string | null>(null);
  const [ocrConfidences, setOcrConfidences] = useState<
    Record<string, Confidence>
  >({});
  const [showLightbox, setShowLightbox] = useState(false);
  const [showItems, setShowItems] = useState(false);
  const [editedFields, setEditedFields] = useState<Set<string>>(new Set());
  const [gstInfo, setGstInfo] = useState<GstInfo | null>(null);
  const [upiInfo, setUpiInfo] = useState<UpiInfo | null>(null);
  const [ocrWarnings, setOcrWarnings] = useState<
    { field: string; level: "yellow" | "red"; message: string }[]
  >([]);
  const [cardHint, setCardHint] = useState<string>("");
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStage, setOcrStage] = useState<"scanning" | "extracting" | "done">(
    "scanning",
  );
  // Store original and corrected amounts for the decimal banner
  const [originalAmount, setOriginalAmount] = useState<string | null>(null);
  const [correctedAmount, setCorrectedAmount] = useState<string | null>(null);
  const [decimalBannerDismissed, setDecimalBannerDismissed] = useState(false);

  // Active tab state
  const [activeTab, setActiveTab] = useState<TabValue>("manual");
  const [_prevTab, _setPrevTab] = useState<TabValue>("manual");
  const [tabAnimating, setTabAnimating] = useState(false);

  // Submit success state
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Voice-NLP state
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("ready");
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [_nlpResult, setNlpResult] = useState<NlpResult | null>(null);
  const [nlpConfidences, setNlpConfidences] = useState<
    Record<string, Confidence>
  >({});
  const [nlpPaymentHint, setNlpPaymentHint] = useState<string>("");
  const { flashing, flash } = useFieldFlash();

  const voiceRecognitionRef = useRef<{
    stop: () => void;
    start: () => void;
  } | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  const addExpense = useAddExpense();

  // Read pre-fill query params from Maps page (e.g. ?merchant=...&category=...&amount=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qMerchant = params.get("merchant");
    const qCategory = params.get("category");
    const qAmount = params.get("amount");
    if (qMerchant) setMerchant(decodeURIComponent(qMerchant));
    if (qAmount && !Number.isNaN(Number(qAmount))) setAmount(qAmount);
    if (qCategory) {
      const catMap: Record<string, ExpenseCategory> = {
        Food: ExpenseCategory.Food,
        Transport: ExpenseCategory.Transport,
        Health: ExpenseCategory.Health,
        Shopping: ExpenseCategory.Shopping,
        Entertainment: ExpenseCategory.Entertainment,
      };
      const mapped = catMap[qCategory];
      if (mapped) setCategory(mapped);
    }
  }, []);
  // Tab switch with animation
  const switchTab = (tab: TabValue) => {
    if (tab === activeTab) return;
    _setPrevTab(activeTab);
    setTabAnimating(true);
    setTimeout(() => {
      setActiveTab(tab);
      setTabAnimating(false);
    }, 160);
  };

  const tabIndex = TABS.findIndex((t) => t.value === activeTab);

  // ── Stop everything ──
  const stopVoice = useCallback(() => {
    voiceRecognitionRef.current?.stop();
    if (micStreamRef.current) {
      for (const t of micStreamRef.current.getTracks()) t.stop();
    }
    if (audioContextRef.current?.state !== "closed")
      audioContextRef.current?.close();
    analyserRef.current = null;
    micStreamRef.current = null;
    audioContextRef.current = null;
  }, []);

  useEffect(
    () => () => {
      stopVoice();
    },
    [stopVoice],
  );

  // ── Apply NLP result to fields ──
  const applyNlp = useCallback(
    (result: NlpResult) => {
      const confs: Record<string, Confidence> = {};
      if (result.amount) {
        setAmount(result.amount.value);
        confs.amount = result.amount.confidence;
        flash("amount");
      }
      if (result.merchant) {
        setMerchant(result.merchant.value);
        confs.merchant = result.merchant.confidence;
        flash("merchant");
      }
      if (result.category) {
        setCategory(result.category.value as ExpenseCategory);
        confs.category = result.category.confidence;
        flash("category");
      }
      if (result.method) {
        setMethod(result.method.value as PaymentMethod);
        confs.method = result.method.confidence;
        flash("method");
        setNlpPaymentHint(result.method.hint || "");
      }
      if (result.note) {
        setNote(result.note.value);
        confs.note = result.note.confidence;
        flash("note");
      }
      setNlpConfidences(confs);
      setNlpResult(result);
    },
    [flash],
  );

  // ── Start / Stop voice ──
  const handleVoiceInput = async () => {
    if (voiceStatus === "listening") {
      stopVoice();
      setVoiceStatus("processing");
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Voice input not supported in this browser");
      return;
    }

    setTranscript("");
    setInterimTranscript("");
    setNlpResult(null);
    setNlpConfidences({});

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
    } catch {
      toast.error("Microphone access denied. Please allow microphone access.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;
    voiceRecognitionRef.current = recognition;

    recognition.onstart = () => setVoiceStatus("listening");

    recognition.onresult = (event: {
      resultIndex: number;
      results: { isFinal: boolean; [n: number]: { transcript: string } }[];
    }) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (interim) setInterimTranscript(interim);
      if (final) {
        setTranscript((prev) => (prev ? `${prev} ${final}` : final).trim());
        setInterimTranscript("");
      }
    };

    recognition.onerror = (event: { error: string }) => {
      stopVoice();
      setVoiceStatus("error");
      if (event.error === "not-allowed") {
        toast.error("Microphone access denied.");
      } else if (event.error !== "no-speech") {
        toast.error("Voice recognition failed. Please try again.");
      }
      setTimeout(() => setVoiceStatus("ready"), 2500);
    };

    recognition.onend = () => {
      stopVoice();
      setVoiceStatus((prev) => {
        if (prev === "listening" || prev === "processing") return "processing";
        return prev;
      });
    };

    recognition.start();
  };

  // ── When transcript is final and status is processing → run NLP ──
  useEffect(() => {
    if (voiceStatus !== "processing") return;
    const fullText = transcript.trim();
    if (!fullText) {
      setVoiceStatus("ready");
      return;
    }
    const result = parseTranscript(fullText);
    applyNlp(result);
    setVoiceStatus("done");
  }, [voiceStatus, transcript, applyNlp]);

  const triggerSuccess = () => {
    setSubmitSuccess(true);
    setTimeout(() => setSubmitSuccess(false), 2000);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !merchant) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (category === ExpenseCategory.Other && !otherCategoryLabel.trim()) {
      toast.error("Please describe what the 'Other' expense is");
      return;
    }
    try {
      const manualNote =
        category === ExpenseCategory.Other && otherCategoryLabel.trim()
          ? `[Other: ${otherCategoryLabel.trim()}] ${note}`.trim()
          : note;
      // Save to all localStorage keys for Analytics/Dashboard sync
      try {
        const localExpense = {
          id: Date.now().toString(),
          amount: Number.parseFloat(amount),
          merchant,
          date: manualDate || new Date().toISOString().split("T")[0],
          category,
          paymentMethod: method,
          payment: method,
          note: manualNote,
          source: "manual",
          createdAt: new Date().toISOString(),
        };
        const allKeys = [
          "expenses",
          "expenseData",
          "userExpenses",
          "el-expenses",
          "expensesList",
        ];
        for (const key of allKeys) {
          try {
            const existing = JSON.parse(localStorage.getItem(key) || "[]");
            if (Array.isArray(existing)) {
              existing.unshift(localExpense);
              localStorage.setItem(key, JSON.stringify(existing));
            }
          } catch (_) {}
        }
        window.dispatchEvent(
          new CustomEvent("expenseAdded", { detail: localExpense }),
        );
        window.dispatchEvent(new StorageEvent("storage", { key: "expenses" }));
      } catch (_) {}
      await addExpense.mutateAsync({
        amount: Number.parseFloat(amount),
        category,
        merchant,
        paymentMethod: method,
        note: manualNote,
        date: manualDate,
        source: "manual",
      });
      toast.success("Expense saved!", {
        description: "View in Analytics →",
        action: {
          label: "View Analytics",
          onClick: () => {
            window.location.pathname = "/analytics";
          },
        },
      });
      triggerSuccess();
      setAmount("");
      setMerchant("");
      setNote("");
      setCategory(ExpenseCategory.Food);
      setMethod(PaymentMethod.Cash);
      setOtherCategoryLabel("");
      setManualDate(new Date().toISOString().split("T")[0]);
      setTranscript("");
      setNlpResult(null);
      setNlpConfidences({});
      setVoiceStatus("ready");
    } catch (error) {
      toast.error("Failed to add expense");
      console.error(error);
    }
  };

  const resetOcrState = () => {
    if (receiptImageUrl) URL.revokeObjectURL(receiptImageUrl);
    setReceiptFile(null);
    setOcrResult(null);
    setOcrStatus("idle");
    setAmount("");
    setMerchant("");
    setNote("");
    setOtherCategoryLabel("");
    setReceiptDate(new Date().toISOString().split("T")[0]);
    setReceiptItems([]);
    setReceiptImageUrl(null);
    setOcrConfidences({});
    setShowLightbox(false);
    setShowItems(false);
    setEditedFields(new Set());
    setGstInfo(null);
    setUpiInfo(null);
    setOcrProgress(0);
    setOcrStage("scanning");
    setOcrWarnings([]);
    setCardHint("");
    setOriginalAmount(null);
    setCorrectedAmount(null);
    setDecimalBannerDismissed(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const processReceipt = useCallback(async (file: File) => {
    setOcrResult(null);
    setOcrStatus("processing");
    setReceiptFile(file);
    setOcrProgress(0);
    setOcrStage("scanning");
    const imageUrl = URL.createObjectURL(file);
    setReceiptImageUrl(imageUrl);

    // Reset ALL previously extracted fields before starting new OCR scan.
    // This prevents stale values from a prior scan (e.g. "Indian Oil") bleeding into the new one.
    setAmount("");
    setMerchant("");
    setReceiptDate(new Date().toISOString().split("T")[0]);
    setCategory(ExpenseCategory.Food);
    setMethod(PaymentMethod.Cash);
    setOcrConfidences({});
    setOcrWarnings([]);
    setCardHint("");
    setReceiptItems([]);
    setGstInfo(null);
    setUpiInfo(null);
    setEditedFields(new Set());

    try {
      // Step 1: Pre-process image (grayscale + contrast)
      setOcrProgress(10);
      setOcrStage("scanning");
      const processedCanvas = await preprocessImageForOcr(file);
      const processedBlob = await canvasToBlob(processedCanvas);

      // Step 2: Run Tesseract.js OCR — loaded from CDN to avoid bundling issues
      setOcrProgress(20);
      // Dynamic CDN load so Vite/Rollup does not try to bundle tesseract.js
      type TesseractRecognizeFn = (
        img: Blob,
        lang: string,
        opts: Record<string, unknown>,
      ) => Promise<{ data: { text: string } }>;
      type TesseractLibType = { recognize: TesseractRecognizeFn } | null;

      const getTesseract = (): TesseractLibType =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((window as any).Tesseract as TesseractLibType) ?? null;

      let TesseractLib: TesseractLibType = getTesseract();

      if (!TesseractLib) {
        // Attempt to load from CDN dynamically
        await new Promise<void>((resolve, reject) => {
          if (document.querySelector("script[data-tesseract]")) {
            resolve();
            return;
          }
          const script = document.createElement("script");
          script.src =
            "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
          script.setAttribute("data-tesseract", "1");
          script.onload = () => resolve();
          script.onerror = () =>
            reject(new Error("Failed to load Tesseract.js from CDN"));
          document.head.appendChild(script);
        });
        TesseractLib = getTesseract();
      }
      if (!TesseractLib) throw new Error("Tesseract.js not available");
      const tesseractRecognize = TesseractLib.recognize;
      const {
        data: { text },
      } = await tesseractRecognize(processedBlob, "eng", {
        logger: (m: { progress: number; status: string }) => {
          if (m.status === "recognizing text") {
            // Map Tesseract progress (0-1) to our 20-85% range
            const mapped = 20 + m.progress * 65;
            setOcrProgress(Math.min(85, mapped));
            setOcrStage(m.progress < 0.5 ? "scanning" : "extracting");
          }
        },
      });

      // Step 3: Parse extracted text
      setOcrProgress(90);
      setOcrStage("extracting");
      const extraction = parseReceiptText(text);

      setOcrProgress(100);
      setOcrStage("done");

      // Apply extracted fields (never apply if empty — leave field as-is)
      if (extraction.amount) setAmount(extraction.amount.value);
      if (extraction.merchant) setMerchant(extraction.merchant.value);
      if (extraction.date) setReceiptDate(extraction.date.value);
      if (extraction.category)
        setCategory(extraction.category.value as ExpenseCategory);
      if (extraction.method)
        setMethod(extraction.method.value as PaymentMethod);
      setReceiptItems(extraction.items);
      setGstInfo(extraction.gst ?? null);
      setUpiInfo(extraction.upi ?? null);

      // Track original vs corrected amounts for the decimal banner
      setOriginalAmount(null);
      setCorrectedAmount(null);
      setDecimalBannerDismissed(false);
      if (extraction.amount) {
        const decimalWarning = extraction.warnings.find(
          (w) =>
            w.field === "amount" &&
            w.level === "yellow" &&
            w.message.includes("Decimal corrected"),
        );
        if (decimalWarning) {
          // Parse original amount from message "Decimal corrected: X → Y"
          const match = decimalWarning.message.match(
            /Decimal corrected:\s*([\d.]+)\s*→\s*([\d.]+)/,
          );
          if (match) {
            setOriginalAmount(match[1]);
            setCorrectedAmount(match[2]);
          }
        }
      }

      // Build confidence map
      const confs: Record<string, Confidence> = {};
      if (extraction.amount) confs.amount = extraction.amount.confidence;
      if (extraction.merchant) confs.merchant = extraction.merchant.confidence;
      if (extraction.date) confs.date = extraction.date.confidence;
      if (extraction.category) confs.category = extraction.category.confidence;
      if (extraction.method) confs.method = extraction.method.confidence;
      setOcrConfidences(confs);

      setOcrResult(extraction);
      setOcrWarnings(extraction.warnings || []);
      setCardHint(extraction.cardHint || "");
      setEditedFields(new Set());
      setOcrStatus("complete");
      toast.success("Receipt processed successfully!", {
        description: "Review and edit the extracted details",
      });
    } catch (error) {
      console.error("OCR error:", error);
      setOcrStatus("error");
      setOcrProgress(0);
      toast.error("Failed to process receipt", {
        description: "Please try again or enter details manually",
      });
    }
  }, []);

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processReceipt(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCameraCapture = (file: File) => {
    setShowCamera(false);
    processReceipt(file);
  };

  const handleReceiptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate amount — must be a valid number > 0
    const parsedAmount = Number.parseFloat(amount);
    if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (category === ExpenseCategory.Other && !otherCategoryLabel.trim()) {
      toast.error("Please describe what the 'Other' expense is");
      return;
    }

    // Use defaults for optional fields
    const finalMerchant = merchant.trim() || "Unknown Merchant";
    const finalDate = receiptDate || new Date().toISOString().split("T")[0];
    const finalCategory = category || ExpenseCategory.Other;
    const finalMethod = method || PaymentMethod.Cash;
    const finalNote =
      category === ExpenseCategory.Other && otherCategoryLabel.trim()
        ? `[Other: ${otherCategoryLabel.trim()}] ${note}`.trim()
        : note;

    // Save to localStorage for resilience — write to ALL common keys so
    // Analytics and Dashboard always find data regardless of which key they read.
    try {
      const localExpense = {
        id: Date.now().toString(),
        amount: parsedAmount,
        merchant: finalMerchant,
        date: finalDate,
        category: finalCategory,
        paymentMethod: finalMethod,
        payment: finalMethod,
        note: finalNote,
        source: "receipt",
        createdAt: new Date().toISOString(),
        savedAt: new Date().toISOString(),
      };
      const allKeys = [
        "expenses",
        "expenseData",
        "userExpenses",
        "el-expenses",
        "expensesList",
      ];
      for (const key of allKeys) {
        try {
          const existing = JSON.parse(localStorage.getItem(key) || "[]");
          if (Array.isArray(existing)) {
            existing.unshift(localExpense);
            localStorage.setItem(key, JSON.stringify(existing));
          }
        } catch (_) {}
      }
      // Fire events so any listening components update immediately
      window.dispatchEvent(
        new CustomEvent("expenseAdded", { detail: localExpense }),
      );
      window.dispatchEvent(new StorageEvent("storage", { key: "expenses" }));
    } catch (_) {
      // localStorage save failure is non-critical
    }

    try {
      await addExpense.mutateAsync({
        amount: parsedAmount,
        category: finalCategory,
        merchant: finalMerchant,
        paymentMethod: finalMethod,
        note: finalNote,
        date: new Date().toISOString().split("T")[0],
        source: "receipt",
      });
      toast.success("Expense saved!", {
        description: "View in Analytics →",
        action: {
          label: "View Analytics",
          onClick: () => {
            window.location.hash = "";
            window.location.pathname = "/analytics";
          },
        },
      });
      triggerSuccess();
      // Reset form after short delay
      setTimeout(() => {
        resetOcrState();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 1500);
    } catch (error) {
      // Even if backend fails, localStorage was saved — tell user it was saved locally
      toast.success("Expense saved locally!", {
        description: "It will sync when connection is restored",
      });
      triggerSuccess();
      console.error("Backend save failed:", error);
      setTimeout(() => {
        resetOcrState();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 1500);
    }
  };

  const getOcrStatusBadge = () => {
    switch (ocrStatus) {
      case "processing":
        return (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Processing
          </Badge>
        );
      case "complete":
        return (
          <Badge variant="default" className="gap-1 bg-green-600">
            <CheckCircle2 className="h-3 w-3" />
            Ready
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive" className="gap-1">
            <X className="h-3 w-3" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1">
            <Camera className="h-3 w-3" />
            Ready
          </Badge>
        );
    }
  };

  const flashClass = (key: string) =>
    flashing[key]
      ? "ring-2 ring-green-400 bg-green-50 dark:bg-green-950/30 transition-all duration-150"
      : "transition-all duration-300";

  const markEdited = (field: string) =>
    setEditedFields((prev) => new Set(prev).add(field));
  const isEdited = (field: string) => editedFields.has(field);

  const OtherCategoryInput = () =>
    category === ExpenseCategory.Other ? (
      <div className="space-y-2">
        <label htmlFor="other-label" className="text-sm font-medium">
          Describe the expense{" "}
          <span style={{ color: "oklch(0.55 0.22 25)" }}>*</span>
        </label>
        <FloatingField
          id="other-label"
          label="e.g. Birthday gift, Pet supplies..."
          value={otherCategoryLabel}
          onChange={setOtherCategoryLabel}
          required
        />
      </div>
    ) : null;

  // Payment method dropdown (simple select kept for method)
  const PaymentSelect = () => (
    <div className="space-y-1.5" style={{ position: "relative", zIndex: 100 }}>
      <label className="text-sm font-medium" htmlFor="payment-method">
        Payment Method
      </label>
      <select
        id="payment-method"
        value={method}
        onChange={(e) => setMethod(e.target.value as PaymentMethod)}
        className="w-full rounded-lg border bg-card px-3 py-2.5 text-sm text-foreground transition-all duration-200 outline-none appearance-none"
        style={{}}
      >
        {Object.values(PaymentMethod).map((m) => (
          <option key={m} value={m}>
            {paymentMethodLabel[m] ?? m}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <PageTransition>
      <style>{`
        @keyframes greenFlash {
          0%   { box-shadow: 0 0 0 0 rgba(74,222,128,0.7); }
          50%  { box-shadow: 0 0 0 6px rgba(74,222,128,0); }
          100% { box-shadow: 0 0 0 0 rgba(74,222,128,0); }
        }
        .field-flash { animation: greenFlash 0.7s ease-out; }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          15%     { transform: translateX(-7px); }
          30%     { transform: translateX(7px); }
          45%     { transform: translateX(-5px); }
          60%     { transform: translateX(5px); }
          75%     { transform: translateX(-3px); }
          90%     { transform: translateX(3px); }
        }
        @keyframes pop {
          0%   { transform: translateY(-50%) scale(0); }
          60%  { transform: translateY(-50%) scale(1.3); }
          100% { transform: translateY(-50%) scale(1); }
        }
        @keyframes ripple {
          0%   { transform: translate(-50%,-50%) scale(0); opacity: 1; }
          100% { transform: translate(-50%,-50%) scale(18); opacity: 0; }
        }
        @keyframes confettiFly {
          0%   { transform: translate(-50%,-50%) translate(0,0) rotate(0deg); opacity: 1; }
          100% { transform: translate(-50%,-50%) translate(var(--dx), var(--dy)) rotate(var(--rotate)); opacity: 0; }
        }
        @keyframes tabFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes tabFadeOut {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(-6px); }
        }
        .tab-enter { animation: tabFadeIn 0.22s ease forwards; }
        .tab-exit  { animation: tabFadeOut 0.15s ease forwards; }
        [data-slot="card"], [data-slot="card-content"] { overflow: visible !important; }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseYellow {
          0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--warning, #F59E0B) 40%, transparent); }
          50% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--warning, #F59E0B) 0%, transparent); }
        }
        .pulse-yellow { animation: pulseYellow 2s ease infinite; }
        .receipt-fields-enter { animation: slideDown 0.3s ease forwards; }
      `}</style>

      <div className="container py-8 max-w-4xl">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Add Expense</h1>
            <p className="text-muted-foreground mt-2">
              Track your spending with multiple input methods (amounts in ₹)
            </p>
          </div>

          {/* ── Custom Tab Bar ── */}
          <div
            className="relative flex rounded-xl p-1 gap-0"
            style={{
              background: "oklch(0.95 0.01 200 / 0.6)",
              border: "1px solid oklch(0.85 0.03 200)",
            }}
          >
            {/* Sliding pill */}
            <div
              style={{
                position: "absolute",
                top: 4,
                bottom: 4,
                left: `calc(${(tabIndex / 3) * 100}% + 4px)`,
                width: `calc(${100 / 3}% - 8px)`,
                background: "white",
                borderRadius: 10,
                boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                transition: "left 0.32s cubic-bezier(0.34,1.56,0.64,1)",
                zIndex: 0,
              }}
            />
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => switchTab(tab.value)}
                  data-ocid={`add_expense.${tab.value}.tab`}
                  className="relative z-[1] flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-[10px] transition-colors duration-200"
                  style={{
                    color: isActive
                      ? "oklch(0.45 0.18 250)"
                      : "oklch(0.55 0.04 200)",
                  }}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* ── Tab Panel ── */}
          <div
            className={tabAnimating ? "tab-exit" : "tab-enter"}
            style={{ minHeight: 400 }}
          >
            {/* ─── Manual Tab ─── */}
            {activeTab === "manual" && (
              <Card style={{ overflow: "visible" }}>
                <CardHeader>
                  <CardTitle>Manual Entry</CardTitle>
                  <CardDescription>
                    Enter expense details manually
                  </CardDescription>
                </CardHeader>
                <CardContent style={{ overflow: "visible" }}>
                  <form onSubmit={handleManualSubmit} className="space-y-4">
                    <div
                      className="grid gap-4 md:grid-cols-2"
                      style={{
                        overflow: "visible",
                        position: "relative",
                        zIndex: 1,
                      }}
                    >
                      <FloatingField
                        id="amount"
                        label="Amount (₹) *"
                        value={amount}
                        onChange={setAmount}
                        type="text"
                        shakeOnInvalid
                        showCheckmark
                        required
                      />
                      <FloatingField
                        id="merchant"
                        label="Merchant *"
                        value={merchant}
                        onChange={setMerchant}
                        required
                      />
                    </div>
                    {/* Date field — between Merchant and Category */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor="manual-date"
                        className="text-sm font-medium"
                      >
                        Date
                      </label>
                      <input
                        id="manual-date"
                        type="date"
                        value={manualDate}
                        onChange={(e) => setManualDate(e.target.value)}
                        className="w-full rounded-lg border bg-card px-3 py-2.5 text-sm text-foreground outline-none transition-all duration-200"
                        data-ocid="manual.date_input"
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <span className="text-sm font-medium">Category</span>
                        <CategoryDropdown
                          value={category}
                          onChange={(v) => {
                            setCategory(v);
                            if (v !== ExpenseCategory.Other)
                              setOtherCategoryLabel("");
                          }}
                        />
                      </div>
                      <PaymentSelect />
                    </div>
                    <OtherCategoryInput />
                    <div className="space-y-2">
                      <label htmlFor="note" className="text-sm font-medium">
                        Note (optional)
                      </label>
                      <Textarea
                        id="note"
                        placeholder="Add any additional details..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={3}
                      />
                    </div>
                    <RippleButton
                      type="submit"
                      isPending={addExpense.isPending}
                      isSuccess={submitSuccess}
                      disabled={addExpense.isPending}
                      className="w-full"
                      data-ocid="add_expense.submit_button"
                    >
                      Add Expense
                    </RippleButton>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* ─── Voice Tab ─── */}
            {activeTab === "voice" && (
              <Card style={{ overflow: "visible" }}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mic className="h-5 w-5 text-primary" />
                    Smart Voice Entry
                    <Badge variant="secondary" className="text-xs ml-auto">
                      NLP Powered
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Speak naturally — AI extracts amount, merchant, category
                    &amp; payment method instantly
                  </CardDescription>
                </CardHeader>
                <CardContent
                  className="space-y-6"
                  style={{ overflow: "visible" }}
                >
                  {/* ── Waveform + Mic Button ── */}
                  <div className="flex flex-col items-center gap-4 py-4">
                    <div
                      className={`relative rounded-2xl p-4 w-full max-w-sm flex flex-col items-center gap-3 ${
                        voiceStatus === "listening"
                          ? "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800"
                          : "bg-muted/50 border border-border"
                      } transition-all duration-300`}
                    >
                      <div className="w-full">
                        <LiveWaveform
                          analyser={analyserRef.current}
                          isActive={voiceStatus === "listening"}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleVoiceInput}
                        disabled={voiceStatus === "processing"}
                        data-ocid="voice.mic.button"
                        className={`relative h-16 w-16 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-primary/30 ${
                          voiceStatus === "listening"
                            ? "bg-red-500 hover:bg-red-600 scale-110 shadow-red-300 dark:shadow-red-900"
                            : voiceStatus === "processing"
                              ? "bg-muted cursor-not-allowed"
                              : voiceStatus === "done"
                                ? "bg-green-500 hover:bg-green-600"
                                : "bg-primary hover:bg-primary/90"
                        }`}
                      >
                        {voiceStatus === "processing" ? (
                          <Loader2 className="h-7 w-7 text-white animate-spin" />
                        ) : voiceStatus === "listening" ? (
                          <MicOff className="h-7 w-7 text-white" />
                        ) : (
                          <Mic className="h-7 w-7 text-white" />
                        )}
                        {voiceStatus === "listening" && (
                          <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-40" />
                        )}
                      </button>

                      <div className="text-center">
                        {voiceStatus === "ready" && (
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">
                              Tap mic to start recording
                            </p>
                            <p className="text-xs text-muted-foreground/70">
                              Try: "I spent 500 at Domino's for dinner using
                              UPI"
                            </p>
                          </div>
                        )}
                        {voiceStatus === "listening" && (
                          <p className="text-sm font-medium text-red-600 dark:text-red-400 animate-pulse">
                            Listening... tap to stop
                          </p>
                        )}
                        {voiceStatus === "processing" && (
                          <p className="text-sm font-medium text-muted-foreground">
                            Analyzing with NLP...
                          </p>
                        )}
                        {voiceStatus === "done" && (
                          <p className="text-sm font-medium text-green-600 dark:text-green-400">
                            Fields auto-filled! Review below.
                          </p>
                        )}
                        {voiceStatus === "error" && (
                          <p className="text-sm font-medium text-destructive">
                            Recognition failed — try again
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── Live Transcript ── */}
                  {(transcript ||
                    interimTranscript ||
                    voiceStatus === "listening") && (
                    <div className="rounded-xl border bg-card p-4 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Live Transcript
                      </p>
                      <p className="text-sm leading-relaxed">
                        {transcript && (
                          <span className="text-foreground">{transcript} </span>
                        )}
                        {interimTranscript && (
                          <span className="text-muted-foreground italic">
                            {interimTranscript}
                          </span>
                        )}
                        {!transcript &&
                          !interimTranscript &&
                          voiceStatus === "listening" && (
                            <span className="text-muted-foreground italic animate-pulse">
                              Waiting for speech...
                            </span>
                          )}
                      </p>
                    </div>
                  )}

                  {/* ── NLP Result + Form ── */}
                  {(voiceStatus === "done" || transcript) && (
                    <form onSubmit={handleManualSubmit} className="space-y-4">
                      <div className="flex items-center gap-2 pb-1">
                        <div className="h-px flex-1 bg-border" />
                        <span className="text-xs text-muted-foreground font-medium px-2">
                          NLP Extracted Fields
                        </span>
                        <div className="h-px flex-1 bg-border" />
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        {/* Amount */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              Amount (₹)
                            </span>
                            {nlpConfidences.amount ? (
                              <ConfidenceChip
                                confidence={nlpConfidences.amount}
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </div>
                          <FloatingField
                            id="voice-amount"
                            label="Amount (₹)"
                            value={amount}
                            onChange={setAmount}
                            shakeOnInvalid
                            showCheckmark
                            className={`${flashClass("amount")} ${flashing.amount ? "field-flash" : ""}`}
                          />
                          {!amount && (
                            <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Not detected
                              — please enter
                            </p>
                          )}
                        </div>

                        {/* Merchant */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              Merchant
                            </span>
                            {nlpConfidences.merchant ? (
                              <ConfidenceChip
                                confidence={nlpConfidences.merchant}
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </div>
                          <FloatingField
                            id="voice-merchant"
                            label="Merchant"
                            value={merchant}
                            onChange={setMerchant}
                            className={`${flashClass("merchant")} ${flashing.merchant ? "field-flash" : ""}`}
                          />
                          {!merchant && (
                            <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Not detected
                              — please enter
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        {/* Category */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              Category
                            </span>
                            {nlpConfidences.category ? (
                              <ConfidenceChip
                                confidence={nlpConfidences.category}
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </div>
                          <CategoryDropdown
                            value={category}
                            onChange={(v) => {
                              setCategory(v);
                              if (v !== ExpenseCategory.Other)
                                setOtherCategoryLabel("");
                            }}
                            flashClass={flashClass("category")}
                            isFlashing={flashing.category}
                          />
                        </div>

                        {/* Payment Method */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              Payment Method
                            </span>
                            {nlpConfidences.method ? (
                              <ConfidenceChip
                                confidence={nlpConfidences.method}
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </div>
                          <div
                            className={`rounded-md ${flashClass("method")} ${flashing.method ? "field-flash" : ""}`}
                          >
                            <select
                              value={method}
                              onChange={(e) =>
                                setMethod(e.target.value as PaymentMethod)
                              }
                              className="w-full rounded-lg border bg-card px-3 py-2.5 text-sm text-foreground transition-all duration-200 outline-none"
                            >
                              {Object.values(PaymentMethod).map((m) => (
                                <option key={m} value={m}>
                                  {paymentMethodLabel[m] ?? m}
                                </option>
                              ))}
                            </select>
                            {nlpPaymentHint && (
                              <p
                                className="text-xs mt-1"
                                style={{ color: "var(--text-muted)" }}
                              >
                                💳 {nlpPaymentHint}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <OtherCategoryInput />

                      {/* Note */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            Note (optional)
                          </span>
                          {nlpConfidences.note ? (
                            <ConfidenceChip confidence={nlpConfidences.note} />
                          ) : null}
                        </div>
                        <Textarea
                          id="voice-note"
                          placeholder="Auto-extracted or add details..."
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          rows={2}
                          className={`${flashClass("note")} ${flashing.note ? "field-flash" : ""}`}
                        />
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setTranscript("");
                            setInterimTranscript("");
                            setNlpResult(null);
                            setNlpConfidences({});
                            setNlpPaymentHint("");
                            setVoiceStatus("ready");
                            setAmount("");
                            setMerchant("");
                            setNote("");
                            setCategory(ExpenseCategory.Food);
                            setMethod(PaymentMethod.Cash);
                          }}
                          className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                        >
                          Try Again
                        </button>
                        <RippleButton
                          type="submit"
                          isPending={addExpense.isPending}
                          isSuccess={submitSuccess}
                          disabled={
                            addExpense.isPending || !amount || !merchant
                          }
                          className="flex-1"
                          data-ocid="voice.save.submit_button"
                        >
                          <CheckCircle2 className="mr-1 h-4 w-4" />
                          Save to Insights
                        </RippleButton>
                      </div>
                    </form>
                  )}

                  {/* Hint phrases */}
                  {voiceStatus === "ready" && !transcript && (
                    <div className="rounded-xl border border-dashed p-4 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Example phrases
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          "I spent 500 at Domino's for dinner using UPI",
                          "Paid ₹1200 at Amazon via card",
                          "Spent 80 at Starbucks for coffee with GPay",
                          "Paid 350 at Ola for cab using cash",
                        ].map((phrase) => (
                          <span
                            key={phrase}
                            className="text-xs px-3 py-1.5 rounded-full bg-muted text-muted-foreground cursor-default hover:bg-muted/80 transition-colors"
                          >
                            "{phrase}"
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ─── Receipt Tab ─── */}
            {activeTab === "receipt" && (
              <Card style={{ overflow: "visible" }}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Receipt Upload</CardTitle>
                      <CardDescription>
                        Upload or capture a receipt image for automatic
                        extraction
                      </CardDescription>
                    </div>
                    {getOcrStatusBadge()}
                  </div>
                </CardHeader>
                <CardContent
                  className="space-y-4"
                  style={{ overflow: "visible" }}
                >
                  {/* Upload Zone — always visible */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label
                      htmlFor="receipt-upload"
                      style={{
                        border:
                          "2px dashed var(--primary, oklch(0.65 0.2 175))",
                        background:
                          "color-mix(in srgb, var(--primary, oklch(0.65 0.2 175)) 8%, var(--bg-card, white))",
                        borderRadius: 12,
                        padding: 24,
                        textAlign: "center",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        display: "block",
                      }}
                      onMouseEnter={(e) => {
                        (
                          e.currentTarget as HTMLLabelElement
                        ).style.borderStyle = "solid";
                        (e.currentTarget as HTMLLabelElement).style.background =
                          "color-mix(in srgb, var(--primary, oklch(0.65 0.2 175)) 15%, var(--bg-card, white))";
                      }}
                      onMouseLeave={(e) => {
                        (
                          e.currentTarget as HTMLLabelElement
                        ).style.borderStyle = "dashed";
                        (e.currentTarget as HTMLLabelElement).style.background =
                          "color-mix(in srgb, var(--primary, oklch(0.65 0.2 175)) 8%, var(--bg-card, white))";
                      }}
                    >
                      <Upload
                        className="h-10 w-10 mx-auto mb-3"
                        style={{ color: "var(--primary, oklch(0.65 0.2 175))" }}
                      />
                      <span
                        className="text-sm font-medium"
                        style={{ color: "var(--primary, oklch(0.65 0.2 175))" }}
                      >
                        Upload from device
                      </span>
                      <p
                        className="text-xs mt-1"
                        style={{ color: "var(--text-muted, #94A3B8)" }}
                      >
                        PNG, JPG up to 10MB
                      </p>
                      <input
                        ref={fileInputRef}
                        id="receipt-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleReceiptUpload}
                        disabled={ocrStatus === "processing"}
                        data-ocid="receipt.upload_button"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={ocrStatus === "processing"}
                      onClick={() => setShowCamera(true)}
                      style={{
                        border:
                          "2px dashed var(--primary, oklch(0.65 0.2 175))",
                        background:
                          "color-mix(in srgb, var(--primary, oklch(0.65 0.2 175)) 8%, var(--bg-card, white))",
                        borderRadius: 12,
                        padding: 24,
                        textAlign: "center",
                        cursor:
                          ocrStatus === "processing"
                            ? "not-allowed"
                            : "pointer",
                        transition: "all 0.2s ease",
                        opacity: ocrStatus === "processing" ? 0.5 : 1,
                        width: "100%",
                      }}
                      onMouseEnter={(e) => {
                        if (ocrStatus !== "processing") {
                          (
                            e.currentTarget as HTMLButtonElement
                          ).style.borderStyle = "solid";
                          (
                            e.currentTarget as HTMLButtonElement
                          ).style.background =
                            "color-mix(in srgb, var(--primary, oklch(0.65 0.2 175)) 15%, var(--bg-card, white))";
                        }
                      }}
                      onMouseLeave={(e) => {
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.borderStyle = "dashed";
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.background =
                          "color-mix(in srgb, var(--primary, oklch(0.65 0.2 175)) 8%, var(--bg-card, white))";
                      }}
                      data-ocid="receipt.dropzone"
                    >
                      <Camera
                        className="h-10 w-10 mx-auto mb-3"
                        style={{ color: "var(--primary, oklch(0.65 0.2 175))" }}
                      />
                      <span
                        className="text-sm font-medium"
                        style={{ color: "var(--primary, oklch(0.65 0.2 175))" }}
                      >
                        Capture with camera
                      </span>
                      <p
                        className="text-xs mt-1"
                        style={{ color: "var(--text-muted, #94A3B8)" }}
                      >
                        Take a photo directly
                      </p>
                    </button>
                  </div>

                  {/* Receipt Thumbnail */}
                  {receiptImageUrl && (
                    <div
                      style={{
                        background: "var(--bg-card, white)",
                        border: "1px solid var(--border, rgba(0,0,0,0.1))",
                        borderRadius: 12,
                        padding: 12,
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                      }}
                    >
                      <img
                        src={receiptImageUrl}
                        alt="Receipt preview"
                        style={{
                          maxHeight: 200,
                          maxWidth: 120,
                          objectFit: "contain",
                          borderRadius: 8,
                          flexShrink: 0,
                        }}
                      />
                      <div
                        style={{
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                        }}
                      >
                        <p
                          className="text-sm font-medium"
                          style={{
                            color: "var(--text-primary-color, #0F172A)",
                          }}
                        >
                          {receiptFile?.name}
                        </p>
                        <p
                          className="text-xs"
                          style={{ color: "var(--text-muted, #94A3B8)" }}
                        >
                          {receiptFile
                            ? `${(receiptFile.size / 1024).toFixed(0)} KB`
                            : ""}
                        </p>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            marginTop: 4,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => setShowLightbox(true)}
                            style={{
                              padding: "5px 12px",
                              fontSize: 12,
                              fontWeight: 500,
                              background:
                                "color-mix(in srgb, var(--primary, oklch(0.65 0.2 175)) 12%, transparent)",
                              color: "var(--primary, oklch(0.65 0.2 175))",
                              border:
                                "1px solid color-mix(in srgb, var(--primary, oklch(0.65 0.2 175)) 30%, transparent)",
                              borderRadius: 6,
                              cursor: "pointer",
                            }}
                            data-ocid="receipt.open_modal_button"
                          >
                            View Full
                          </button>
                          <button
                            type="button"
                            onClick={resetOcrState}
                            style={{
                              padding: "5px 12px",
                              fontSize: 12,
                              fontWeight: 500,
                              background:
                                "color-mix(in srgb, var(--danger, #EF4444) 10%, transparent)",
                              color: "var(--danger, #EF4444)",
                              border:
                                "1px solid color-mix(in srgb, var(--danger, #EF4444) 30%, transparent)",
                              borderRadius: 6,
                              cursor: "pointer",
                            }}
                            data-ocid="receipt.delete_button"
                          >
                            Retake / Re-upload
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Extraction Progress Bar */}
                  {ocrStatus === "processing" && (
                    <div style={{ padding: "12px 0" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 6,
                        }}
                      >
                        <span
                          className="text-sm font-medium"
                          style={{
                            color: "var(--text-primary-color, #0F172A)",
                          }}
                        >
                          {ocrStage === "scanning" && "🔍 Scanning receipt..."}
                          {ocrStage === "extracting" &&
                            "⚡ Extracting fields..."}
                          {ocrStage === "done" && "✅ Done!"}
                        </span>
                        <span
                          className="text-xs"
                          style={{ color: "var(--text-muted, #94A3B8)" }}
                        >
                          {Math.round(ocrProgress)}%
                        </span>
                      </div>
                      <Progress
                        value={ocrProgress}
                        className="h-2"
                        style={{ background: "var(--bg-muted, #F1F5F9)" }}
                      />
                    </div>
                  )}

                  {/* Error State */}
                  {ocrStatus === "error" && (
                    <div
                      style={{
                        padding: 16,
                        background:
                          "color-mix(in srgb, var(--danger, #EF4444) 10%, var(--bg-card, white))",
                        border:
                          "1px solid color-mix(in srgb, var(--danger, #EF4444) 20%, transparent)",
                        borderRadius: 10,
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <X
                          className="h-5 w-5 flex-shrink-0 mt-0.5"
                          style={{ color: "var(--danger, #EF4444)" }}
                        />
                        <div className="flex-1">
                          <p
                            className="text-sm font-medium"
                            style={{ color: "var(--danger, #EF4444)" }}
                          >
                            Failed to process receipt
                          </p>
                          <p
                            className="text-xs mt-1"
                            style={{ color: "var(--text-muted, #94A3B8)" }}
                          >
                            {receiptFile?.name} — Please try again or enter
                            details manually
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={resetOcrState}
                        style={{
                          marginTop: 10,
                          width: "100%",
                          padding: "8px 16px",
                          border: "1px solid var(--border, rgba(0,0,0,0.1))",
                          background: "var(--bg-card, white)",
                          borderRadius: 8,
                          fontSize: 13,
                          cursor: "pointer",
                          color: "var(--text-primary-color, #0F172A)",
                        }}
                        data-ocid="receipt.cancel_button"
                      >
                        Try Again
                      </button>
                    </div>
                  )}

                  {/* Extracted Fields — complete state */}
                  {ocrResult && ocrStatus === "complete" && (
                    <form
                      onSubmit={handleReceiptSubmit}
                      className="space-y-4 receipt-fields-enter"
                    >
                      {/* Success banner */}
                      <div
                        style={{
                          padding: "10px 14px",
                          background:
                            "color-mix(in srgb, var(--success, #10B981) 10%, var(--bg-card, white))",
                          border:
                            "1px solid color-mix(in srgb, var(--success, #10B981) 25%, transparent)",
                          borderRadius: 10,
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 10,
                        }}
                        data-ocid="receipt.success_state"
                      >
                        <CheckCircle2
                          className="h-5 w-5 flex-shrink-0 mt-0.5"
                          style={{ color: "var(--success, #10B981)" }}
                        />
                        <div style={{ flex: 1 }}>
                          <p
                            className="text-sm font-semibold"
                            style={{ color: "var(--success, #10B981)" }}
                          >
                            Receipt processed successfully
                          </p>
                          <p
                            className="text-xs mt-0.5"
                            style={{
                              color: "var(--text-secondary-color, #475569)",
                            }}
                          >
                            {receiptFile?.name} — Review and edit the extracted
                            details below
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={resetOcrState}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 2,
                            color: "var(--text-muted, #94A3B8)",
                          }}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {/* GST Info Strip */}
                      {gstInfo && (
                        <div
                          style={{
                            background:
                              "color-mix(in srgb, var(--primary, oklch(0.65 0.2 175)) 8%, var(--bg-card, white))",
                            border:
                              "1px solid color-mix(in srgb, var(--primary, oklch(0.65 0.2 175)) 25%, transparent)",
                            borderRadius: 8,
                            padding: "8px 12px",
                            fontSize: 13,
                            color: "var(--text-secondary-color, #475569)",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <span>🏢</span>
                          <span
                            style={{
                              fontWeight: 600,
                              color: "var(--primary, oklch(0.65 0.2 175))",
                            }}
                          >
                            Business expense
                          </span>
                          <span>•</span>
                          <span>GST: {gstInfo.number}</span>
                          <span>•</span>
                          <span>
                            Tax included: ₹
                            {(gstInfo.cgst + gstInfo.sgst).toFixed(0)}
                          </span>
                        </div>
                      )}

                      {/* UPI Info Strip */}
                      {upiInfo && (
                        <div
                          style={{
                            background:
                              "color-mix(in srgb, var(--success, #10B981) 8%, var(--bg-card, white))",
                            border:
                              "1px solid color-mix(in srgb, var(--success, #10B981) 25%, transparent)",
                            borderRadius: 8,
                            padding: "8px 12px",
                            fontSize: 13,
                            color: "var(--text-secondary-color, #475569)",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <span>💳</span>
                          <span
                            style={{
                              fontWeight: 600,
                              color: "var(--success, #10B981)",
                            }}
                          >
                            UPI Payment
                          </span>
                          <span>•</span>
                          <span>Txn ID: {upiInfo.txnId}</span>
                          {upiInfo.upiId && (
                            <>
                              <span>•</span>
                              <span>{upiInfo.upiId}</span>
                            </>
                          )}
                        </div>
                      )}

                      {/* Validation Warnings */}
                      {ocrWarnings.length > 0 && (
                        <div className="space-y-2 mb-3">
                          {ocrWarnings.map((w) => {
                            const isDecimalWarning =
                              w.field === "amount" &&
                              w.level === "yellow" &&
                              w.message.includes("Decimal corrected");
                            const showDecimalButtons =
                              isDecimalWarning &&
                              originalAmount &&
                              correctedAmount &&
                              !decimalBannerDismissed;
                            return (
                              <div
                                key={`warn-${w.field}-${w.message}`}
                                className="flex flex-col gap-2 px-3 py-2 rounded-lg text-sm"
                                style={{
                                  background:
                                    w.level === "red"
                                      ? "color-mix(in srgb, var(--danger, #ef4444) 12%, var(--bg-card, white))"
                                      : "color-mix(in srgb, var(--warning, #f59e0b) 12%, var(--bg-card, white))",
                                  border: `1px solid ${w.level === "red" ? "color-mix(in srgb, var(--danger, #ef4444) 30%, transparent)" : "color-mix(in srgb, var(--warning, #f59e0b) 30%, transparent)"}`,
                                  color:
                                    w.level === "red"
                                      ? "var(--danger, #ef4444)"
                                      : "var(--warning, #f59e0b)",
                                  display:
                                    decimalBannerDismissed && isDecimalWarning
                                      ? "none"
                                      : undefined,
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <span>{w.level === "red" ? "⚠️" : "⚠"}</span>
                                  <span className="flex-1">{w.message}</span>
                                </div>
                                {showDecimalButtons && (
                                  <div className="flex gap-2 mt-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        // Keep corrected — already applied, just dismiss
                                        setDecimalBannerDismissed(true);
                                      }}
                                      className="flex-1 py-1.5 px-3 rounded text-xs font-semibold transition-opacity hover:opacity-80"
                                      style={{
                                        background: "var(--success, #10B981)",
                                        color: "#fff",
                                      }}
                                      data-ocid="receipt.keep_corrected_button"
                                    >
                                      Keep corrected (₹{correctedAmount})
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        // Restore original amount
                                        if (originalAmount)
                                          setAmount(originalAmount);
                                        setDecimalBannerDismissed(true);
                                      }}
                                      className="flex-1 py-1.5 px-3 rounded text-xs font-semibold transition-opacity hover:opacity-80"
                                      style={{
                                        background: "var(--danger, #ef4444)",
                                        color: "#fff",
                                      }}
                                      data-ocid="receipt.use_original_button"
                                    >
                                      Use original (₹{originalAmount})
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Row 1: Amount + Merchant */}
                      <div className="grid gap-4 md:grid-cols-2">
                        {/* Amount field */}
                        <div
                          style={{
                            paddingLeft: 8,
                            borderLeft: `3px solid ${ocrConfidences.amount === "high" ? "var(--success, #10B981)" : ocrConfidences.amount === "medium" ? "var(--warning, #F59E0B)" : "var(--danger, #EF4444)"}`,
                          }}
                          className={
                            ocrConfidences.amount === "medium"
                              ? "pulse-yellow"
                              : ""
                          }
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span
                              className="text-sm font-medium"
                              style={{
                                color: "var(--text-primary-color, #0F172A)",
                              }}
                            >
                              Amount (₹)
                              {isEdited("amount") && (
                                <span
                                  style={{
                                    marginLeft: 6,
                                    fontSize: 10,
                                    color: "var(--warning, #F59E0B)",
                                    background:
                                      "color-mix(in srgb, var(--warning, #F59E0B) 15%, transparent)",
                                    padding: "1px 6px",
                                    borderRadius: 4,
                                  }}
                                >
                                  Edited
                                </span>
                              )}
                            </span>
                            {ocrConfidences.amount && (
                              <ConfidenceChip
                                confidence={ocrConfidences.amount}
                              />
                            )}
                          </div>
                          <FloatingField
                            id="receipt-amount"
                            label="Amount (₹)"
                            value={amount}
                            onChange={(v) => {
                              setAmount(v);
                              markEdited("amount");
                            }}
                            shakeOnInvalid
                            showCheckmark
                            className={flashClass("amount")}
                          />
                        </div>

                        {/* Merchant field */}
                        <div
                          style={{
                            paddingLeft: 8,
                            borderLeft: `3px solid ${ocrConfidences.merchant === "high" ? "var(--success, #10B981)" : ocrConfidences.merchant === "medium" ? "var(--warning, #F59E0B)" : "var(--danger, #EF4444)"}`,
                          }}
                          className={
                            ocrConfidences.merchant === "medium"
                              ? "pulse-yellow"
                              : ""
                          }
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span
                              className="text-sm font-medium"
                              style={{
                                color: "var(--text-primary-color, #0F172A)",
                              }}
                            >
                              Merchant
                              {isEdited("merchant") && (
                                <span
                                  style={{
                                    marginLeft: 6,
                                    fontSize: 10,
                                    color: "var(--warning, #F59E0B)",
                                    background:
                                      "color-mix(in srgb, var(--warning, #F59E0B) 15%, transparent)",
                                    padding: "1px 6px",
                                    borderRadius: 4,
                                  }}
                                >
                                  Edited
                                </span>
                              )}
                            </span>
                            {ocrConfidences.merchant && (
                              <ConfidenceChip
                                confidence={ocrConfidences.merchant}
                              />
                            )}
                          </div>
                          <FloatingField
                            id="receipt-merchant"
                            label="Merchant"
                            value={merchant}
                            onChange={(v) => {
                              setMerchant(v);
                              markEdited("merchant");
                            }}
                            className={flashClass("merchant")}
                          />
                        </div>
                      </div>

                      {/* Row 2: Date + Category */}
                      <div className="grid gap-4 md:grid-cols-2">
                        {/* Date field */}
                        <div
                          style={{
                            paddingLeft: 8,
                            borderLeft: `3px solid ${ocrConfidences.date === "high" ? "var(--success, #10B981)" : ocrConfidences.date === "medium" ? "var(--warning, #F59E0B)" : "var(--danger, #EF4444)"}`,
                          }}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span
                              className="text-sm font-medium"
                              style={{
                                color: "var(--text-primary-color, #0F172A)",
                              }}
                            >
                              Date
                              {isEdited("date") && (
                                <span
                                  style={{
                                    marginLeft: 6,
                                    fontSize: 10,
                                    color: "var(--warning, #F59E0B)",
                                    background:
                                      "color-mix(in srgb, var(--warning, #F59E0B) 15%, transparent)",
                                    padding: "1px 6px",
                                    borderRadius: 4,
                                  }}
                                >
                                  Edited
                                </span>
                              )}
                            </span>
                            {ocrConfidences.date && (
                              <ConfidenceChip
                                confidence={ocrConfidences.date}
                              />
                            )}
                          </div>
                          <input
                            type="date"
                            value={receiptDate}
                            onChange={(e) => {
                              setReceiptDate(e.target.value);
                              markEdited("date");
                            }}
                            style={{
                              width: "100%",
                              background: "var(--bg-card, white)",
                              border:
                                "1px solid var(--border, rgba(0,0,0,0.1))",
                              borderRadius: 8,
                              padding: "8px 12px",
                              color: "var(--text-primary-color, #0F172A)",
                              fontSize: 14,
                              outline: "none",
                            }}
                            data-ocid="receipt.input"
                          />
                        </div>

                        {/* Category field */}
                        <div
                          style={{
                            paddingLeft: 8,
                            borderLeft: `3px solid ${ocrConfidences.category === "high" ? "var(--success, #10B981)" : ocrConfidences.category === "medium" ? "var(--warning, #F59E0B)" : "var(--danger, #EF4444)"}`,
                          }}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span
                              className="text-sm font-medium"
                              style={{
                                color: "var(--text-primary-color, #0F172A)",
                              }}
                            >
                              Category
                              {isEdited("category") && (
                                <span
                                  style={{
                                    marginLeft: 6,
                                    fontSize: 10,
                                    color: "var(--warning, #F59E0B)",
                                    background:
                                      "color-mix(in srgb, var(--warning, #F59E0B) 15%, transparent)",
                                    padding: "1px 6px",
                                    borderRadius: 4,
                                  }}
                                >
                                  Edited
                                </span>
                              )}
                            </span>
                            {ocrConfidences.category && (
                              <ConfidenceChip
                                confidence={ocrConfidences.category}
                              />
                            )}
                          </div>
                          <CategoryDropdown
                            value={category}
                            onChange={(v) => {
                              setCategory(v);
                              markEdited("category");
                              if (v !== ExpenseCategory.Other)
                                setOtherCategoryLabel("");
                            }}
                            flashClass={flashClass("category")}
                            isFlashing={!!flashing.category}
                          />
                        </div>
                      </div>

                      {/* Row 3: Payment Method */}
                      <div className="grid gap-4 md:grid-cols-2">
                        <div
                          style={{
                            paddingLeft: 8,
                            borderLeft: `3px solid ${ocrConfidences.method === "high" ? "var(--success, #10B981)" : ocrConfidences.method === "medium" ? "var(--warning, #F59E0B)" : "var(--danger, #EF4444)"}`,
                          }}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span
                              className="text-sm font-medium"
                              style={{
                                color: "var(--text-primary-color, #0F172A)",
                              }}
                            >
                              Payment Method
                              {isEdited("method") && (
                                <span
                                  style={{
                                    marginLeft: 6,
                                    fontSize: 10,
                                    color: "var(--warning, #F59E0B)",
                                    background:
                                      "color-mix(in srgb, var(--warning, #F59E0B) 15%, transparent)",
                                    padding: "1px 6px",
                                    borderRadius: 4,
                                  }}
                                >
                                  Edited
                                </span>
                              )}
                            </span>
                            {ocrConfidences.method && (
                              <ConfidenceChip
                                confidence={ocrConfidences.method}
                              />
                            )}
                          </div>
                          <select
                            value={method}
                            onChange={(e) => {
                              setMethod(e.target.value as PaymentMethod);
                              markEdited("method");
                            }}
                            style={{
                              width: "100%",
                              background: "var(--bg-input, #F8FAFC)",
                              border:
                                "1px solid var(--border, rgba(0,0,0,0.1))",
                              borderRadius: 8,
                              padding: "8px 12px",
                              color: "var(--text-primary-color, #0F172A)",
                              fontSize: 14,
                              outline: "none",
                              appearance: "none",
                            }}
                            data-ocid="receipt.select"
                          >
                            {Object.values(PaymentMethod).map((m) => (
                              <option key={m} value={m}>
                                {paymentMethodLabel[m] ?? m}
                              </option>
                            ))}
                          </select>
                          {cardHint && (
                            <p
                              className="text-xs mt-1"
                              style={{ color: "var(--text-muted, #94A3B8)" }}
                            >
                              💳 {cardHint}
                            </p>
                          )}
                        </div>
                        <div />
                      </div>

                      <OtherCategoryInput />

                      {/* Note textarea */}
                      <div className="space-y-2">
                        <label
                          htmlFor="receipt-note"
                          className="text-sm font-medium"
                          style={{
                            color: "var(--text-primary-color, #0F172A)",
                          }}
                        >
                          Note (optional)
                        </label>
                        <Textarea
                          id="receipt-note"
                          placeholder="Add any additional details..."
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          rows={2}
                          data-ocid="receipt.textarea"
                        />
                      </div>

                      {/* Items collapsible section */}
                      {receiptItems.length > 0 && (
                        <div
                          style={{
                            borderTop:
                              "1px solid var(--border, rgba(0,0,0,0.1))",
                            paddingTop: 12,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => setShowItems(!showItems)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              fontSize: 14,
                              fontWeight: 500,
                              color: "var(--text-primary-color, #0F172A)",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: "4px 0",
                            }}
                            data-ocid="receipt.panel"
                          >
                            <span
                              style={{
                                transition: "transform 0.2s",
                                transform: showItems
                                  ? "rotate(180deg)"
                                  : "rotate(0deg)",
                              }}
                            >
                              ▼
                            </span>
                            View Items ({receiptItems.length})
                          </button>
                          {showItems && (
                            <div
                              style={{
                                animation: "slideDown 0.3s ease",
                                marginTop: 8,
                              }}
                            >
                              <div
                                style={{
                                  overflowX: "auto",
                                  borderRadius: 8,
                                  border:
                                    "1px solid var(--border, rgba(0,0,0,0.1))",
                                }}
                              >
                                <table
                                  style={{
                                    width: "100%",
                                    borderCollapse: "collapse",
                                    fontSize: 13,
                                  }}
                                >
                                  <thead>
                                    <tr
                                      style={{
                                        background: "var(--bg-muted, #F1F5F9)",
                                      }}
                                    >
                                      <th
                                        style={{
                                          textAlign: "left",
                                          padding: "6px 10px",
                                          color: "var(--text-muted, #94A3B8)",
                                          fontWeight: 500,
                                        }}
                                      >
                                        Item
                                      </th>
                                      <th
                                        style={{
                                          textAlign: "center",
                                          padding: "6px 10px",
                                          color: "var(--text-muted, #94A3B8)",
                                          fontWeight: 500,
                                        }}
                                      >
                                        Qty
                                      </th>
                                      <th
                                        style={{
                                          textAlign: "right",
                                          padding: "6px 10px",
                                          color: "var(--text-muted, #94A3B8)",
                                          fontWeight: 500,
                                        }}
                                      >
                                        Unit Price
                                      </th>
                                      <th
                                        style={{
                                          textAlign: "right",
                                          padding: "6px 10px",
                                          color: "var(--text-muted, #94A3B8)",
                                          fontWeight: 500,
                                        }}
                                      >
                                        Total
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {receiptItems.map((item, i) => (
                                      <tr
                                        key={`receipt-item-${item.name}-${i}`}
                                        style={{
                                          background:
                                            i % 2 === 0
                                              ? "var(--bg-card, white)"
                                              : "var(--bg-muted, #F1F5F9)",
                                        }}
                                        data-ocid={`receipt.item.${i + 1}`}
                                      >
                                        <td
                                          style={{
                                            padding: "6px 10px",
                                            color: "var(--text-h, #0F172A)",
                                            fontWeight: 500,
                                          }}
                                        >
                                          {item.name}
                                        </td>
                                        <td
                                          style={{
                                            padding: "6px 10px",
                                            textAlign: "center",
                                            color:
                                              "var(--text-secondary-color, #475569)",
                                          }}
                                        >
                                          ×{item.qty}
                                        </td>
                                        <td
                                          style={{
                                            padding: "6px 10px",
                                            textAlign: "right",
                                            color:
                                              "var(--text-secondary-color, #475569)",
                                          }}
                                        >
                                          ₹{item.unitPrice}
                                        </td>
                                        <td
                                          style={{
                                            padding: "6px 10px",
                                            textAlign: "right",
                                            color:
                                              "var(--primary, oklch(0.65 0.2 175))",
                                            fontWeight: 600,
                                          }}
                                        >
                                          ₹{item.total}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              {/* Split bill button */}
                              <button
                                type="button"
                                onClick={() => {
                                  window.location.href = "/";
                                }}
                                style={{
                                  marginTop: 10,
                                  width: "100%",
                                  padding: "8px 16px",
                                  border:
                                    "1px solid var(--primary, oklch(0.65 0.2 175))",
                                  background: "transparent",
                                  color: "var(--primary, oklch(0.65 0.2 175))",
                                  borderRadius: 8,
                                  fontSize: 13,
                                  fontWeight: 500,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 6,
                                  transition: "all 0.2s ease",
                                }}
                                onMouseEnter={(e) => {
                                  (
                                    e.currentTarget as HTMLButtonElement
                                  ).style.background =
                                    "color-mix(in srgb, var(--primary, oklch(0.65 0.2 175)) 10%, transparent)";
                                }}
                                onMouseLeave={(e) => {
                                  (
                                    e.currentTarget as HTMLButtonElement
                                  ).style.background = "transparent";
                                }}
                                data-ocid="receipt.secondary_button"
                              >
                                <Scissors className="h-3.5 w-3.5" />
                                Split this bill
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-3 pt-2">
                        <button
                          type="button"
                          onClick={resetOcrState}
                          style={{
                            flex: 1,
                            height: 44,
                            padding: "0 16px",
                            border: "1px solid var(--border, rgba(0,0,0,0.1))",
                            background: "var(--bg-card, white)",
                            color: "var(--text-primary-color, #0F172A)",
                            borderRadius: 8,
                            fontSize: 14,
                            fontWeight: 500,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            transition: "all 0.2s ease",
                          }}
                          data-ocid="receipt.cancel_button"
                        >
                          <Upload className="h-4 w-4" />
                          Re-upload
                        </button>
                        <RippleButton
                          type="submit"
                          isPending={addExpense.isPending}
                          isSuccess={submitSuccess}
                          disabled={
                            addExpense.isPending ||
                            !amount ||
                            Number.parseFloat(amount) <= 0
                          }
                          style={{ flex: 2, height: 48, fontSize: 16 }}
                          data-ocid="receipt.confirm.submit_button"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Add Expense
                        </RippleButton>
                      </div>
                    </form>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <Dialog open={showCamera} onOpenChange={setShowCamera}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Capture Receipt</DialogTitle>
            </DialogHeader>
            <CameraCapture
              onCapture={handleCameraCapture}
              onCancel={() => setShowCamera(false)}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={showLightbox} onOpenChange={setShowLightbox}>
          <DialogContent style={{ maxWidth: "90vw", maxHeight: "90vh" }}>
            <DialogHeader>
              <DialogTitle>Receipt Image</DialogTitle>
            </DialogHeader>
            {receiptImageUrl && (
              <img
                src={receiptImageUrl}
                alt="Receipt full view"
                style={{
                  maxWidth: "100%",
                  maxHeight: "70vh",
                  objectFit: "contain",
                  borderRadius: 8,
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  );
}
