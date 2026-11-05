import { jsPDF } from 'jspdf';
import autoTable, { applyPlugin } from 'jspdf-autotable';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

// Ensure autoTable plugin is registered on jsPDF
try {
  applyPlugin(jsPDF);
} catch {
  // Ignore if already registered
}

// ============================================================================
// Types & Interfaces
// ============================================================================

export type PdfAction = 'preview' | 'download' | 'print' | 'share';
export type PdfActionOutcome = 'completed' | 'downloaded-for-sharing' | 'cancelled';
export interface PdfActionResult {
  outcome: PdfActionOutcome;
  sizeBytes: number;
}

export interface PdfGenerationResult {
  success: boolean;
  receiptNumber: string;
  doc?: jsPDF;
  error?: string;
}

export interface ReceiptHistoryItem {
  receiptNumber: string;
  type: 'MLK' | 'BIL' | 'FED' | 'PAY';
  customerName: string;
  date: string;
  amount: number;
}

export interface MilkPaymentReceiptData {
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  customerName: string;
  customerId: string;
  customerPhone?: string;
  cycleLabel: string; // e.g. "1-10 Oct 2025 (Cycle 1)"
  startDate: string;
  endDate: string;
  milkEntries: Array<{
    date: string;
    shift: 'AM' | 'PM';
    liters: number;
    rate: number;
    amount: number;
  }>;
  totalLiters: number;
  totalMilkAmount: number;
  totalAdvancesDeducted: number;
  cattleFeedReduction: number;
  finalPayable: number;
  advanceBalance: number;
}

export interface MonthlyBillData {
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  customerName: string;
  customerId: string;
  customerPhone?: string;
  customerUpiId?: string;
  cycleLabel: string;
  startDate: string;
  endDate: string;
  milkEntries: Array<{
    date: string;
    shift: 'AM' | 'PM';
    liters: number;
    rate: number;
    amount: number;
  }>;
  advances: Array<{
    date: string;
    amount: number;
    type: 'advance' | 'deduction';
  }>;
  feedPurchases: Array<{
    date: string;
    feed_name: string;
    quantity: number;
    unit_price: number;
    amount: number;
  }>;
  feedReductions: Array<{
    month: string;
    quantity: number;
    unit_price: number;
    amount: number;
  }>;
  payments: Array<{
    date: string;
    amount: number;
    payment_mode?: string;
    reference_no?: string;
    note?: string;
  }>;
  totalMilkAmount: number;
  totalCashAdvances: number;
  totalBillDeductions: number;
  totalFeedAmount: number;
  cattleFeedReduction: number;
  netCattleFeed: number;
  finalPayable: number;
  advanceBalance: number;
  previousBalance?: number;
}

export interface CattleFeedStatementData {
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  customerName: string;
  customerId: string;
  cycleLabel: string;
  feedPurchases: Array<{
    date: string;
    feed_name: string;
    quantity: number;
    unit_price: number;
    amount: number;
  }>;
  feedReductions: Array<{
    month: string;
    quantity: number;
    unit_price: number;
    amount: number;
  }>;
  totalFeedAmount: number;
  cattleFeedReduction: number;
  netCattleFeed: number;
}

export interface PaymentReceiptData {
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  customerName: string;
  customerId: string;
  paymentDate: string;
  paymentAmount: number;
  paymentMode: string; // 'cash' | 'upi' | 'bank_transfer'
  referenceNo?: string;
  note?: string;
  previousBalance?: number;
  newBalance?: number;
}

// ============================================================================
// Formatters & Utility Functions
// ============================================================================

/**
 * Format number into Indian Rupee currency string (e.g. ₹ 1,250.00 or ₹ 1,250).
 */
export function formatINR(amount: number | undefined | null, decimals: number = 2): string {
  if (amount === undefined || amount === null || !Number.isFinite(amount)) {
    return `₹${(0).toFixed(decimals)}`;
  }
  const isNegative = amount < 0;
  const absVal = Math.abs(amount);
  const formatted = absVal.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return isNegative ? `-₹${formatted}` : `₹${formatted}`;
}

function fitTextFontSize(
  doc: jsPDF,
  text: string,
  maxWidth: number,
  preferredSize: number,
  minimumSize: number
): number {
  let size = preferredSize;
  doc.setFontSize(size);
  while (size > minimumSize && doc.getTextWidth(text) > maxWidth) {
    size = Math.max(minimumSize, size - 0.5);
    doc.setFontSize(size);
  }
  return size;
}

/**
 * Generate unique receipt numbers using format DF-{TYPE}-{YYYYMMDD}-{4digitRandom}
 */
function generateReceiptNumber(type: 'MLK' | 'BIL' | 'FED' | 'PAY'): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const yyyymmdd = `${year}${month}${day}`;
  const random4 = Math.floor(1000 + Math.random() * 9000).toString();
  return `DF-${type}-${yyyymmdd}-${random4}`;
}

/**
 * Format current or specific date to DD MMM YYYY (e.g. 21 Oct 2026)
 */
function formatIssueDate(d: Date = new Date()): string {
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Format date string (YYYY-MM-DD or ISO) into DD MMM YYYY display format
 */
function formatDisplayDate(dateStr?: string): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return dateStr;
  }
}

/**
 * Pretty print payment mode
 */
function formatPaymentMode(mode?: string): string {
  if (!mode) return 'Cash';
  switch (mode.toLowerCase()) {
    case 'cash':
      return 'Cash';
    case 'upi':
      return 'UPI / Online';
    case 'bank_transfer':
    case 'bank':
      return 'Bank Transfer / NEFT';
    default:
      return mode.charAt(0).toUpperCase() + mode.slice(1);
  }
}

interface PdfLogoAsset {
  data: string;
  format: 'PNG' | 'JPEG';
}

// Cached, downsampled logo asset
let cachedLogo: PdfLogoAsset | null = null;
let cachedPdfFonts: { regular: string; bold: string } | null = null;

/**
 * Load DairyFlow logo from public folder and convert to base64 Data URL.
 * Fails gracefully and resolves to null if unavailable.
 */
async function loadLogo(): Promise<PdfLogoAsset | null> {
  if (cachedLogo) return cachedLogo;
  if (typeof window === 'undefined') return null;

  return new Promise<PdfLogoAsset | null>((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      const timer = setTimeout(() => {
        resolve(null);
      }, 3000);

      img.onload = () => {
        clearTimeout(timer);
        try {
          const canvas = document.createElement('canvas');
          const sourceWidth = img.naturalWidth || img.width;
          const sourceHeight = img.naturalHeight || img.height;
          const scale = Math.min(1, 256 / Math.max(sourceWidth, sourceHeight));
          canvas.width = Math.max(1, Math.round(sourceWidth * scale));
          canvas.height = Math.max(1, Math.round(sourceHeight * scale));
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          let hasTransparency = false;
          for (let i = 0; i < imageData.data.length; i += 4) {
            const luminance = Math.round(
              imageData.data[i] * 0.299 +
              imageData.data[i + 1] * 0.587 +
              imageData.data[i + 2] * 0.114
            );
            imageData.data[i] = luminance;
            imageData.data[i + 1] = luminance;
            imageData.data[i + 2] = luminance;
            if (imageData.data[i + 3] < 255) hasTransparency = true;
          }
          ctx.putImageData(imageData, 0, 0);
          const data = canvas.toDataURL(
            hasTransparency ? 'image/png' : 'image/jpeg',
            0.78
          );
          const format: PdfLogoAsset['format'] = data.startsWith('data:image/jpeg;') ? 'JPEG' : 'PNG';
          cachedLogo = { data, format };
          resolve(cachedLogo);
        } catch {
          resolve(null);
        }
      };

      img.onerror = () => {
        clearTimeout(timer);
        resolve(null);
      };

      img.src = '/new dairy flow.png';
    } catch {
      resolve(null);
    }
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

async function loadPdfFonts(): Promise<{ regular: string; bold: string }> {
  if (cachedPdfFonts) return cachedPdfFonts;

  const [regularResponse, boldResponse] = await Promise.all([
    fetch('/fonts/NotoSans-Regular.ttf'),
    fetch('/fonts/NotoSans-Bold.ttf'),
  ]);
  if (!regularResponse.ok || !boldResponse.ok) {
    throw new Error('Unable to load the PDF currency font.');
  }

  const [regular, bold] = await Promise.all([
    regularResponse.arrayBuffer(),
    boldResponse.arrayBuffer(),
  ]);
  cachedPdfFonts = {
    regular: arrayBufferToBase64(regular),
    bold: arrayBufferToBase64(bold),
  };
  return cachedPdfFonts;
}

async function registerPdfFonts(doc: jsPDF): Promise<void> {
  const fonts = await loadPdfFonts();
  doc.addFileToVFS('NotoSans-Regular.ttf', fonts.regular);
  doc.addFileToVFS('NotoSans-Bold.ttf', fonts.bold);
  doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
  doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold');
}

function createPdfDocument(): jsPDF {
  return new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
    putOnlyUsedFonts: true,
  });
}

// ============================================================================
// PDF History & Actions
// ============================================================================

const HISTORY_STORAGE_KEY = 'dairyflow_receipt_history';

/**
 * Get stored receipt history from localStorage
 */
export function getReceiptHistory(): ReceiptHistoryItem[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Save newly generated receipt entry to history in localStorage
 */
export function saveReceiptToHistory(item: ReceiptHistoryItem): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const current = getReceiptHistory();
    const updated = [item, ...current.filter((h) => h.receiptNumber !== item.receiptNumber)].slice(0, 200);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to store receipt in localStorage history:', err);
  }
}

/**
 * Open PDF in a new browser tab for preview
 */
export function previewPdf(doc: jsPDF, reservedWindow?: Window | null): void {
  if (typeof window === 'undefined') return;
  previewPdfBlob(createPdfBlob(doc), reservedWindow);
}

function previewPdfBlob(blob: Blob, reservedWindow?: Window | null): void {
  if (typeof window === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const previewWindow = reservedWindow === undefined ? window.open('', '_blank') : reservedWindow;
  if (!previewWindow) {
    URL.revokeObjectURL(url);
    throw new Error('The PDF preview was blocked. Allow pop-ups for DairyFlow and try again.');
  }
  previewWindow.location.href = url;
  const cleanup = window.setInterval(() => {
    if (previewWindow.closed) {
      window.clearInterval(cleanup);
      URL.revokeObjectURL(url);
    }
  }, 1000);
}

/**
 * Download the generated PDF to user's device
 */
function createPdfBlob(doc: jsPDF): Blob {
  const output = doc.output('arraybuffer');
  if (!(output instanceof ArrayBuffer) || output.byteLength <= 5) {
    throw new Error('The generated PDF is empty. Please try again.');
  }
  const bytes = new Uint8Array(output);
  const header = String.fromCharCode(...bytes.subarray(0, 5));
  if (header !== '%PDF-') {
    throw new Error('The generated document is not a valid PDF. Please try again.');
  }
  return new Blob([output], { type: 'application/pdf' });
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function isShareCancelled(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { name?: string; message?: string };
  return candidate.name === 'AbortError' ||
    /share (was )?cancelled|share canceled/i.test(candidate.message || '');
}

export async function downloadPdf(doc: jsPDF, filename: string): Promise<PdfActionOutcome> {
  const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  const blob = createPdfBlob(doc);
  return downloadPdfBlob(blob, cleanFilename);
}

async function downloadPdfBlob(blob: Blob, cleanFilename: string): Promise<PdfActionOutcome> {
  if (Capacitor.isNativePlatform()) {
    const path = `DairyFlow/${cleanFilename}`;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    await Filesystem.writeFile({
      path,
      data: bytesToBase64(bytes),
      directory: Directory.Documents,
      recursive: true,
    });
    const savedFile = await Filesystem.stat({ path, directory: Directory.Documents });
    if (savedFile.size <= 0) {
      throw new Error('The PDF could not be saved. Please try again.');
    }
    return 'completed';
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = cleanFilename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  return 'completed';
}

/**
 * Print the PDF by opening print window
 */
export function printPdf(doc: jsPDF, reservedWindow?: Window | null): void {
  if (typeof window === 'undefined') return;
  printPdfBlob(createPdfBlob(doc), reservedWindow);
}

function printPdfBlob(blob: Blob, reservedWindow?: Window | null): void {
  if (typeof window === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const printWindow = reservedWindow === undefined ? window.open('', '_blank') : reservedWindow;
  if (!printWindow) {
    URL.revokeObjectURL(url);
    throw new Error('The print window was blocked. Allow pop-ups for DairyFlow and try again.');
  }
  printWindow.location.href = url;
  let printStarted = false;
  const startPrint = () => {
    if (printStarted || printWindow.closed) return;
    printStarted = true;
    printWindow.focus();
    printWindow.print();
  };
  printWindow.addEventListener('load', startPrint, { once: true });
  window.setTimeout(startPrint, 1000);
}

/**
 * Share PDF using Web Share API or fallback to download
 */
export async function sharePdf(doc: jsPDF, filename: string): Promise<PdfActionOutcome> {
  const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  const blob = createPdfBlob(doc);
  return sharePdfBlob(blob, cleanFilename);
}

async function sharePdfBlob(blob: Blob, cleanFilename: string): Promise<PdfActionOutcome> {
  const title = cleanFilename.replace(/\.pdf$/i, '');

  if (Capacitor.isNativePlatform()) {
    const path = `DairyFlow/${cleanFilename}`;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const file = await Filesystem.writeFile({
      path,
      data: bytesToBase64(bytes),
      directory: Directory.Cache,
      recursive: true,
    });
    const savedFile = await Filesystem.stat({ path, directory: Directory.Cache });
    if (savedFile.size <= 0) {
      throw new Error('The PDF could not be prepared for sharing. Please try again.');
    }
    try {
      await Share.share({
        title,
        text: title,
        files: [file.uri],
        dialogTitle: 'Share PDF',
      });
      return 'completed';
    } catch (error) {
      if (isShareCancelled(error)) return 'cancelled';
      throw error;
    }
  }

  if (typeof navigator !== 'undefined' && navigator.share) {
    const file = new File([blob], cleanFilename, { type: 'application/pdf' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title,
          text: title,
        });
        return 'completed';
      } catch (error) {
        if (isShareCancelled(error)) return 'cancelled';
        throw error;
      }
    }
  }

  await downloadPdfBlob(blob, cleanFilename);
  return 'downloaded-for-sharing';
}

/**
 * Unified handler for all PDF actions: preview, download, print, share
 */
export async function handlePdfAction(
  doc: jsPDF,
  action: PdfAction,
  filename: string,
  actionWindow?: Window | null
): Promise<PdfActionResult> {
  const blob = createPdfBlob(doc);
  const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  let outcome: PdfActionOutcome;
  switch (action) {
    case 'preview':
      previewPdfBlob(blob, actionWindow);
      outcome = 'completed';
      break;
    case 'download':
      outcome = await downloadPdfBlob(blob, cleanFilename);
      break;
    case 'print':
      printPdfBlob(blob, actionWindow);
      outcome = 'completed';
      break;
    case 'share':
      outcome = await sharePdfBlob(blob, cleanFilename);
      break;
  }
  return { outcome, sizeBytes: blob.size };
}

// ============================================================================
// Layout Helpers
// ============================================================================

/**
 * Execute autoTable using (doc as any).autoTable pattern with fallback
 */
function runAutoTable(doc: jsPDF, options: any): number {
  const defaultStyles = {
    theme: 'grid',
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
      cellPadding: 2.5,
    },
    bodyStyles: {
      textColor: [0, 0, 0],
      fontSize: 8,
      cellPadding: 2.2,
      font: 'NotoSans',
      fillColor: [255, 255, 255],
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255],
    },
    margin: { left: 14, right: 14, top: 25, bottom: 22 },
    styles: {
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      textColor: [0, 0, 0],
      fillColor: [255, 255, 255],
      font: 'NotoSans',
      overflow: 'linebreak',
    },
  };

  const merged = {
    ...defaultStyles,
    ...options,
    headStyles: { ...defaultStyles.headStyles, ...(options.headStyles || {}) },
    bodyStyles: { ...defaultStyles.bodyStyles, ...(options.bodyStyles || {}) },
    alternateRowStyles: { ...defaultStyles.alternateRowStyles, ...(options.alternateRowStyles || {}) },
    margin: { ...defaultStyles.margin, ...(options.margin || {}) },
    styles: { ...defaultStyles.styles, ...(options.styles || {}) },
    didParseCell: (hookData: any) => {
      if (typeof hookData.cell.raw === 'string' && hookData.cell.raw.includes('₹')) {
        hookData.cell.styles.font = 'NotoSans';
      }
      options.didParseCell?.(hookData);
    },
  };

  if (typeof (doc as any).autoTable === 'function') {
    (doc as any).autoTable(merged);
  } else {
    autoTable(doc, merged);
  }

  return (doc as any).lastAutoTable?.finalY ?? (options.startY || 60);
}

function drawCurrencyText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  options?: { align?: 'left' | 'center' | 'right' | 'justify' }
): void {
  const currentFont = doc.getFont();
  const currentFontSize = doc.getFontSize();
  doc.setFont('NotoSans', currentFont.fontStyle);
  doc.text(text, x, y, options);
  doc.setFont(currentFont.fontName, currentFont.fontStyle);
  doc.setFontSize(currentFontSize);
}

interface HeaderOptions {
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  receiptTitle: string;
  receiptNumber: string;
  cycleLabel?: string;
  logo?: PdfLogoAsset | null;
  compact?: boolean;
  marginX?: number;
}

/**
 * Draw a compact, ink-efficient black-and-white business header.
 */
function drawDocumentHeader(doc: jsPDF, opts: HeaderOptions): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = opts.marginX ?? 14;
  const rightEdge = pageWidth - marginX;
  const compact = opts.compact === true;
  const infoWidth = compact ? 70 : 74;

  let textStartX = marginX;
  if (opts.logo) {
    try {
      const logoBoxSize = compact ? 20 : 24;
      const { width, height } = doc.getImageProperties(opts.logo.data);
      const scale = Math.min(logoBoxSize / width, logoBoxSize / height);
      const logoWidth = width * scale;
      const logoHeight = height * scale;
      doc.addImage(
        opts.logo.data,
        opts.logo.format,
        marginX + (logoBoxSize - logoWidth) / 2,
        (compact ? 5 : 7) + (logoBoxSize - logoHeight) / 2,
        logoWidth,
        logoHeight,
        'dairyflow-logo'
      );
      textStartX = marginX + 28;
    } catch {
      textStartX = marginX;
    }
  }

  // Keep the business information within its own header column.
  doc.setFont('NotoSans', 'bold');
  doc.setTextColor(0, 0, 0);
  const businessName = opts.businessName || 'DairyFlow Dairy Management';
  const businessNameSize = fitTextFontSize(doc, businessName, infoWidth, compact ? 11 : 13, 8);
  doc.setFontSize(businessNameSize);
  const businessNameLines = doc.splitTextToSize(businessName, infoWidth);
  const businessNameY = businessNameLines.length > 1 ? (compact ? 10 : 13) : (compact ? 12 : 15);
  doc.text(businessNameLines, textStartX, businessNameY);

  // Business address and phone
  doc.setFont('NotoSans', 'normal');
  doc.setFontSize(compact ? 6.5 : 7.5);
  doc.setTextColor(0, 0, 0);
  const addressY = compact
    ? businessNameY + businessNameLines.length * 3.6 + 1
    : businessNameLines.length > 1 ? 22 : 20;
  let addressLines: string[] = [];
  if (opts.businessAddress) {
    addressLines = doc.splitTextToSize(opts.businessAddress, infoWidth);
    doc.text(addressLines, textStartX, addressY);
  }
  const phoneY = opts.businessAddress
    ? compact ? addressY + addressLines.length * 3.1 + 1.5 : 32
    : addressY;
  if (opts.businessPhone) {
    const phoneText = `Phone: ${opts.businessPhone}`;
    doc.setFontSize(fitTextFontSize(doc, phoneText, infoWidth, compact ? 6.5 : 7.5, 5.5));
    doc.text(phoneText, textStartX, phoneY);
  }

  // Right-aligned document title and metadata
  doc.setFont('NotoSans', 'bold');
  doc.setFontSize(compact ? 9 : 10.5);
  doc.setTextColor(0, 0, 0);
  const title = opts.receiptTitle.toUpperCase();
  doc.setFontSize(fitTextFontSize(doc, title, 78, compact ? 9 : 10.5, 7));
  doc.text(title, rightEdge, compact ? 10 : 13, { align: 'right' });

  doc.setFont('NotoSans', 'bold');
  doc.setFontSize(compact ? 7 : 8.5);
  doc.setTextColor(0, 0, 0);
  doc.text(`Receipt #: ${opts.receiptNumber}`, rightEdge, compact ? 16 : 20, { align: 'right' });

  doc.setFont('NotoSans', 'normal');
  doc.setFontSize(compact ? 7 : 8);
  doc.setTextColor(0, 0, 0);
  doc.text(`Issue Date: ${formatIssueDate()}`, rightEdge, compact ? 22 : 26, { align: 'right' });

  if (opts.cycleLabel) {
    const cycleLabel = `Billing Month: ${opts.cycleLabel}`;
    doc.setFontSize(fitTextFontSize(doc, cycleLabel, 78, compact ? 7 : 8, 6));
    doc.text(cycleLabel, rightEdge, compact ? 28 : 32, { align: 'right' });
  }

  if (compact) {
    const headerContentBottom = Math.max(
      opts.businessPhone ? phoneY + 2.5 : addressY + addressLines.length * 3.1,
      opts.cycleLabel ? 31 : 24,
      25
    );
    const dividerY = Math.max(35, headerContentBottom + 3);
    doc.setDrawColor(160, 160, 160);
    doc.setLineWidth(0.25);
    doc.line(marginX, dividerY, rightEdge, dividerY);
    return dividerY + 3;
  }
  return 44;
}

interface CustomerCardOptions {
  customerName: string;
  customerId: string;
  customerPhone?: string;
  customerUpiId?: string;
  cycleLabel?: string;
  startDate?: string;
  endDate?: string;
  extraFieldLabel?: string;
  extraFieldValue?: string;
  compact?: boolean;
}

/**
 * Draw customer and billing cycle card
 */
function drawCustomerCard(doc: jsPDF, startY: number, opts: CustomerCardOptions): number {
  const compact = opts.compact === true;
  const marginX = compact ? 10 : 14;
  const cardWidth = doc.internal.pageSize.getWidth() - marginX * 2;
  const leftX = marginX + 4;
  const leftWidth = compact ? cardWidth / 2 - 10 : 88;
  const rightX = compact ? marginX + cardWidth / 2 + 4 : 112;
  const customerName = opts.customerName || 'N/A';
  doc.setFont('NotoSans', 'bold');
  doc.setFontSize(compact ? 8 : 10);
  const customerNameLines = compact
    ? doc.splitTextToSize(customerName, leftWidth)
    : doc.splitTextToSize(customerName, leftWidth).slice(0, 3);
  doc.setFont('NotoSans', 'normal');
  doc.setFontSize(compact ? 6.5 : 7);
  const idText = `Customer ID: ${opts.customerId || 'N/A'}`;
  const phoneText = opts.customerPhone ? `  |  Phone: ${opts.customerPhone}` : '';
  const customerMetaLines = doc.splitTextToSize(`${idText}${phoneText}`, leftWidth);
  const customerMeta = compact ? customerMetaLines : customerMetaLines.slice(0, 2);
  const cardHeight = compact
    ? Math.max(25, 13 + customerNameLines.length * 3.2 + customerMeta.length * 3)
    : 32;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.rect(marginX, startY, cardWidth, cardHeight, 'FD');
  if (compact) {
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.2);
    doc.line(marginX + cardWidth / 2, startY + 3, marginX + cardWidth / 2, startY + cardHeight - 3);
  }

  // Left Column: Customer details
  doc.setFont('NotoSans', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0);
  doc.text('CUSTOMER DETAILS', leftX, startY + (compact ? 5 : 5.5));

  doc.setFont('NotoSans', 'bold');
  doc.setFontSize(compact ? 8 : 10);
  doc.setTextColor(0, 0, 0);
  doc.text(customerNameLines, leftX, startY + (compact ? 10 : 11));

  doc.setFont('NotoSans', 'normal');
  doc.setFontSize(compact ? 6.5 : 7);
  doc.setTextColor(0, 0, 0);
  const customerMetaY = startY + (compact ? 10 + customerNameLines.length * 3.2 : (customerNameLines.length > 1 ? 23 : 18));
  doc.text(customerMeta, leftX, customerMetaY);

  // Right Column: Cycle & Dates
  doc.setFont('NotoSans', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0);
  doc.text(opts.cycleLabel ? 'BILLING PERIOD' : 'TRANSACTION DETAILS', rightX, startY + (compact ? 5 : 5.5));

  if (opts.cycleLabel) {
    doc.setFont('NotoSans', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(fitTextFontSize(doc, opts.cycleLabel, leftWidth, compact ? 7 : 8.5, compact ? 5.5 : 6.5));
    doc.text(opts.cycleLabel, rightX, startY + (compact ? 10 : 11));

    if (opts.startDate && opts.endDate) {
      doc.setFont('NotoSans', 'normal');
      doc.setFontSize(compact ? 6.5 : 8);
      doc.setTextColor(0, 0, 0);
      doc.text(`Duration: ${formatDisplayDate(opts.startDate)} to ${formatDisplayDate(opts.endDate)}`, rightX, startY + (compact ? 16 : 18));
    }
  } else if (opts.extraFieldLabel && opts.extraFieldValue) {
    doc.setFont('NotoSans', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(`${opts.extraFieldLabel}: ${opts.extraFieldValue}`, rightX, startY + 11);
  }

  if (opts.customerUpiId) {
    doc.setFont('NotoSans', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    doc.text(`UPI ID: ${opts.customerUpiId}`, rightX, startY + 23);
  }

  return startY + cardHeight + (compact ? 3 : 5);
}

/**
 * Draw a simple bold section title.
 */
function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  if (y > 260) {
    doc.addPage();
    y = 25;
  }
  doc.setFont('NotoSans', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  doc.text(title, 14, y);
  return y + 3.5;
}

/**
 * Draw customer and authorized signatures
 */
function drawSignatures(doc: jsPDF, startY: number): number {
  if (startY + 26 > 278) {
    doc.addPage();
    startY = 30;
  }
  const lineY = startY + 16;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);

  // Customer signature
  doc.line(20, lineY, 75, lineY);
  doc.setFont('NotoSans', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text('Customer Signature', 47.5, lineY + 4.5, { align: 'center' });

  // Authorized signatory
  doc.line(135, lineY, 190, lineY);
  doc.text('Authorized Signatory', 162.5, lineY + 4.5, { align: 'center' });

  return lineY + 10;
}

/**
 * Draw watermark-style footers with timestamp and page numbers across all pages
 */
function drawFooters(doc: jsPDF, businessPhone: string, marginX = 14) {
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const rightEdge = pageWidth - marginX;
  const timestamp = new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    // Divider line
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.line(marginX, 287, rightEdge, 287);

    // Subtle branding footer
    doc.setFont('NotoSans', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    doc.text(`Dairy Flow${businessPhone ? ` | ${businessPhone}` : ''}`, marginX, 292);
    doc.text(`Issued: ${timestamp}`, pageWidth / 2, 292, { align: 'center' });
    doc.text(`Page ${i} of ${totalPages}`, rightEdge, 292, { align: 'right' });
  }
}

// ============================================================================
// 1. generateMilkPaymentReceipt
// ============================================================================

/**
 * Generate Individual Milk Payment Receipt
 */
export async function generateMilkPaymentReceipt(
  data: MilkPaymentReceiptData,
  action?: PdfAction,
  actionWindow?: Window | null
): Promise<PdfGenerationResult> {
  try {
    const doc = createPdfDocument();
    await registerPdfFonts(doc);
    const receiptNumber = generateReceiptNumber('MLK');
    const logo = await loadLogo();

    // 1. Business Header
    let currentY = drawDocumentHeader(doc, {
      businessName: data.businessName,
      businessAddress: data.businessAddress,
      businessPhone: data.businessPhone,
      receiptTitle: 'Milk Payment Receipt',
      receiptNumber,
      cycleLabel: data.cycleLabel,
      logo,
    });

    // 2. Customer Card
    currentY = drawCustomerCard(doc, currentY, {
      customerName: data.customerName,
      customerId: data.customerId,
      customerPhone: data.customerPhone,
      cycleLabel: data.cycleLabel,
      startDate: data.startDate,
      endDate: data.endDate,
    });

    // 3. Section Title
    currentY = drawSectionTitle(doc, 'Milk Supply Entries', currentY);

    // 4. Milk Entries Table
    const tableBody = (data.milkEntries && data.milkEntries.length > 0)
      ? data.milkEntries.map((e) => [
          formatDisplayDate(e.date),
          e.shift,
          Number(e.liters).toFixed(2),
          formatINR(e.rate, 2),
          formatINR(e.amount, 2),
        ])
      : [['-', '-', '0.00', '₹ 0.00', '₹ 0.00']];

    const finalY = runAutoTable(doc, {
      startY: currentY,
      head: [['Date', 'Shift', 'Qty (L)', 'Rate (₹/L)', 'Amount (₹)']],
      body: tableBody,
      foot: [
        [
          'Total Milk Supply',
          '',
          `${Number(data.totalLiters || 0).toFixed(2)} L`,
          '',
          formatINR(data.totalMilkAmount, 2),
        ],
      ],
      columnStyles: {
        0: { cellWidth: 38 },
        1: { cellWidth: 24, halign: 'center' },
        2: { cellWidth: 35, halign: 'right' },
        3: { cellWidth: 38, halign: 'right' },
        4: { cellWidth: 47, halign: 'right' },
      },
      footStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
      },
    });

    // 5. Summary Box & Signatures
    let summaryY = finalY + 6;
    if (summaryY > 215) {
      doc.addPage();
      summaryY = 25;
    }

    // Left Column: Notes & Signatures
    doc.setFont('NotoSans', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text('STATEMENT NOTES', 14, summaryY + 5);

    doc.setFont('NotoSans', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    doc.text('• Amount calculated based on recorded quantity and applicable shift rate.', 14, summaryY + 11);
    doc.text('• Advances and cattle feed reductions deducted as authorized.', 14, summaryY + 16);
    doc.text('• For disputes or clarifications, please notify office within 3 days.', 14, summaryY + 21);

    // Right Column: Summary Card
    const boxX = 112;
    const boxWidth = 84;
    const boxHeight = 44;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.roundedRect(boxX, summaryY, boxWidth, boxHeight, 2, 2, 'FD');

    doc.setFont('NotoSans', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text('FINANCIAL SUMMARY', boxX + 4, summaryY + 6);

    // Line 1: Gross Milk Amount
    doc.setFont('NotoSans', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text('Gross Milk Amount:', boxX + 4, summaryY + 12);
    doc.setFont('NotoSans', 'bold');
    doc.setTextColor(0, 0, 0);
    drawCurrencyText(doc, formatINR(data.totalMilkAmount, 2), boxX + boxWidth - 4, summaryY + 12, { align: 'right' });

    // Line 2: Advances Deducted
    doc.setFont('NotoSans', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text('Advance Deductions:', boxX + 4, summaryY + 17);
    doc.setFont('NotoSans', 'bold');
    doc.setTextColor(0, 0, 0);
    drawCurrencyText(doc, `- ${formatINR(data.totalAdvancesDeducted, 2)}`, boxX + boxWidth - 4, summaryY + 17, { align: 'right' });

    // Line 3: Cattle Feed Deductions
    doc.setFont('NotoSans', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text('Cattle Feed Deductions:', boxX + 4, summaryY + 22);
    doc.setFont('NotoSans', 'bold');
    doc.setTextColor(0, 0, 0);
    drawCurrencyText(doc, `- ${formatINR(data.cattleFeedReduction, 2)}`, boxX + boxWidth - 4, summaryY + 22, { align: 'right' });

    // Highlight the payable amount with a clear black outline.
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.6);
    doc.roundedRect(boxX + 2, summaryY + 26, boxWidth - 4, 10, 1.5, 1.5, 'FD');
    doc.setFont('NotoSans', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text('NET PAYABLE:', boxX + 5, summaryY + 32.5);
    doc.setFontSize(10.5);
    drawCurrencyText(doc, formatINR(data.finalPayable, 2), boxX + boxWidth - 5, summaryY + 32.5, { align: 'right' });

    // Line 4: Advance Balance Remaining
    doc.setFont('NotoSans', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    drawCurrencyText(doc, `Remaining Advance Balance: ${formatINR(data.advanceBalance, 2)}`, boxX + 4, summaryY + 41);

    // Signatures
    drawSignatures(doc, summaryY + 28);

    // Footers
    drawFooters(doc, data.businessPhone);

    // Save to history
    saveReceiptToHistory({
      receiptNumber,
      type: 'MLK',
      customerName: data.customerName,
      date: new Date().toISOString(),
      amount: data.finalPayable,
    });

    if (action) {
      await handlePdfAction(doc, action, `${receiptNumber}.pdf`, actionWindow);
    }

    return {
      success: true,
      receiptNumber,
      doc,
    };
  } catch (error: any) {
    console.error('Error generating milk payment receipt:', error);
    return {
      success: false,
      receiptNumber: '',
      error: error?.message || 'Failed to generate milk payment receipt',
    };
  }
}

// ============================================================================
// 2. generateMonthlyBill
// ============================================================================

/**
 * Generate Full Monthly / Billing Cycle Customer Statement
 */
export async function generateMonthlyBill(
  data: MonthlyBillData,
  action?: PdfAction,
  actionWindow?: Window | null
): Promise<PdfGenerationResult> {
  try {
    const doc = createPdfDocument();
    await registerPdfFonts(doc);
    const receiptNumber = generateReceiptNumber('BIL');
    const logo = await loadLogo();

    // 1. Business Header
    let currentY = drawDocumentHeader(doc, {
      businessName: data.businessName,
      businessAddress: data.businessAddress,
      businessPhone: data.businessPhone,
      receiptTitle: 'Customer Billing Statement',
      receiptNumber,
      cycleLabel: data.cycleLabel,
      logo,
      compact: true,
      marginX: 10,
    });

    // 2. Customer Card
    currentY = drawCustomerCard(doc, currentY, {
      customerName: data.customerName,
      customerId: data.customerId,
      customerPhone: data.customerPhone,
      customerUpiId: data.customerUpiId,
      cycleLabel: data.cycleLabel,
      startDate: data.startDate,
      endDate: data.endDate,
      compact: true,
    });

    currentY = drawSectionTitle(doc, 'Milk Supply Details', currentY);
    const totalMilkLiters = data.milkEntries?.reduce((sum, e) => sum + (Number(e.liters) || 0), 0) || 0;
    const milkRows = data.milkEntries?.length
      ? data.milkEntries.map((entry) => [
          formatDisplayDate(entry.date),
          entry.shift,
          Number(entry.liters).toFixed(2),
          formatINR(entry.rate, 2),
          formatINR(entry.amount, 2),
        ])
      : [['No milk entries recorded for this period', '', '', '', '']];

    const summaryRows = [
      { label: 'Total Milk Supply', value: formatINR(data.totalMilkAmount, 2) },
      { label: 'Total Cash Advances', value: formatINR(data.totalCashAdvances, 2) },
      { label: 'Bill Deductions', value: `- ${formatINR(data.totalBillDeductions, 2)}` },
      { label: 'Net Cattle Feed Charges', value: formatINR(data.netCattleFeed, 2) },
    ];
    if (data.previousBalance !== undefined && Number.isFinite(data.previousBalance)) {
      summaryRows.push({
        label: 'Previous Balance',
        value: formatINR(data.previousBalance, 2),
      });
    }

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 10;
    const contentWidth = pageWidth - marginX * 2;
    const summaryRowGap = 4.5;
    const payableOffset = 10 + summaryRows.length * summaryRowGap;
    const remainingOffset = payableOffset + 11;
    const summaryBoxHeight = remainingOffset + 6;
    const signatureBlockHeight = 24;
    const summaryGap = 4;

    const finalY = runAutoTable(doc, {
      startY: currentY,
      head: [['Date', 'Shift', 'Qty (L)', 'Rate (₹/L)', 'Amount (₹)']],
      body: milkRows,
      foot: [[
        'TOTAL MILK SUPPLY',
        '',
        `${totalMilkLiters.toFixed(2)} L`,
        '',
        formatINR(data.totalMilkAmount, 2),
      ]],
      showHead: 'everyPage',
      showFoot: 'lastPage',
      rowPageBreak: 'avoid',
      tableWidth: contentWidth,
      margin: { left: marginX, right: marginX, top: 16, bottom: 18 },
      columnStyles: {
        0: { cellWidth: 40, halign: 'left' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 31, halign: 'right' },
        3: { cellWidth: 42, halign: 'right' },
        4: { cellWidth: 57, halign: 'right' },
      },
      styles: {
        font: 'NotoSans',
        fontSize: 8,
        cellPadding: { top: 0.7, right: 1.2, bottom: 0.7, left: 1.2 },
        minCellHeight: 5.3,
        overflow: 'linebreak',
        valign: 'middle',
        lineColor: [0, 0, 0],
        lineWidth: 0.15,
      },
      bodyStyles: {
        font: 'NotoSans',
        fontSize: 8,
        cellPadding: { top: 0.7, right: 1.2, bottom: 0.7, left: 1.2 },
      },
      headStyles: {
        font: 'NotoSans',
        fontSize: 8.2,
        fontStyle: 'bold',
        halign: 'center',
        cellPadding: { top: 1.2, right: 1.4, bottom: 1.2, left: 1.4 },
        lineWidth: 0.2,
      },
      footStyles: {
        font: 'NotoSans',
        fontSize: 8,
        fontStyle: 'bold',
        textColor: [0, 0, 0],
        fillColor: [255, 255, 255],
        cellPadding: { top: 1.4, right: 1.4, bottom: 1.4, left: 1.4 },
      },
      didDrawPage: (hookData: any) => {
        if (hookData.pageNumber > 1) {
          doc.setFont('NotoSans', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(0, 0, 0);
          doc.text('CUSTOMER BILLING STATEMENT - CONTINUED', marginX, 10);
          doc.setDrawColor(170, 170, 170);
          doc.setLineWidth(0.2);
          doc.line(marginX, 12, pageWidth - marginX, 12);
        }
      },
    });

    const summaryRequiredHeight = summaryGap + summaryBoxHeight + 5 + signatureBlockHeight;
    let summaryY = finalY + summaryGap;
    const bottomContentLimit = pageHeight - 17;
    if (summaryY + summaryRequiredHeight > bottomContentLimit) {
      doc.addPage();
      doc.setFont('NotoSans', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      doc.text('CUSTOMER BILLING STATEMENT - FINANCIAL SUMMARY', marginX, 12);
      doc.setFont('NotoSans', 'normal');
      doc.setFontSize(7);
      doc.text(`Receipt #: ${receiptNumber}`, pageWidth - marginX, 12, { align: 'right' });
      doc.setDrawColor(170, 170, 170);
      doc.setLineWidth(0.2);
      doc.line(marginX, 15, pageWidth - marginX, 15);
      summaryY = 21;
    }

    const summaryX = 99;
    const summaryWidth = pageWidth - marginX - summaryX;
    const dividerX = summaryX - 4;
    doc.setFont('NotoSans', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text('RECONCILIATION NOTES', marginX, summaryY + 5);
    doc.setFont('NotoSans', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    const notes = [
      'Milk earnings use recorded quantities and rates.',
      'Cash advances are shown separately; they are not deducted twice.',
      'Feed charges and bill deductions follow the recorded billing calculations.',
      'Previous and remaining balances are carried forward as recorded.',
    ];
    let noteY = summaryY + 11;
    notes.forEach((note) => {
      const lines = doc.splitTextToSize(`• ${note}`, dividerX - marginX - 6);
      doc.text(lines, marginX, noteY);
      noteY += lines.length * 3.6 + 1.2;
    });
    doc.setDrawColor(190, 190, 190);
    doc.setLineWidth(0.2);
    doc.line(dividerX, summaryY + 2, dividerX, summaryY + summaryBoxHeight - 2);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.25);
    doc.rect(summaryX, summaryY, summaryWidth, summaryBoxHeight, 'FD');

    doc.setFont('NotoSans', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text('FINANCIAL SUMMARY', summaryX + 3, summaryY + 5.5);

    summaryRows.forEach((row, index) => {
      const rowY = summaryY + 10 + index * summaryRowGap;
      doc.setFont('NotoSans', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(0, 0, 0);
      const labelWidth = summaryWidth - 43;
      doc.setFontSize(fitTextFontSize(doc, row.label, labelWidth, 7.2, 6));
      doc.text(row.label, summaryX + 3, rowY);

      doc.setFont('NotoSans', 'bold');
      const valueSize = fitTextFontSize(doc, row.value, 37, 7.2, 5.5);
      doc.setFontSize(valueSize);
      doc.text(row.value, summaryX + summaryWidth - 3, rowY, { align: 'right' });
    });

    const bannerY = summaryY + payableOffset;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.45);
    doc.rect(summaryX + 2, bannerY, summaryWidth - 4, 8, 'FD');
    doc.setFont('NotoSans', 'bold');
    doc.setTextColor(0, 0, 0);
    const payableLabel = 'NET SETTLEMENT / PAYABLE';
    const payableAmount = formatINR(data.finalPayable, 2);
    const payableLabelWidth = summaryWidth - 51;
    doc.setFontSize(fitTextFontSize(doc, payableLabel, payableLabelWidth, 7.2, 6));
    doc.text(payableLabel, summaryX + 4, bannerY + 5.4);
    doc.setFont('NotoSans', 'bold');
    const payableSize = fitTextFontSize(doc, payableAmount, 42, 7.2, 5.5);
    doc.setFontSize(payableSize);
    doc.text(payableAmount, summaryX + summaryWidth - 4, bannerY + 5.4, { align: 'right' });

    doc.setFont('NotoSans', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(0, 0, 0);
    doc.text('Remaining Advance Balance', summaryX + 3, summaryY + remainingOffset);
    doc.setFont('NotoSans', 'bold');
    const balanceText = formatINR(data.advanceBalance, 2);
    const balanceSize = fitTextFontSize(doc, balanceText, 37, 7.2, 5.5);
    doc.setFontSize(balanceSize);
    doc.setTextColor(0, 0, 0);
    doc.text(balanceText, summaryX + summaryWidth - 3, summaryY + remainingOffset, { align: 'right' });

    const signatureY = summaryY + summaryBoxHeight + 5;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(20, signatureY + 8, 75, signatureY + 8);
    doc.line(pageWidth - 75, signatureY + 8, pageWidth - 20, signatureY + 8);
    doc.setFont('NotoSans', 'normal');
    doc.setFontSize(7.2);
    doc.text('Customer Signature', 47.5, signatureY + 12.5, { align: 'center' });
    doc.text('Authorized Signatory', pageWidth - 47.5, signatureY + 12.5, { align: 'center' });

    drawFooters(doc, data.businessPhone, marginX);

    // Save to history
    saveReceiptToHistory({
      receiptNumber,
      type: 'BIL',
      customerName: data.customerName,
      date: new Date().toISOString(),
      amount: data.finalPayable,
    });

    if (action) {
      await handlePdfAction(doc, action, `${receiptNumber}.pdf`, actionWindow);
    }

    return {
      success: true,
      receiptNumber,
      doc,
    };
  } catch (error: any) {
    console.error('Error generating monthly billing statement:', error);
    return {
      success: false,
      receiptNumber: '',
      error: error?.message || 'Failed to generate monthly statement',
    };
  }
}

// ============================================================================
// 3. generateCattleFeedStatement
// ============================================================================

/**
 * Generate Cattle Feed Purchase Statement
 */
export async function generateCattleFeedStatement(
  data: CattleFeedStatementData,
  action?: PdfAction,
  actionWindow?: Window | null
): Promise<PdfGenerationResult> {
  try {
    const doc = createPdfDocument();
    await registerPdfFonts(doc);
    const receiptNumber = generateReceiptNumber('FED');
    const logo = await loadLogo();

    // 1. Business Header
    let currentY = drawDocumentHeader(doc, {
      businessName: data.businessName,
      businessAddress: data.businessAddress,
      businessPhone: data.businessPhone,
      receiptTitle: 'Cattle Feed Statement',
      receiptNumber,
      cycleLabel: data.cycleLabel,
      logo,
    });

    // 2. Customer Card
    currentY = drawCustomerCard(doc, currentY, {
      customerName: data.customerName,
      customerId: data.customerId,
      cycleLabel: data.cycleLabel,
      extraFieldLabel: 'Billing Period',
      extraFieldValue: data.cycleLabel,
    });

    // 3. Cattle Feed Purchases Table
    currentY = drawSectionTitle(doc, 'Feed Purchases (Sacks & Supplies)', currentY);
    const purchaseRows = (data.feedPurchases && data.feedPurchases.length > 0)
      ? data.feedPurchases.map((p) => [
          formatDisplayDate(p.date),
          p.feed_name || 'Standard Feed',
          Number(p.quantity).toFixed(0),
          formatINR(p.unit_price, 2),
          formatINR(p.amount, 2),
        ])
      : [['No cattle feed purchases recorded for this period', '', '', '', formatINR(0, 2)]];

    const totalSacks = data.feedPurchases?.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0) || 0;

    let finalY = runAutoTable(doc, {
      startY: currentY,
      head: [['Date', 'Brand / Feed Type', 'Sacks', 'Price/Sack (₹)', 'Total Amount (₹)']],
      body: purchaseRows,
      foot: [
        [
          'Total Feed Purchased',
          '',
          `${totalSacks} Sacks`,
          '',
          formatINR(data.totalFeedAmount, 2),
        ],
      ],
      columnStyles: {
        0: { cellWidth: 38 },
        1: { cellWidth: 62 },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 27, halign: 'right' },
        4: { cellWidth: 30, halign: 'right' },
      },
      footStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
      },
    });

    // 4. Feed Reductions Table (if any)
    if (data.feedReductions && data.feedReductions.length > 0) {
      currentY = drawSectionTitle(doc, 'Feed Subsidies & Monthly Reductions', finalY + 6);
      const reductionRows = data.feedReductions.map((r) => [
        formatDisplayDate(r.month),
        Number(r.quantity).toFixed(0),
        formatINR(r.unit_price, 2),
        formatINR(r.amount, 2),
      ]);

      finalY = runAutoTable(doc, {
        startY: currentY,
        head: [['Month / Period', 'Sacks Credited', 'Unit Subsidy Rate (₹)', 'Reduction Amount (₹)']],
        body: reductionRows,
        foot: [
          [
            'Total Cattle Feed Reductions',
            '',
            '',
            formatINR(data.cattleFeedReduction, 2),
          ],
        ],
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: 35, halign: 'center' },
          2: { cellWidth: 47, halign: 'right' },
          3: { cellWidth: 50, halign: 'right' },
        },
        footStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
        },
      });
    }

    // 5. Summary Box
    let summaryY = finalY + 6;
    if (summaryY > 215) {
      doc.addPage();
      summaryY = 25;
    }

    // Left notes
    doc.setFont('NotoSans', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text('CATTLE FEED NOTES', 14, summaryY + 5);

    doc.setFont('NotoSans', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    doc.text('• High-quality certified cattle feed supplied per registered quota.', 14, summaryY + 11);
    doc.text('• Government/Society feed subsidies adjusted against total bill.', 14, summaryY + 16);
    doc.text('• Net amount is adjusted against milk payments in the billing cycle.', 14, summaryY + 21);

    // Right summary card
    const boxX = 112;
    const boxWidth = 84;
    const boxHeight = 40;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.roundedRect(boxX, summaryY, boxWidth, boxHeight, 2, 2, 'FD');

    doc.setFont('NotoSans', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text('FEED ACCOUNT SUMMARY', boxX + 4, summaryY + 6);

    doc.setFont('NotoSans', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text('Total Feed Purchases:', boxX + 4, summaryY + 12);
    doc.setFont('NotoSans', 'bold');
    doc.setTextColor(0, 0, 0);
    drawCurrencyText(doc, formatINR(data.totalFeedAmount, 2), boxX + boxWidth - 4, summaryY + 12, { align: 'right' });

    doc.setFont('NotoSans', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text('Less Feed Reductions:', boxX + 4, summaryY + 17);
    doc.setFont('NotoSans', 'bold');
    doc.setTextColor(0, 0, 0);
    drawCurrencyText(doc, `- ${formatINR(data.cattleFeedReduction, 2)}`, boxX + boxWidth - 4, summaryY + 17, { align: 'right' });

    // Net feed payable box
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.6);
    doc.roundedRect(boxX + 2, summaryY + 22, boxWidth - 4, 12, 1.5, 1.5, 'FD');
    doc.setFont('NotoSans', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text('NET FEED PAYABLE:', boxX + 5, summaryY + 29.5);
    doc.setFontSize(10.5);
    drawCurrencyText(doc, formatINR(data.netCattleFeed, 2), boxX + boxWidth - 5, summaryY + 29.5, { align: 'right' });

    // Signatures
    drawSignatures(doc, summaryY + 26);

    // Footers
    drawFooters(doc, data.businessPhone);

    // Save to history
    saveReceiptToHistory({
      receiptNumber,
      type: 'FED',
      customerName: data.customerName,
      date: new Date().toISOString(),
      amount: data.netCattleFeed,
    });

    if (action) {
      await handlePdfAction(doc, action, `${receiptNumber}.pdf`, actionWindow);
    }

    return {
      success: true,
      receiptNumber,
      doc,
    };
  } catch (error: any) {
    console.error('Error generating cattle feed statement:', error);
    return {
      success: false,
      receiptNumber: '',
      error: error?.message || 'Failed to generate cattle feed statement',
    };
  }
}

// ============================================================================
// 4. generatePaymentReceipt
// ============================================================================

/**
 * Generate General Payment Receipt (Cash, UPI, Bank Transfer)
 */
export async function generatePaymentReceipt(
  data: PaymentReceiptData,
  action?: PdfAction,
  actionWindow?: Window | null
): Promise<PdfGenerationResult> {
  try {
    const doc = createPdfDocument();
    await registerPdfFonts(doc);
    const receiptNumber = generateReceiptNumber('PAY');
    const logo = await loadLogo();

    // 1. Business Header
    let currentY = drawDocumentHeader(doc, {
      businessName: data.businessName,
      businessAddress: data.businessAddress,
      businessPhone: data.businessPhone,
      receiptTitle: 'Official Payment Receipt',
      receiptNumber,
      logo,
    });

    // 2. Customer Card
    currentY = drawCustomerCard(doc, currentY, {
      customerName: data.customerName,
      customerId: data.customerId,
      extraFieldLabel: 'Payment Date',
      extraFieldValue: formatDisplayDate(data.paymentDate),
    });

    // 3. Highlighted Amount Banner (Hero card)
    const heroY = currentY;
    const heroHeight = 24;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.6);
    doc.roundedRect(14, heroY, 182, heroHeight, 2, 2, 'FD');

    doc.setFont('NotoSans', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text('AMOUNT RECEIVED', 105, heroY + 7, { align: 'center' });

    doc.setFont('NotoSans', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    drawCurrencyText(doc, formatINR(data.paymentAmount, 2), 105, heroY + 17, { align: 'center' });

    currentY = heroY + heroHeight + 8;

    // 4. Payment Details Card
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.roundedRect(14, currentY, 182, 36, 2, 2, 'FD');

    doc.setFont('NotoSans', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text('TRANSACTION PARTICULARS', 18, currentY + 7);

    // Left Column details
    doc.setFont('NotoSans', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text('Payment Date:', 18, currentY + 14);
    doc.setFont('NotoSans', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(formatDisplayDate(data.paymentDate), 55, currentY + 14);

    doc.setFont('NotoSans', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text('Payment Mode:', 18, currentY + 20);
    doc.setFont('NotoSans', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(formatPaymentMode(data.paymentMode), 55, currentY + 20);

    doc.setFont('NotoSans', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text('Reference / UTR No:', 18, currentY + 26);
    doc.setFont('NotoSans', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(data.referenceNo || 'N/A', 55, currentY + 26);

    // Right Column details
    doc.setFont('NotoSans', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text('Payment Purpose / Note:', 115, currentY + 14);
    doc.setFont('NotoSans', 'normal');
    doc.setTextColor(0, 0, 0);
    const splitNote = doc.splitTextToSize(data.note || 'Direct payment settlement for milk / dairy supplies.', 75);
    doc.text(splitNote, 115, currentY + 20);

    currentY += 42;

    // 5. Account Balance Breakdown (if provided)
    if (data.previousBalance !== undefined || data.newBalance !== undefined) {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.roundedRect(14, currentY, 182, 24, 2, 2, 'FD');

      doc.setFont('NotoSans', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      doc.text('ACCOUNT BALANCE ADJUSTMENT', 18, currentY + 6);

      // Previous Balance
      doc.setFont('NotoSans', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      doc.text('Previous Balance:', 18, currentY + 14);
      doc.setFont('NotoSans', 'bold');
      doc.setTextColor(0, 0, 0);
      drawCurrencyText(doc, formatINR(data.previousBalance ?? 0, 2), 18, currentY + 19);

      // Amount Received
      doc.setFont('NotoSans', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text('Payment Credited:', 85, currentY + 14);
      doc.setFont('NotoSans', 'bold');
      doc.setTextColor(0, 0, 0);
      drawCurrencyText(doc, `- ${formatINR(data.paymentAmount, 2)}`, 85, currentY + 19);

      // Updated Balance
      doc.setFont('NotoSans', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text('Updated Balance:', 145, currentY + 14);
      doc.setFont('NotoSans', 'bold');
      doc.setTextColor(0, 0, 0);
      drawCurrencyText(doc, formatINR(data.newBalance ?? 0, 2), 145, currentY + 19);

      currentY += 30;
    }

    // 6. Acknowledgement Note
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(14, currentY, 182, 14, 1.5, 1.5, 'F');
    doc.setFont('NotoSans', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    doc.text(
      'Thank you for your payment. This is a computer-generated official receipt issued by DairyFlow.',
      105,
      currentY + 6,
      { align: 'center' }
    );
    doc.text(
      'No physical signature required for computer generated receipts. Valid subject to realization of funds.',
      105,
      currentY + 10.5,
      { align: 'center' }
    );

    currentY += 20;

    // 7. Signatures
    drawSignatures(doc, currentY);

    // 8. Footers
    drawFooters(doc, data.businessPhone);

    // Save to history
    saveReceiptToHistory({
      receiptNumber,
      type: 'PAY',
      customerName: data.customerName,
      date: new Date().toISOString(),
      amount: data.paymentAmount,
    });

    if (action) {
      await handlePdfAction(doc, action, `${receiptNumber}.pdf`, actionWindow);
    }

    return {
      success: true,
      receiptNumber,
      doc,
    };
  } catch (error: any) {
    console.error('Error generating payment receipt:', error);
    return {
      success: false,
      receiptNumber: '',
      error: error?.message || 'Failed to generate payment receipt',
    };
  }
}
